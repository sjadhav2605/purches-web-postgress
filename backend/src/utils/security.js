import crypto from 'crypto';

/**
 * Returns secret salt used for signing external vendor quote links.
 * Requires process.env.QUOTE_SIGNATURE_SALT (no fallback).
 */
const getQuoteSecret = () => {
  const salt = process.env.QUOTE_SIGNATURE_SALT;
  if (!salt) {
    throw new Error('FATAL: QUOTE_SIGNATURE_SALT environment variable is required');
  }
  return salt;
};

/**
 * Generates a 16-character HMAC signature for an RFQ and Vendor pair.
 * Ensures that external quote links cannot be forged or tampered with.
 *
 * @param {number|string} rfqId 
 * @param {number|string} vendorId 
 * @returns {string} 16-character hex signature
 */
export const generateQuoteSignature = (rfqId, vendorId) => {
  if (!rfqId || !vendorId) return '';
  return crypto
    .createHmac('sha256', getQuoteSecret())
    .update(`${String(rfqId)}:${String(vendorId)}`)
    .digest('hex')
    .substring(0, 16);
};

/**
 * Validates whether the given signature matches the (rfqId, vendorId) pair
 * using timingSafeEqual to protect against timing attacks.
 *
 * @param {number|string} rfqId 
 * @param {number|string} vendorId 
 * @param {string} sig 
 * @returns {boolean}
 */
export const verifyQuoteSignature = (rfqId, vendorId, sig) => {
  if (!rfqId || !vendorId || !sig || typeof sig !== 'string') return false;
  const expected = generateQuoteSignature(rfqId, vendorId);
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
};

/**
 * Generates a 16-character HMAC signature for a PO and Vendor pair.
 * Ensures that external delivery schedule links cannot be forged or tampered with.
 *
 * @param {number|string} poId 
 * @param {number|string} vendorId 
 * @returns {string} 16-character hex signature
 */
export const generatePoSignature = (poId, vendorId) => {
  if (!poId || !vendorId) return '';
  return crypto
    .createHmac('sha256', getQuoteSecret())
    .update(`po:${String(poId)}:${String(vendorId)}`)
    .digest('hex')
    .substring(0, 16);
};

/**
 * Validates whether the given signature matches the (poId, vendorId) pair
 * using timingSafeEqual to protect against timing attacks.
 *
 * @param {number|string} poId 
 * @param {number|string} vendorId 
 * @param {string} sig 
 * @returns {boolean}
 */
export const verifyPoSignature = (poId, vendorId, sig) => {
  if (!poId || !vendorId || !sig || typeof sig !== 'string') return false;
  const expected = generatePoSignature(poId, vendorId);
  if (sig.length !== expected.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(sig, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
};

/**
 * Whitelist of safe document file extensions allowed for vendor KYC uploads.
 * Rejects executable, script, and HTML files (.html, .svg, .exe, .js, .php, etc.)
 */
export const ALLOWED_DOC_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
