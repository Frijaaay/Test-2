/**
 * Handles base64 web-safe cryptography, HMAC signature verification, and CacheService lookups.
 */
const AuthService = {
  
  base64UrlEncode(str) {
    return Utilities.base64EncodeWebSafe(str, Utilities.Charset.UTF_8).replace(/=+$/, '');
  },

  base64UrlDecode(str) {
    return Utilities.newBlob(Utilities.base64DecodeWebSafe(str)).getDataAsString();
  },

  generateBase64Hash(payload, secret) {
    const rawHmac = Utilities.computeHmacSha256Signature(payload, secret);
    return Utilities.base64EncodeWebSafe(rawHmac).replace(/=+$/, '');
  },

  verifyEnvelope(base64Id, twiceEncodedEmail, base64hash) {
    const payloadToSign = base64Id + '_' + twiceEncodedEmail;
    const expectedHash = this.generateBase64Hash(payloadToSign, Config.getSecretKey());
    return expectedHash === base64hash;
  },

  decodeEnvelopeEmail(twiceEncodedEmail) {
    const once = this.base64UrlDecode(twiceEncodedEmail);
    return this.base64UrlDecode(once);
  },

  generateHexToken(length) {
    const raw = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    return raw.substring(0, length);
  },

  getSession(token) {
    if (!token) return null;

    const cache = CacheService.getScriptCache();
    const versionedTokenKey = Config.CACHE_VERSION + '_' + token;
    
    const cachedData = cache.get(versionedTokenKey);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    const sheet = SheetRepository.getSheetByGid(Config.TOKENS_SHEET);
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (SheetRepository.getCell(sheet, data[i], 'Token') === token) {
        const email = SheetRepository.getCell(sheet, data[i], 'Email');
        const role = this.getRoleByEmail(email);
        const session = { email: email, role: role };

        cache.put(versionedTokenKey, JSON.stringify(session), Config.SESSION_CACHE_TTL_SEC);
        return session;
      }
    }
    return null;
  },

  getTokenByEmail(email) {
    if (!email) return null;
    
    const sheet = SheetRepository.getSheetByGid(Config.TOKENS_SHEET);
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (String(SheetRepository.getCell(sheet, data[i], 'Email')).toLowerCase() === email.toLowerCase()) {
        return SheetRepository.getCell(sheet, data[i], 'Token');
      }
    }
    return null; 
  },

  getRoleByEmail(email) {
    if (!email) return 'Requestor';

    const cache = CacheService.getScriptCache();
    const cacheKey = Config.CACHE_VERSION + '_role_' + email.toLowerCase().replace(/[^a-zA-Z0-9_]/g, '');

    const cachedRoles = cache.get(cacheKey);
    if (cachedRoles) return cachedRoles;

    const sheet = SheetRepository.getRolesSheet();
    const data = sheet.getDataRange().getValues();
    const roles = [];

    for (let i = 1; i < data.length; i++) {
      if (String(SheetRepository.getCell(sheet, data[i], 'Email')).toLowerCase() === email.toLowerCase()) {
        const roleValue = SheetRepository.getCell(sheet, data[i], 'Role');
        const foundRoles = String(roleValue || '').split(',').map(r => r.trim()).filter(Boolean);
        roles.push(...foundRoles);
      }
    }

    if (roles.length > 0) {
      let uniqueRoles = [...new Set(roles)];
      // If a user has other roles, the 'Requestor' role is redundant.
      // Filter it out to simplify the UI and prevent confusion.
      if (uniqueRoles.length > 1 && uniqueRoles.includes('Requestor')) {
        uniqueRoles = uniqueRoles.filter(r => r !== 'Requestor');
      }
      const rolesString = uniqueRoles.join(',');
      cache.put(cacheKey, rolesString, Config.ROLE_CACHE_TTL_SEC);
      return rolesString;
    }

    cache.put(cacheKey, 'Requestor', Config.ROLE_CACHE_TTL_SEC);
    return 'Requestor';
  }
};