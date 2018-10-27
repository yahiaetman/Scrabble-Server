const assert = require('assert');

const timeparse = function(str){
    let matches = /^(-)?(?:([0-9]+):)?([0-9]+)(?:.([0-9]+))?$/.exec(str.trim());
    assert.notEqual(matches, null, "Input doesn't match expected time format");
    let time = +matches[3] * 1000;
    time += matches[4]?(+matches[4] * (1000 / Math.pow(10, matches[4].length))):0;
    time += matches[2]?(+matches[2] * 60000):0;
    time = matches[1]?-time:time;
    return Math.trunc(time);
}

const timeformat = function(time){
    let sign = Math.sign(time);
    time = Math.trunc(time * sign);
    let ms = time%1000;
    let s = Math.trunc(time/1000)%60;
    let m = Math.trunc(time/60000);
    return `${sign<0?'-':''}${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}.${ms.toString().padStart(3,'0')}`
}

module.exports = {
    timeparse: timeparse,
    timeformat: timeformat
}