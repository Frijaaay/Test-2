/**
 * EmailService.gs
 * Safely evaluates template parameters and controls email transmission with logging.
 */
const EmailService = {

  _parseFileLinks(filesString) {
    if (!filesString) return [];
    const urls = String(filesString).split(',').map(s => s.trim()).filter(Boolean);
    return urls.map((url, index) => {
        let name = `Supporting File ${index + 1}`;
        try {
            const urlObject = new URL(url);
            const pathParts = urlObject.pathname.split('/');
            const potentialName = pathParts[pathParts.length - 1];
            if (potentialName) {
                name = decodeURIComponent(potentialName);
            }
        } catch (e) { /* Use default name if URL parsing fails */ }
        return { name, url };
    });
  },
  
  sendMail(recipient, params) {
    try {
      const template = HtmlService.createTemplateFromFile('email_template');
      
      params = params || {};
      params.reason = params.reason || "";
      params.hasAttachments = !!(params.attachment_list && params.attachment_list.length > 0);
      params.hasButtons = !!(params.buttons && params.buttons.length > 0);
      params.footer_closing = params.footer_closing || null;

      if (params.test_results && params.test_results.supportingFiles) {
        params.supporting_files_list = this._parseFileLinks(params.test_results.supportingFiles);
      } else {
        params.supporting_files_list = [];
      }
      params.hasSupportingFiles = params.supporting_files_list.length > 0;

      template.data = params;

      const htmlBody = template.evaluate().getContent();
      const cc = params.cc || "";
      const bcc = params.bcc || "";
      
      GmailApp.sendEmail(recipient, params.subject, "Please enable HTML inside your email reader.", {
        name: 'Test Request Notifications',
        htmlBody: htmlBody,
        noReply: true,
        cc: cc,
        bcc: bcc
      });

      SheetRepository.appendEmailLog(params.request_id, params.subject, recipient, cc);
      return true;
    } catch (error) {
      console.error("Email Service Transport Fault: " + error.stack);
      return false;
    }
  },

  sendReviewedProceedingEmail(recipient, details) {
    const subject = `Request #${details.request_id} - has proceed in testing`;
    const params = {
      subject: subject,
      title: "Your Request For Testing Is Now In Progress",
      name: details.name,
      message_body: "Your request for testing has been successfully reviewed by our team and has proceeded to the testing. You will be notified automatically once the results are out.",
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      test_schedule: details.test_schedule || "",
      attachment_list: details.attachment_list || []
    };
    return this.sendMail(recipient, params);
  },

  sendAssignedTesterEmail(testerEmail, details) {
    const subject = `Request ID #${details.request_id} - is now assigned to you.`;
    const appUrl = Config.getAppUrl();
    const params = {
      subject: subject,
      title: "Request For Testing Assignment",
      name: "Tester",
      message_body: "This request for testing has been assigned to you. Please ensure the relevant testing activities, refer to the attached requirements, and submit your results once complete.",
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      test_schedule: details.test_schedule || "",
      attachment_list: details.attachment_list || [],
      buttons: [
        {
          text: "Submit Test Results",
          url: appUrl + "?dXJsX3BhcmFt=" + encodeURIComponent(AuthService.base64UrlEncode(details.request_id))
        }
      ]
    };
    return this.sendMail(testerEmail, params);
  },

  sendReturnedForRevisionEmail(recipient, details) {
    const subject = "Action Required: Testing Request Returned for Revision - " + details.request_id;
    const params = {
      subject: subject,
      title: "Action Required: Revisions Needed",
      name: details.name,
      message_body: "Your request has been evaluated by the testing team and requires update/revisions before we can proceed. Please check the remarks/comments below and click 'Edit Response' to modify your submission.",
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      test_schedule: details.test_schedule || "",
      reason: details.reason,
      attachment_list: details.attachment_list || [],
      buttons: [
        {
          text: "Edit Response",
          url: details.edit_url
        }
      ]
    };
    return this.sendMail(recipient, params);
  },

  sendTestCompletedAlertToApprover(approverEmail, details) {
    const subject = `For Approval: Request #${details.request_id} is pending for your approval`;
    const appUrl = Config.getAppUrl();
    let approverName = "Approver";
    if (approverEmail) {
      try {
        const namePart = approverEmail.split('@')[0];
        const nameBits = namePart.split('.');
        const firstName = nameBits[0];
        if (firstName) {
          approverName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }
      } catch (e) {
        console.error("Could not parse approver name from email: " + approverEmail);
      }
    }

    const params = {
      subject: subject,
      title: "Request for Testing is pending for your approval.",
      name: approverName,
      message_body: `Tester ${details.tester_email} has completed testing and documented findings. This request is pending review & sign-off approval.`,
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      test_schedule: details.test_schedule || "",
      test_plan_url: details.test_plan_url || null,
      test_results: details.test_results || null,
      testResultStatus: details.outcome || null,
      testRemarks: details.remarks || null,
      buttons: [
        {
          text: "Review & Sign-Off",
          url: appUrl + "?dXJsX3BhcmFt=" + encodeURIComponent(AuthService.base64UrlEncode(details.request_id))
        }
      ]
    };
    return this.sendMail(approverEmail, params);
  },

  sendFinalClosureNotification(recipientEmail, details) {
    const subject = `Request for Testing #${details.request_id} is: ${details.final_status}`;

    const params = {
      subject: subject,
      title: `Request for testing outcome: ${details.final_status}`,
      name: details.requestor_name,
      message_body: 'Your request for testing has been reviewed and finalized.<br><br>Please take note of the remarks below if any.',
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      reason: details.remarks,
      cc: details.cc_recipients,
      test_plan_url: details.test_plan_url || null,
      test_results: details.test_results || null,
      testResultStatus: details.testResultStatus || null,
      testRemarks: details.testRemarks || null
    };
    return this.sendMail(recipientEmail, params);
  },

  sendCancellationConfirmationEmail(recipient, details) {
    const subject = "Request Cancelled - " + details.request_id;
    const params = {
      subject: subject,
      title: "Your Technical Request Has Been Cancelled",
      name: details.name,
      message_body: "This email confirms that your request for testing has been successfully cancelled as requested. No further action is required.",
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted
    };
    return this.sendMail(recipient, params);
  },

  sendCancellationAlertToTester(testerEmail, details) {
    const subject = "ALERT: Assigned Request Cancelled - " + details.request_id;
    const params = {
      subject: subject,
      title: "Assigned Request Cancelled",
      name: "Tester",
      message_body: "Please be advised that the request for testing assigned to you has been officially cancelled by the requestor. Active testing on this request may be discontinued.",
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted
    };
    return this.sendMail(testerEmail, params);
  },

  sendAddedAsApproverEmail(recipient, details) {
    const subject = `Review Request: You've been added as an approver for ${details.request_id}`;
    const appUrl = Config.getAppUrl();
    let recipientName = details.name;
    if (recipient) {
      try {
        const namePart = recipient.split('@')[0];
        const nameBits = namePart.split('.');
        const firstName = nameBits[0];
        if (firstName) {
          recipientName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }
      } catch (e) {
        console.error("Could not parse recipient name from email: " + recipient);
      }
    }
    const params = {
      subject: subject,
      title: "Review Request",
      name: recipientName,
      message_body: `You have been added as an additional approver for a test request by ${details.added_by}. Please use the button below to review the details and submit your decision.`,
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      buttons: [
        {
          text: "Review and Decide",
          url: appUrl + "?dXJsX3BhcmFt=" + encodeURIComponent(AuthService.base64UrlEncode(details.request_id))
        }
      ]
    };
    return this.sendMail(recipient, params);
  },

  sendAdditionalDecisionConfirmation(recipient, details) {
    const subject = `Decision Submitted for ${details.request_id}`;
    let recipientName = details.name;
    if (recipient) {
      try {
        const namePart = recipient.split('@')[0];
        const nameBits = namePart.split('.');
        const firstName = nameBits[0];
        if (firstName) {
          recipientName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }
      } catch (e) {
        console.error("Could not parse recipient name from email: " + recipient);
      }
    }
    const params = {
      subject: subject,
      title: "Decision Submitted",
      name: recipientName,
      message_body: `This email confirms that your decision of '${details.outcome}' for request ${details.request_id} has been recorded.`,
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      reason: `Your Remarks: "${details.remarks}"`
    };
    return this.sendMail(recipient, params);
  },

  sendAdditionalDecisionNotification(mainApproverEmail, details) {
    const subject = `An additional approver has made a decision on ${details.request_id}`;
    const appUrl = Config.getAppUrl();
    let approverName = "Main Approver";
    if (mainApproverEmail) {
      try {
        const namePart = mainApproverEmail.split('@')[0];
        const nameBits = namePart.split('.');
        const firstName = nameBits[0];
        if (firstName) {
          approverName = firstName.charAt(0).toUpperCase() + firstName.slice(1);
        }
      } catch (e) {
        console.error("Could not parse main approver name from email: " + mainApproverEmail);
      }
    }
    const params = {
      subject: subject,
      title: "Additional Approval Submitted",
      name: approverName,
      message_body: `An additional approver (${details.additionalApproverEmail}) has submitted their decision for request ${details.request_id}.`,
      request_id: details.request_id,
      reason: `<br>Decision: ${details.outcome}<br>Remarks: "${details.remarks}"`,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      buttons: [
        {
          text: "View Request",
          url: appUrl + "?dXJsX3BhcmFt=" + encodeURIComponent(AuthService.base64UrlEncode(details.request_id))
        }
      ]
    };
    return this.sendMail(mainApproverEmail, params);
  }
};