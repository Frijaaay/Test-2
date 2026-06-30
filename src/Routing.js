/**
 * Handles HTML Web App evaluations and client-to-server router gateways.
 */

function doGet(e) {
  const template = HtmlService.createTemplateFromFile('Index');
  template.initialParam = (e && e.parameter && e.parameter.dXJsX3BhcmFt) || '';

  return template.evaluate()
    .setTitle('Test Request Management')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://raw.githubusercontent.com/Frijaaay/cdn/refs/heads/main/src/converge/logos/favicon.ico')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function authenticateAndFetch(token, rawParam) {
  try {
    let decodedParam = '';
    try {
      decodedParam = rawParam ? AuthService.base64UrlDecode(rawParam) : '';
    } catch (decodeErr) {
      decodedParam = '';
    }

    const isEnvelope = decodedParam.indexOf('.') !== -1;
    
    if (isEnvelope) {
      return RequestService.handleEnvelopePath(decodedParam);
    } else {
      return RequestService.handleCleanIdPath(token, decodedParam);
    }
  } catch (err) {
    console.error('authenticateAndFetch error: ' + err.stack);
    return { status: 'ERROR', message: 'Something went wrong. Please refresh and try again.' };
  }
}

function submitReviewDecision(token, base64Id, payload) {
  return RequestService.executeReviewDecision(token, base64Id, payload);
}

function cancelRequest(token, base64Id) {
  return RequestService.executeCancelRequest(token, base64Id);
}

function addAdditionalApprover(token, base64Id, email) {
  return RequestService.addAdditionalApprover(token, base64Id, email);
}

function submitAdditionalApproverDecision(token, base64Id, payload) {
  return RequestService.submitAdditionalApproverDecision(token, base64Id, payload);
}

function checkForTestResult(token, base64Id) {
  const session = AuthService.getSession(token);
  if (!session) return { error: 'Session expired. Please refresh.' };
  const requestId = AuthService.base64UrlDecode(base64Id);
  return { submitted: !!RequestService.getTestResultsByRequestId(requestId) };
}

function getSecureAttachment(token, fileId) {
  return RequestService.getSecureAttachment(token, fileId);
}