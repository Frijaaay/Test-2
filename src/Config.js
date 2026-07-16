/**
 * Global Configurations and Script Property Accessors
 */

function testLogEmails() {
  Logger.log(Config.getApproverEmail());
  Logger.log(Config.getAppUrl());
  Logger.log(Config.getAuthUrl());
  Logger.log(Config.getFinalNotifCcEmail());
}

const Config = {
  ENV: 'live',

  // Script Cache Version Namespace (Busts cache globally when incremented) [2.5]
  CACHE_VERSION: this.ENV === 'dev_1_0' ? 'dev' : PropertiesService.getScriptProperties().getProperty('CACHE_VER') || 'prod_1_0',

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
    return this.ENV === 'dev' ? 'jay.cortez+mallet@convergeict.com' : PropertiesService.getScriptProperties().getProperty('APPROVERS_EMAIL');
  },
  getFinalNotifCcEmail() {
    return this.ENV === 'dev' ? 'jay.cortez+bryan@convergeict.com, jay.cortez+pm@convergeict.com' : PropertiesService.getScriptProperties().getProperty('FINAL_NOTIF_CC_EMAIL');
  },

  getSecretKey() { 
    return PropertiesService.getScriptProperties().getProperty('SECRET_KEY'); 
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