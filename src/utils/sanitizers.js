console.log('// src/utils/sanitizers.js');
const DOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const window = new JSDOM('').window;
const purify = DOMPurify(window);

function sanitizeTextInput(input) {
  if (typeof input !== 'string') return '';
  return purify.sanitize(input.trim());
}

function validateSolanaAddress(address) {
  if (typeof address !== 'string') return false;
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

module.exports = { sanitizeTextInput, validateSolanaAddress };
