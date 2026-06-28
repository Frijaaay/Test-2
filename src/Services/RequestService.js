/**
 * RequestService.gs
 * Orchestrates technical request logic, role-specific access control, data joins, and secure proxy file gateways.
 */
const RequestService = {

  handleEnvelopePath(decodedParam) {
    const parts = decodedParam.split('.');
    if (parts.length !== 3) {
      return { status: 'ERROR', message: 'Malformed authentication envelope.' };
    }

    const base64Id = parts[0];
    const twiceEncodedEmail = parts[1];
    const base64hash = parts[2];

    if (!AuthService.verifyEnvelope(base64Id, twiceEncodedEmail, base64hash)) {
      return { status: 'ERROR', message: 'Authentication signature mismatch.' };
    }

    const email = AuthService.decodeEnvelopeEmail(twiceEncodedEmail);
    
    const token = AuthService.getTokenByEmail(email);
    if (!token) {
      return { 
        status: 'ERROR', 
        message: 'Access Denied. Your email (' + email + ') is not authorized. Please contact the system administrator.' 
      };
    }

    const role = AuthService.getRoleByEmail(email);

    let requestId = '';
    try {
      requestId = AuthService.base64UrlDecode(base64Id);
    } catch (idErr) {
      requestId = '';
    }

    const isDashboard = !requestId || requestId === 'DASHBOARD';
    const dataPayload = isDashboard ? this.getDashboardData(email, role) : this.getRequestDetails(requestId, email, role);

    if (dataPayload && dataPayload.error) {
      return { status: 'ERROR', message: dataPayload.error };
    }

    const cache = CacheService.getScriptCache();
    const versionedKey = Config.CACHE_VERSION + '_' + token;
    cache.put(versionedKey, JSON.stringify({ email: email, role: role }), Config.SESSION_CACHE_TTL_SEC);

    return { 
      status: 'SAVE_TOKEN', 
      token: token, 
      isDashboard: isDashboard, 
      data: dataPayload,
      viewerEmail: email, 
      viewerRole: role 
    };
  },

  handleCleanIdPath(token, requestId) {
    const session = AuthService.getSession(token);

    if (!session) {
      const app_key = Config.getAppKey();
      requestId = AuthService.base64UrlEncode(requestId || 'DASHBOARD');
      return {
        status: 'REQUIRE_AUTH',
        base64requestid: AuthService.base64UrlEncode(requestId + '.' + app_key),
        appBUrl: Config.getAuthUrl()
      };
    }

    const isDashboard = !requestId || requestId === 'DASHBOARD';
    const dataPayload = isDashboard 
      ? this.getDashboardData(session.email, session.role) 
      : this.getRequestDetails(requestId, session.email, session.role);

    if (dataPayload && dataPayload.error) {
      return { status: 'ERROR', message: dataPayload.error };
    }

    return { 
      status: 'RENDER_DATA', 
      isDashboard: isDashboard, 
      data: dataPayload,
      viewerEmail: session.email, 
      viewerRole: session.role 
    };
  },

  getDashboardData(email, role) {
    try {
      const sheet = SheetRepository.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const rows = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const requestorEmail = String(SheetRepository.getCell(sheet, row, 'Email Address'));

        if (role === 'Tester' || role === 'Approver') {
          rows.push(this.formatRow(sheet, row));
        } else if (requestorEmail.toLowerCase() === email.toLowerCase()) {
          rows.push(this.formatRow(sheet, row));
        }
      }
      return rows;
    } catch (err) {
      console.error('getDashboardData error: ' + err.stack);
      return [];
    }
  },

  getRequestDetails(requestId, email, role) {
    try {
      const sheet = SheetRepository.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const i = SheetRepository.findRowIndexByRequestId(sheet, data, requestId);
      if (i === -1) return { error: 'Request not found.' };

      const row = data[i];
      const requestorEmail = String(SheetRepository.getCell(sheet, row, 'Email Address'));

      if (role === 'Requestor' && requestorEmail.toLowerCase() !== email.toLowerCase()) {
        return { error: 'You do not have access to this request.' };
      }

      const formatted = this.formatRow(sheet, row);
      formatted.viewerRole = role;
      formatted.viewerEmail = email;

      // Dynamic Join: If Approver or Tester, pull results from RESULT_SHEET [3]
      if (role === 'Approver' || role === 'Tester') {
        formatted.testResults = this.getTestResultsByRequestId(requestId);
      }

      return formatted;
    } catch (err) {
      console.error('getRequestDetails error: ' + err.stack);
      return { error: 'Something went wrong loading this request.' };
    }
  },

  getTestResultsByRequestId(requestId) {
    try {
      const sheet = SheetRepository.getSheetByGid(Config.RESULT_SHEET);
      const data = sheet.getDataRange().getValues();
      const reqColIdx = SheetRepository.colIndex(sheet, 'Request ID');
      
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][reqColIdx]).trim() === String(requestId).trim()) {
          return {
            timestamp: this.formatDateCell(data[i][SheetRepository.colIndex(sheet, 'Timestamp')]),
            requestId: String(data[i][SheetRepository.colIndex(sheet, 'Request ID')]),
            testFindings: String(data[i][SheetRepository.colIndex(sheet, 'Test Findings')]),
            knownIssues: String(data[i][SheetRepository.colIndex(sheet, 'Known Issues')]),
            recommendation: String(data[i][SheetRepository.colIndex(sheet, 'Recommendation')]),
            requiredActions: String(data[i][SheetRepository.colIndex(sheet, 'Required Actions')]),
            supportingFiles: String(data[i][SheetRepository.colIndex(sheet, 'Supporting Screenshots/Files')]),
            ccRecipients: String(data[i][SheetRepository.colIndex(sheet, 'Additional CC Recipients')])
          };
        }
      }
      return null;
    } catch (err) {
      console.error('getTestResultsByRequestId error: ' + err.stack);
      return null;
    }
  },

  executeReviewDecision(token, base64Id, payload) {
    try {
      const session = AuthService.getSession(token);
      if (!session) return { error: 'Session expired. Please refresh.' };

      const role = session.role;
      if (role !== 'Tester' && role !== 'Approver') {
        return { error: 'You do not have permission to submit a review decision.' };
      }

      const requestId = AuthService.base64UrlDecode(base64Id);
      const sheet = SheetRepository.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const i = SheetRepository.findRowIndexByRequestId(sheet, data, requestId);
      if (i === -1) return { error: 'Request not found.' };

      const row = data[i];
      const requestorName = SheetRepository.getCell(sheet, row, 'Requestor Name');
      const requestorEmail = SheetRepository.getCell(sheet, row, 'Email Address');
      const editResponseUrl = SheetRepository.getCell(sheet, row, 'Edit Response URL');
      const assignedTester = SheetRepository.getCell(sheet, row, 'Tester') || session.email;

      const updates = {};
      const dateSubmittedStr = this.formatDateCell(SheetRepository.getCell(sheet, row, 'Date Submitted'));
      const testScheduleStr = this.formatDateCell(SheetRepository.getCell(sheet, row, 'Test Schedule'));

      const details = {
        request_id: requestId,
        name: requestorName,
        type: SheetRepository.getCell(sheet, row, 'Request Type'),
        summary: SheetRepository.getCell(sheet, row, 'Summary of Request'),
        date_submitted: dateSubmittedStr,
        test_schedule: testScheduleStr,
        reason: payload.remarks || '',
        edit_url: editResponseUrl || ''
      };

      // ==========================================
      // A. TESTER WORKFLOW TRANSITIONS (Slide 3)
      // ==========================================
      if (role === 'Tester') {
        updates['Status'] = payload.newStatus;
        updates['Tester'] = session.email;

        if (payload.newStatus === 'In Testing') {
          updates['Testing Started Date'] = new Date();
          SheetRepository.updateResponseRow(requestId, updates);
          
          EmailService.sendReviewedProceedingEmail(requestorEmail, details);
          EmailService.sendAssignedTesterEmail(session.email, details);
        } 
        else if (payload.newStatus === 'Return For Revision') {
          updates['Review Remarks'] = payload.remarks;
          SheetRepository.updateResponseRow(requestId, updates);
          
          EmailService.sendReturnedForRevisionEmail(requestorEmail, details);
        } 
        else if (payload.newStatus === 'Completed') {
          updates['Testing Completed Date'] = new Date();
          if (payload.outcome) updates['Test Result Status'] = payload.outcome; 
          updates['Review Remarks'] = payload.remarks;
          SheetRepository.updateResponseRow(requestId, updates);

          // Automated Action: Trigger Email Alert to Approver [Slide 4]
          const approverAlertDetails = {
            request_id: requestId,
            type: details.type,
            summary: details.summary,
            date_submitted: details.date_submitted,
            tester_email: session.email,
            outcome: payload.outcome,
            remarks: payload.remarks || 'None'
          };
          EmailService.sendTestCompletedAlertToApprover(Config.getApproverEmail(), approverAlertDetails);
        }
      }

      // ==========================================
      // B. APPROVER SIGN-OFF TRANSITIONS (Slide 5/6)
      // ==========================================
      if (role === 'Approver') {
        let finalStatus = '';
        if (payload.newStatus === 'Return For Revision') {
          finalStatus = 'Return For Revision';
        } else {
          if (payload.outcome === 'Approved') {
            finalStatus = 'Approved';
          } else if (payload.outcome === 'Passed with Conditions') {
            finalStatus = 'Approved with Conditions';
          } else {
            finalStatus = 'Rejected';
          }
        }

        updates['Status'] = finalStatus; 
        updates['Approval Status'] = payload.outcome || '';
        updates['Approval Remarks'] = payload.remarks || '';
        SheetRepository.updateResponseRow(requestId, updates);

        const testResults = this.getTestResultsByRequestId(requestId);
        const extraCCs = testResults ? testResults.ccRecipients : '';
        
        const ccList = [
          assignedTester,           
          session.email,            
          Config.getStakeholderEmail(), 
          extraCCs                  
        ].filter(email => email && email.trim() !== '').join(', ');

        // Automated Action: Send final closure notification email [Slide 6]
        const closureDetails = {
          request_id: requestId,
          requestor_name: requestorName,
          type: details.type,
          summary: details.summary,
          date_submitted: details.date_submitted,
          final_status: finalStatus,
          remarks: payload.remarks || 'No remarks provided.',
          cc_recipients: ccList
        };
        EmailService.sendFinalClosureNotification(requestorEmail, closureDetails);
      }

      // Log status transition inside sheet
      const existingLogs = SheetRepository.getCell(sheet, row, 'Status Logs') || '';
      const formattedTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
      const logLine = `${formattedTimestamp} — ${session.email}: ${payload.newStatus}` +
        (payload.outcome ? ` (${payload.outcome})` : '') +
        (payload.remarks ? ` — "${payload.remarks}"` : '');
      
      SheetRepository.updateResponseRow(requestId, { 'Status Logs': existingLogs ? existingLogs + '\n' + logLine : logLine });

      return this.getRequestDetails(requestId, session.email, session.role);
    } catch (err) {
      console.error('executeReviewDecision error: ' + err.stack);
      return { error: 'Something went wrong submitting your decision.' };
    }
  },

  executeCancelRequest(token, base64Id) {
    try {
      const session = AuthService.getSession(token);
      if (!session) return { error: 'Session expired. Please refresh.' };

      const requestId = AuthService.base64UrlDecode(base64Id);
      const sheet = SheetRepository.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const i = SheetRepository.findRowIndexByRequestId(sheet, data, requestId);
      if (i === -1) return { error: 'Request not found.' };

      const row = data[i];
      const requestorName = SheetRepository.getCell(sheet, row, 'Requestor Name');
      const requestorEmail = String(SheetRepository.getCell(sheet, row, 'Email Address'));
      const status = SheetRepository.getCell(sheet, row, 'Status');
      const assignedTester = SheetRepository.getCell(sheet, row, 'Tester');

      if (requestorEmail.toLowerCase() !== session.email.toLowerCase()) {
        return { error: 'You can only cancel your own submissions.' };
      }
      
      const VALID_CANCEL_STATUSES = ['Submitted', 'Resubmitted'];
      if (VALID_CANCEL_STATUSES.indexOf(status) === -1) {
        return { error: 'This request can no longer be cancelled.' };
      }

      SheetRepository.updateResponseRow(requestId, { 'Status': 'Cancelled' });

      const existingLogs = SheetRepository.getCell(sheet, row, 'Status Logs') || '';
      const formattedTimestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMM d, yyyy h:mm a');
      const logLine = `${formattedTimestamp} — ${session.email}: Cancelled`;

      SheetRepository.updateResponseRow(requestId, {
        'Status Logs': existingLogs ? existingLogs + '\n' + logLine : logLine
      });

      // Trigger Cancellation Email Notifications [Slide 5/6 alignment]
      const details = {
        request_id: requestId,
        name: requestorName,
        type: SheetRepository.getCell(sheet, row, 'Request Type'),
        summary: SheetRepository.getCell(sheet, row, 'Summary of Request'),
        date_submitted: this.formatDateCell(SheetRepository.getCell(sheet, row, 'Date Submitted'))
      };

      EmailService.sendCancellationConfirmationEmail(requestorEmail, details);

      if (assignedTester && assignedTester.trim() !== '') {
        EmailService.sendCancellationAlertToTester(assignedTester, details);
      }

      return this.getRequestDetails(requestId, session.email, session.role);
    } catch (err) {
      console.error('executeCancelRequest error: ' + err.stack);
      return { error: 'Something went wrong cancelling this request.' };
    }
  },

  getSecureAttachment(token, fileId) {
    try {
      const session = AuthService.getSession(token);
      if (!session) throw new Error("Unauthorized: Session expired.");

      const requestId = this.findRequestIdByAttachmentFileId(fileId);
      if (!requestId) {
        throw new Error('Attachment not found in an accessible request.');
      }

      if (!this.canSessionAccessRequest(requestId, session)) {
        throw new Error('You do not have access to this attachment.');
      }

      const file = DriveApp.getFileById(fileId);
      const blob = file.getBlob();
      const base64Data = Utilities.base64Encode(blob.getBytes());

      return {
        fileName: file.getName(),
        mimeType: file.getMimeType(),
        base64Data: base64Data
      };
    } catch (err) {
      console.error("getSecureAttachment Error: " + err.stack);
      throw new Error("Could not download file securely. Contact Administrator.");
    }
  },

  canSessionAccessRequest(requestId, session) {
    try {
      const sheet = SheetRepository.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const rowIndex = SheetRepository.findRowIndexByRequestId(sheet, data, requestId);

      if (rowIndex === -1) {
        return false;
      }

      const row = data[rowIndex];
      const requestorEmail = String(SheetRepository.getCell(sheet, row, 'Email Address') || '').toLowerCase();
      const sessionEmail = String(session && session.email ? session.email : '').toLowerCase();
      const sessionRole = String(session && session.role ? session.role : 'Requestor');

      if (sessionRole === 'Requestor') {
        return requestorEmail === sessionEmail;
      }

      return true;
    } catch (err) {
      console.error('canSessionAccessRequest error: ' + err.stack);
      return false;
    }
  },

  extractDriveFileId(value) {
    if (!value) return '';

    const text = String(value).trim();
    if (!text) return '';

    const match = text.match(/(?:\/d\/|id=)([a-zA-Z0-9_-]{10,})/);
    return match && match[1] ? match[1] : text;
  },

  normalizeAttachmentValue(value) {
    return String(value || '')
      .split(/[\n,;|]+/)
      .map((part) => this.extractDriveFileId(part))
      .filter(Boolean);
  },

  findRequestIdByAttachmentFileId(fileId) {
    try {
      const sheet = SheetRepository.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const attachmentHeaders = [
        'Test Plan',
        'Firmware/APK Files',
        'Device Specifications',
        'Release Notes',
        'Supporting Documents'
      ];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        for (let j = 0; j < attachmentHeaders.length; j++) {
          const values = this.normalizeAttachmentValue(SheetRepository.getCell(sheet, row, attachmentHeaders[j]));
          if (values.indexOf(String(fileId)) !== -1) {
            return String(SheetRepository.getCell(sheet, row, 'Request ID'));
          }
        }
      }

      return '';
    } catch (err) {
      console.error('findRequestIdByAttachmentFileId error: ' + err.stack);
      return '';
    }
  },

  formatRow(sheet, row) {
    return {
      requestId: SheetRepository.getCell(sheet, row, 'Request ID'),
      timestamp: this.formatDateCell(SheetRepository.getCell(sheet, row, 'Timestamp')),
      dateSubmitted: this.formatDateCell(SheetRepository.getCell(sheet, row, 'Date Submitted')),
      requestorEmail: SheetRepository.getCell(sheet, row, 'Email Address'),
      requestorName: SheetRepository.getCell(sheet, row, 'Requestor Name'),
      company: SheetRepository.getCell(sheet, row, 'Company'),
      contactInfo: SheetRepository.getCell(sheet, row, 'Contact Information'),
      testSchedule: this.formatDateCell(SheetRepository.getCell(sheet, row, 'Test Schedule')),
      requestType: SheetRepository.getCell(sheet, row, 'Request Type'),
      summary: SheetRepository.getCell(sheet, row, 'Summary of Request'),
      detailedDescription: SheetRepository.getCell(sheet, row, 'Detailed Description'),
      firmwareVersion: SheetRepository.getCell(sheet, row, 'Firmware/App Version'),
      deviceModel: SheetRepository.getCell(sheet, row, 'Device Model'),
      targetEnvironment: SheetRepository.getCell(sheet, row, 'Target Environment'),
      testPlanUrl: SheetRepository.getCell(sheet, row, 'Test Plan'),
      firmwareFilesUrl: SheetRepository.getCell(sheet, row, 'Firmware/APK Files'),
      deviceSpecs: SheetRepository.getCell(sheet, row, 'Device Specifications'),
      releaseNotesUrl: SheetRepository.getCell(sheet, row, 'Release Notes'),
      supportingDocsUrl: SheetRepository.getCell(sheet, row, 'Supporting Documents'),
      status: SheetRepository.getCell(sheet, row, 'Status'),
      statusLogs: SheetRepository.getCell(sheet, row, 'Status Logs'),
      tester: SheetRepository.getCell(sheet, row, 'Tester'),
      testingStarted: this.formatDateCell(SheetRepository.getCell(sheet, row, 'Testing Started Date')),
      testingCompleted: this.formatDateCell(SheetRepository.getCell(sheet, row, 'Testing Completed Date')),
      editResponseUrl: SheetRepository.getCell(sheet, row, 'Edit Response URL'),
      reviewRemarks: SheetRepository.getCell(sheet, row, 'Review Remarks'),
      testResultStatus: SheetRepository.getCell(sheet, row, 'Test Result Status'),
      ccRecipients: SheetRepository.getCell(sheet, row, 'Added CC Recipients'),
      approvalStatus: SheetRepository.getCell(sheet, row, 'Approval Status'),
      approvalRemarks: SheetRepository.getCell(sheet, row, 'Approval Remarks'),
      emailNotificationLogs: SheetRepository.getCell(sheet, row, 'Email Notification Logs')
    };
  },

  formatDateCell(val) {
    if (val instanceof Date) {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), 'MMM d, yyyy');
    }
    return val ? String(val) : '';
  }
};