/**
 * Handles secure Google Sheet database transactions, locks, and normalized headers.
 */
const SheetRepository = {
  _columnMapCache: {},

  getSpreadsheet() {
    return SpreadsheetApp.getActiveSpreadsheet();
  },

  getSheetByGid(gid) {
    const sheet = this.getSpreadsheet().getSheetById(gid);
    if (!sheet) {
      throw new Error('Sheet with GID ' + gid + ' not found inside this spreadsheet.');
    }
    return sheet;
  },

  getRolesSheet() {
    const sheet = this.getSpreadsheet().getSheetById(Config.ROLES_SHEET);
    if (!sheet) throw new Error('Sheet GID "' + Config.ROLES_SHEET + '" not found.');
    return sheet;
  },

  normalizeHeader(header) {
    return String(header || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  },

  getColumnMap(sheet) {
    const cacheKey = sheet.getSheetId();
    if (this._columnMapCache[cacheKey]) return this._columnMapCache[cacheKey];

    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    const map = {};
    headers.forEach((header, index) => {
      const key = this.normalizeHeader(header);
      if (key) map[key] = index;
    });

    this._columnMapCache[cacheKey] = map;
    return map;
  },

  colIndex(sheet, headerName) {
    const map = this.getColumnMap(sheet);
    const key = this.normalizeHeader(headerName);
    if (!(key in map)) {
      throw new Error('Expected column "' + headerName + '" not found in sheet "' + sheet.getName() + '". Check sheet layouts.');
    }
    return map[key];
  },

  getCell(sheet, rowArray, headerName) {
    return rowArray[this.colIndex(sheet, headerName)];
  },

  setCellValue(sheet, rowNum, headerName, value) {
    const colIdx = this.colIndex(sheet, headerName) + 1;
    sheet.getRange(rowNum, colIdx).setValue(value);
  },

  buildRowByHeaders(sheet, valuesByHeader) {
    const width = sheet.getLastColumn();
    const row = new Array(width).fill('');
    Object.keys(valuesByHeader).forEach((headerName) => {
      row[this.colIndex(sheet, headerName)] = valuesByHeader[headerName];
    });
    return row;
  },

  findRowIndexByRequestId(sheet, data, requestId) {
    for (let i = 1; i < data.length; i++) {
      if (String(this.getCell(sheet, data[i], 'Request ID')).trim() === String(requestId).trim()) {
        return i;
      }
    }
    return -1;
  },

  updateResponseRow(requestId, updateObj) {
    const lock = LockService.getScriptLock();
    try {
      if (!lock.tryLock(10000)) {
        throw new Error('Server too busy. Please try submitting again in a moment.');
      }

      const sheet = this.getSheetByGid(Config.MAIN_SHEET);
      const data = sheet.getDataRange().getValues();
      const i = this.findRowIndexByRequestId(sheet, data, requestId);
      if (i === -1) throw new Error('Request ID ' + requestId + ' was not found.');

      const rowNum = i + 1;
      Object.keys(updateObj).forEach((header) => {
        this.setCellValue(sheet, rowNum, header, updateObj[header]);
      });

      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }
  },

  appendEmailLog(requestId, subject, recipient, cc) {
    try {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) return;

      try {
        const sheet = this.getSheetByGid(Config.MAIN_SHEET);
        const data = sheet.getDataRange().getValues();
        const i = this.findRowIndexByRequestId(sheet, data, requestId);
        
        if (i === -1) {
          console.warn("Could not find Request ID for email logging: " + requestId);
          return;
        }

        const recipientText = cc ? `${recipient} (cc: ${cc})` : recipient;
        const now = new Date();
        const formattedTimestamp = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        const logEntry = `[${subject}] - to: ${recipientText} - ${formattedTimestamp}`;

        const rowNum = i + 1;
        const existingLogs = this.getCell(sheet, data[i], 'Email Notification Logs') || '';
        const updatedLogs = existingLogs ? existingLogs + "\n" + logEntry : logEntry;

        this.setCellValue(sheet, rowNum, 'Email Notification Logs', updatedLogs);
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
    } catch (err) {
      console.error("Failed to write email notification logs: " + err.stack);
    }
  }
};