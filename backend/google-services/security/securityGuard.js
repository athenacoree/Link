/**
 * Security Guard for Google Services Engine
 * Ensures no API secrets, private keys, passwords, or tokens leak into logs, HTML, or responses.
 */

const SECRET_KEY_PATTERNS = [
  /key/i,
  /secret/i,
  /password/i,
  /token/i,
  /private/i,
  /credential/i,
  /auth/i,
  /bearer/i
];

function maskSecret(str) {
  if (!str || typeof str !== 'string') return str;
  if (str.length <= 8) return '********';
  return str.slice(0, 4) + '...' + str.slice(-4);
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSecretKey = SECRET_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSecretKey && typeof value === 'string') {
      clean[key] = maskSecret(value);
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeObject(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

module.exports = {
  maskSecret,
  sanitizeObject
};
