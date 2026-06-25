/**
 * TokenEngine.gs
 * Handles bound administrative spreadsheet onEdit automation triggers.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('Lifestyle Admin')
    .addItem('Generate Missing Tokens', 'admin_bulkGenerateTokens')
    .addToUi();
}

function onEdit(e) {
  if (!e) return;
  
  const range = e.range;
  const sheet = range.getSheet();
  
  if (sheet.getSheetId() === Config.ROLES_SHEET) {
    const rowNum = range.getRow();
    if (rowNum === 1) return;
    
    const emailColIdx = SheetRepository.colIndex(sheet, 'Email') + 1;
    const email = sheet.getRange(rowNum, emailColIdx).getValue();
    if (email) {
      const cache = CacheService.getScriptCache();
      const cacheKey = Config.CACHE_VERSION + '_role_' + email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
      cache.remove(cacheKey);
    }
    return;
  }

  if (sheet.getSheetId() !== Config.TOKENS_SHEET) return;
  
  const rowNum = range.getRow();
  const colNum = range.getColumn();
  
  const emailColIdx = SheetRepository.colIndex(sheet, 'Email') + 1;
  if (colNum !== emailColIdx) return;
  
  if (rowNum === 1) return;
  
  const emailValue = String(range.getValue()).trim();
  
  if (emailValue) {
    const tokenColIdx = SheetRepository.colIndex(sheet, 'Token') + 1;
    const timestampColIdx = SheetRepository.colIndex(sheet, 'Timestamp') + 1;
    
    const tokenRange = sheet.getRange(rowNum, tokenColIdx);
    const timestampRange = sheet.getRange(rowNum, timestampColIdx);
    
    if (!tokenRange.getValue()) {
      const generatedToken = AuthService.generateHexToken(32);
      tokenRange.setValue(generatedToken);
      timestampRange.setValue(new Date());
    }
  }
}

function admin_bulkGenerateTokens() {
  const ui = SpreadsheetApp.getUi();
  try {
    const sheet = SheetRepository.getSheetByGid(Config.TOKENS_SHEET);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      ui.alert('No records found to process.');
      return;
    }
    
    const data = sheet.getDataRange().getValues();
    const emailCol = SheetRepository.colIndex(sheet, 'Email');
    const tokenCol = SheetRepository.colIndex(sheet, 'Token');
    const timestampCol = SheetRepository.colIndex(sheet, 'Timestamp');
    
    let processedCount = 0;
    
    for (let i = 1; i < data.length; i++) {
      const email = String(data[i][emailCol]).trim();
      const existingToken = data[i][tokenCol];
      
      if (email && !existingToken) {
        const rowNum = i + 1;
        const generatedToken = AuthService.generateHexToken(32);
        
        sheet.getRange(rowNum, tokenCol + 1).setValue(generatedToken);
        sheet.getRange(rowNum, timestampCol + 1).setValue(new Date());
        processedCount++;
      }
    }
    
    SpreadsheetApp.flush();
    ui.alert('Bulk processing completed. ' + processedCount + ' tokens generated.');
  } catch (err) {
    ui.alert('Error executing bulk token generation: ' + err.message);
  }
}