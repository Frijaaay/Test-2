/**
 * CacheManager.gs
 * Administrative utility helper functions executed directly from the IDE dropdown.
 */

function clearByKey() {
  const targetKey = "REPLACE_WITH_YOUR_TOKEN_HERE";
  
  if (targetKey === "REPLACE_WITH_YOUR_TOKEN_HERE") {
    Logger.log("❌ Operation Aborted: Please replace 'targetKey' with an actual token.");
    return;
  }
  
  const cache = CacheService.getScriptCache();
  cache.remove(targetKey);
  Logger.log("✅ Successfully purged key: " + targetKey);
}

function clearAllCache() {
  const cache = CacheService.getScriptCache();
  const keysToPurge = [];
  
  try {
    Logger.log("Starting global cache purge...");
    
    const tokenSheet = SheetRepository.getSheetByGid(Config.TOKENS_SHEET);
    const tokenData = tokenSheet.getDataRange().getValues();
    const tokenCol = SheetRepository.colIndex(tokenSheet, 'Token');
    const tokenEmailCol = SheetRepository.colIndex(tokenSheet, 'Email');
    
    for (let i = 1; i < tokenData.length; i++) {
      const token = String(tokenData[i][tokenCol]).trim();
      const email = String(tokenData[i][tokenEmailCol]).trim();
      
      if (token) {
        keysToPurge.push(token);
        keysToPurge.push(Config.CACHE_VERSION + '_' + token);
      }
      if (email) {
        const roleKey = Config.CACHE_VERSION + '_role_' + email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        keysToPurge.push(roleKey);
        keysToPurge.push('role_' + email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''));
      }
    }
    
    const rolesSheet = SheetRepository.getRolesSheet();
    const rolesData = rolesSheet.getDataRange().getValues();
    const roleEmailCol = SheetRepository.colIndex(rolesSheet, 'Email');
    
    for (let i = 1; i < rolesData.length; i++) {
      const email = String(rolesData[i][roleEmailCol]).trim();
      if (email) {
        const roleKey = Config.CACHE_VERSION + '_role_' + email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');
        keysToPurge.push(roleKey);
        keysToPurge.push('role_' + email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''));
      }
    }
    
    const uniqueKeys = [...new Set(keysToPurge)];
    
    if (uniqueKeys.length > 0) {
      cache.removeAll(uniqueKeys);
      Logger.log("✅ Purge Completed: Cleared " + uniqueKeys.length + " keys.");
    } else {
      Logger.log("ℹ️ No active users or tokens found inside your sheet.");
    }
    
  } catch (err) {
    Logger.log("❌ Error during clearAllCache: " + err.message);
  }
}