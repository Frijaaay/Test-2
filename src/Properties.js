const properties = {
  'APP_DEV_URL': 'https://script.google.com/a/macros/convergeict.com/s/AKfycbzetARA4PeLusg6kpqdw9u1fQi0Ew5RL46QUJtCso8/dev',
  'APP_LIVE_URL': 'https://script.google.com/macros/s/AKfycbxas55enGSimnKOOOw-_FaKW_IgOvxwDE5xl9HZB5Uo3hiE5Aml66qOIhf0PHHiq6Wh/exec',
  'APP_KEY': '544553545f415050',
  'LOGO_URL': 'https://d2etujs75nvebv.cloudfront.net/images/converge-logo.svg',
  'FAVICON_URL': 'https://drive.google.com/uc?id=1IjfN6neiybJMOy4tdq5NYo58myrnAG4V&export=download&format=png',
  'TEST_RESULTS_FORM_URL': 'https://docs.google.com/forms/d/e/1FAIpQLSerc4dYHt1n2ioMxA-sVyjbg29S5t8RuXbrHirMF28fHPvRaw/viewform?usp=pp_url&entry.425664775=',
  'FINAL_NOTIF_CC_EMAIL': 'bryan.uy@convergeict.com',
  'TESTERS_GROUP_EMAIL': 'lifestyle.testers@convergeict.com',
  'APPROVERS_EMAIL' : 'mallet.garbida@convergeict.com',
  'ADMIN_EMAIL': 'jay.cortez@convergeict.com',
  'SECRET_KEY': '019ebd5b80887a40ba6fbbbcbbe546be',
  'AUTH_DEV': 'https://script.google.com/macros/s/AKfycbzDSmgvVsAO67qf_ehiRcm4AhCn-RjeM5i7hzKN21xO/dev',
  'AUTH_LIVE': 'https://script.google.com/macros/s/AKfycbzam58rS939RYGg8teQlsLLsiHt7KCkny4Adh1-O-I4I8gtlLoGL7n6OdOcLmntRb6akg/exec',
  'TOKEN_KEY': 'Vm0weGQxTXdNVWRYV0d4VFltdHdVRlp0TVc5V2JHeDBZM3BHYWxac1dqQlVWbU0xVm14S2MxZHViRmRXTTFKTA',
  'CACHE_VER': 'live_1_0'
};

/** Create Properties */
function createProperties() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  PropertiesService.getScriptProperties().setProperties(properties);
  console.log("Script Properties Creation Finished:" + JSON.stringify(properties, null, 2));
}

function getProps() {
  Logger.log(JSON.stringify(PropertiesService.getScriptProperties().getProperties(), null, 2));
}

function setDevProps() {
  PropertiesService.getScriptProperties().setProperties({
  'FINAL_NOTIF_CC_EMAIL': 'jay.cortez+bryan@convergeict.com, jay.cortez+pm@convergeict.com',
  'TESTERS_GROUP_EMAIL': 'lifestyle.testers@convergeict.com',
  'APPROVERS_EMAIL' : 'jay.cortez+mallet@convergeict.com',
  'ADMIN_EMAIL': 'jay.cortez@convergeict.com',
  'SECRET_KEY': '019ebd5b80887a40ba6fbbbcbbe546be',
  'CACHE_VER': 'dev_1_0'
  });
}