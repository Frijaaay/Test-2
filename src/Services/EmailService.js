/**
 * EmailService.gs
 * Safely evaluates template parameters and controls email transmission with logging.
 */
const EmailService = {
  
  sendMail(recipient, params) {
    try {
      const template = HtmlService.createTemplateFromFile('email_template');
      
      params = params || {};
      params.reason = params.reason || "";
      params.hasAttachments = !!(params.attachment_list && params.attachment_list.length > 0);
      params.hasButtons = !!(params.buttons && params.buttons.length > 0);
      params.footer_closing = params.footer_closing || null;

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
    const subject = "Request is in Testing - " + details.request_id;
    const params = {
      subject: subject,
      title: "Your Testing Request is Now in Progress",
      name: details.name,
      message_body: "Your request for testing has been successfully reviewed by our testing team and has proceeded to the active testing stage. You will be notified automatically once the results are published.",
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
    const subject = "Assignment Alert: Active Test Pending - " + details.request_id;
    const appUrl = Config.getAppUrl();
    const params = {
      subject: subject,
      title: "New Testing Assignment",
      name: "Tester",
      message_body: "This request for testing has been officially assigned to you. Please execute the relevant testing activities, refer to the attached requirements, and utilize the button below to submit your results once complete.",
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
      message_body: "Your request has been evaluated by the testing team and requires update/revisions before we can proceed. Please check the remarks listed below and click 'Edit Response' to modify your submission.",
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
    const subject = `APPROVAL REQUIRED: Test Results for request #+ ${details.request_id}`;
    const appUrl = Config.getAppUrl();
    const params = {
      subject: subject,
      title: "Test Report Pending Approval",
      name: "Approver",
      message_body: `Tester ${details.tester_email} has completed technical testing and encoded findings. This request is pending review & sign-off.`,
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      test_schedule: details.test_schedule || "",
      reason: `Outcome Recommendation: <strong>${details.outcome}</strong><br><br>Tester Remarks: "${details.remarks}"`,
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
    const subject = `Test Request Final Status Notification - ${details.request_id} [${details.final_status}]`;
    const params = {
      subject: subject,
      title: `Request for testing outcome: ${details.final_status}`,
      name: details.requestor_name,
      message_body: 'Your request for testing has been reviewed and finalized.',
      request_id: details.request_id,
      type: details.type,
      summary: details.summary,
      date_submitted: details.date_submitted,
      reason: `Approver: "${details.remarks}"`,
      cc: details.cc_recipients
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
  }
};