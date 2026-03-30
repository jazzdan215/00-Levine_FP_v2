/**
 * My Special Music Tools
 * @module MusicTools
 */

const TUNING_REF = 440;

/**
 * converts linear amplitude to decibels full scale
 * @param {number} amp - linear amplitude value
 * @returns {number} decibels full scale (dbFS)
 */

export function atodb(amp) {
  return 20 * Math.log10(amp);
}

/**
 * Converts decibels to linear amplitude
 * @param {number} db - decibels full scale (dbFS)
 * @returns {number} linear amplitude
 */

export function dbtoa(db) {
  return 10 ** (db / 20);
}

/**
 * mtof
 *
 */
export function mtof(midi) {
  return TUNING_REF * 2 ** ((midi - 69) / 12);
}
/**
 * ftom
 */
// export function ftom(freq)
export function ftom(freq) {
  return Math.log2(freq / TUNING_REF) * 12 + 69;
}
