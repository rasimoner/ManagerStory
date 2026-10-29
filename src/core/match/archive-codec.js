const FIRST_WORD = 65537, RESET = 65536, DICTIONARY_LIMIT = 131072;
const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const SIMULATION_ARCHIVE_ENCODING = 'lzw-varint-utf16';

export function compressSimulationArchive(input) {
  const dictionary = new Map(), bytes = [];
  let phrase = '', nextWord = FIRST_WORD;
  for (let index = 0; index < input.length; index++) {
    const character = input[index], candidate = phrase + character;
    if (!phrase || dictionary.has(candidate)) { phrase = candidate; continue; }
    writeArchiveInteger(bytes, phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase));
    dictionary.set(candidate, nextWord++);
    phrase = character;
    if (nextWord === DICTIONARY_LIMIT) { writeArchiveInteger(bytes, RESET); dictionary.clear(); nextWord = FIRST_WORD; }
  }
  if (phrase) writeArchiveInteger(bytes, phrase.length === 1 ? phrase.charCodeAt(0) : dictionary.get(phrase));
  return archiveUTF16(bytes);
}

export function decompressSimulationArchive(input, encoding = SIMULATION_ARCHIVE_ENCODING) {
  const dictionary = new Map(), output = [];
  let previous = '', nextWord = FIRST_WORD;
  for (const code of readArchiveIntegers(readArchiveBytes(input, encoding))) {
    if (code === RESET) { dictionary.clear(); previous = ''; nextWord = FIRST_WORD; continue; }
    const word = code < RESET ? String.fromCharCode(code) : dictionary.get(code) ?? (code === nextWord ? previous + previous[0] : null);
    if (word == null) throw new TypeError('Corrupt simulation archive.');
    output.push(word);
    if (previous) dictionary.set(nextWord++, previous + word[0]);
    previous = word;
  }
  return output.join('');
}

function writeArchiveInteger(bytes, value) {
  while (value >= 128) { bytes.push((value & 127) | 128); value >>>= 7; }
  bytes.push(value);
}

function* readArchiveIntegers(bytes) {
  let value = 0, shift = 0;
  for (const byte of bytes) {
    value |= (byte & 127) << shift;
    if (byte & 128) { shift += 7; if (shift > 21) throw new TypeError('Corrupt archive integer.'); }
    else { yield value; value = 0; shift = 0; }
  }
  if (shift) throw new TypeError('Truncated simulation archive.');
}

function archiveUTF16(bytes) {
  const output = [String.fromCharCode(256 + (bytes.length & 32767)), String.fromCharCode(256 + (bytes.length >>> 15))];
  let value = 0, bits = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    if (bits >= 15) { bits -= 15; output.push(String.fromCharCode(256 + ((value >>> bits) & 32767))); }
  }
  if (bits) output.push(String.fromCharCode(256 + ((value << (15 - bits)) & 32767)));
  return output.join('');
}

function readArchiveBytes(input, encoding) {
  if (encoding === SIMULATION_ARCHIVE_ENCODING) return archiveUTF16Bytes(input);
  if (encoding === 'lzw-varint-base64') return archiveBytes(input);
  throw new TypeError('Unsupported simulation archive encoding.');
}

function archiveUTF16Bytes(input) {
  if (input.length < 2 || /[^\u0100-\u80ff]/.test(input)) throw new TypeError('Invalid simulation archive encoding.');
  const length = (input.charCodeAt(0) - 256) | ((input.charCodeAt(1) - 256) << 15), bytes = [];
  let value = 0, bits = 0;
  for (let index = 2; index < input.length && bytes.length < length; index++) {
    value = (value << 15) | (input.charCodeAt(index) - 256);
    bits += 15;
    while (bits >= 8 && bytes.length < length) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  if (bytes.length !== length) throw new TypeError('Truncated simulation archive.');
  return bytes;
}

function archiveBytes(input) {
  if (input.length % 4 || /[^A-Za-z0-9+/=]/.test(input)) throw new TypeError('Invalid simulation archive encoding.');
  const bytes = [];
  for (let index = 0; index < input.length; index += 4) readArchiveBase64Block(input.slice(index, index + 4), bytes);
  return bytes;
}

function readArchiveBase64Block(block, bytes) {
  const values = [...block].map(character => character === '=' ? 0 : BASE64.indexOf(character));
  const bits = (values[0] << 18) | (values[1] << 12) | (values[2] << 6) | values[3];
  bytes.push((bits >>> 16) & 255);
  if (block[2] !== '=') bytes.push((bits >>> 8) & 255);
  if (block[3] !== '=') bytes.push(bits & 255);
}
