function checkFormSubmission(requestId) {
  try {
    const sheet = SheetRepository.getSheetByGid(Config.RESULT_SHEET);
    const data = sheet.getDataRange().getValues();
    // Assuming the first column of the result sheet is the request ID.
    // This is a big assumption and might need to be changed.
    const requestIdCol = 0; 

    for (let i = 1; i < data.length; i++) {
      if (data[i][requestIdCol] == requestId) {
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('checkFormSubmission error: ' + e.toString());
    return false;
  }
}
