const assert = require('assert');

// Parse timespans from human-readable format to milliseconds
// The format is MM:SS.mmm where MM is minutes (optional), SS is seconds and mmm is milliseconds (optional)
// The format supports an optional negative sign for negative timespans
function timeparse(str) {
  const matches = /^(-)?(?:([0-9]+):)?([0-9]+)(?:.([0-9]+))?$/.exec(str.trim());
  assert.notEqual(matches, null, "Input doesn't match expected time format");
  let time = +matches[3] * 1000;
  time += matches[4] ? (+matches[4] * (1000 / (10 ** matches[4].length))) : 0;
  time += matches[2] ? (+matches[2] * 60000) : 0;
  time = matches[1] ? -time : time;
  return Math.trunc(time);
}

// Format timespans from milliseconds to human-readable format
// The format is MM:SS.mmm where MM is minutes, SS is seconds and mmm is milliseconds
// Even is minutes or milliseconds are zero, they will still appear in the format
// Minutes and seconds are always padded to two digits and milliseconds are always padded to 3 digits
// The format supports an optional negative sign for negative timespans
function timeformat(time) {
  const sign = Math.sign(time);
  const utime = Math.trunc(time * sign);
  const ms = utime % 1000;
  const s = Math.trunc(utime / 1000) % 60;
  const m = Math.trunc(utime / 60000);
  return `${sign < 0 ? '-' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

module.exports = {
  timeparse,
  timeformat,
};
