/**
 * Global Configurations and Script Property Accessors
 */
const Config = {
  ENV: 'live',

  // Script Cache Version Namespace (Busts cache globally when incremented) [2.5]
  CACHE_VERSION: PropertiesService.getScriptProperties().getProperty('CACHE_VER') || 'dev1',

  // Spreadsheet Identifiers
  MAIN_SHEET: 1378952939,
  TOKENS_SHEET: 897297525,
  ROLES_SHEET: 1468599902,
  RESULT_SHEET: 112945269, 
  
  // Cache Durations
  SESSION_CACHE_TTL_SEC: 21600, // 6 Hours (Google Max)
  ROLE_CACHE_TTL_SEC: 21600,

  // Automated Notification Recipients [Slide 5/6 Alignment]
  getApproverEmail() {
    return PropertiesService.getScriptProperties().getProperty('APPROVERS_EMAIL') || 'jay.cortez+mallet@convergeict.com';
  },
  getFinalNotifCcEmail() {
    return PropertiesService.getScriptProperties().getProperty('FINAL_NOTIF_CC_EMAIL') || 'jay.cortez@convergeict.com';
  },

  getSecretKey() { 
    return PropertiesService.getScriptProperties().getProperty('SECRET_KEY') || '019ebd5b80887a40ba6fbbbcbbe546be'; 
  },
  
  getAppUrl() { 
    const props = PropertiesService.getScriptProperties();
    return this.ENV === 'dev' ? props.getProperty('APP_DEV_URL') : props.getProperty('APP_LIVE_URL');
  },
  
  getAuthUrl() {
    const props = PropertiesService.getScriptProperties();
    return this.ENV === 'dev' ? props.getProperty('AUTH_DEV') : props.getProperty('AUTH_LIVE');
  },
  
  getAppKey() { 
    return PropertiesService.getScriptProperties().getProperty('APP_KEY') || 'ERROR'; 
  }
};