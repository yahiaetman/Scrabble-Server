const { timeparse, timeformat } = require('../utils/time');

describe('Time Parse Tests', () => {
  test('SS only string', () => {
    expect(timeparse('12')).toBe(12 * 1000);
  });

  test('Negative SS Only string', () => {
    expect(timeparse('-12')).toBe(-12 * 1000);
  });

  test('MM:SS string', () => {
    expect(timeparse('1:12')).toBe((1 * 60 + 12) * 1000);
  });

  test('Negative MM:SS Only string', () => {
    expect(timeparse('-1:12')).toBe(-(1 * 60 + 12) * 1000);
  });

  test('MM:SS with 0 minutes string', () => {
    expect(timeparse('00:12')).toBe(12 * 1000);
  });

  test('Negative MM:SS with 0 minutes string', () => {
    expect(timeparse('-00:12')).toBe(-12 * 1000);
  });

  test('SS.mmmm string', () => {
    expect(timeparse('5.1')).toBe(5 * 1000 + 100);
  });

  test('Negative SS.mmmm string', () => {
    expect(timeparse('-5.1')).toBe(-(5 * 1000 + 100));
  });

  test('SS.mmmm with long mmmm string', () => {
    expect(timeparse('5.1234')).toBe(5 * 1000 + 123);
  });

  test('Negative SS.mmmm with long mmmm string', () => {
    expect(timeparse('-5.1234')).toBe(-(5 * 1000 + 123));
  });

  test('Full time string', () => {
    expect(timeparse('12:05.1234')).toBe((12 * 60 + 5) * 1000 + 123);
  });

  test('Negative Full time string', () => {
    expect(timeparse('-12:05.1234')).toBe(-((12 * 60 + 5) * 1000 + 123));
  });
});

describe('Time Format Test', () => {
  test('Zero time test', () => {
    expect(timeformat(0)).toBe('00:00.000');
  });

  test('Part of ms test', () => {
    expect(timeformat(0.12)).toBe('00:00.000');
  });

  test('Positive ms test', () => {
    expect(timeformat(12)).toBe('00:00.012');
  });

  test('Negative ms test', () => {
    expect(timeformat(-12)).toBe('-00:00.012');
  });

  test('Positive s:ms test', () => {
    expect(timeformat(5 * 1000 + 12)).toBe('00:05.012');
  });

  test('Negative s:ms test', () => {
    expect(timeformat(-(5 * 1000 + 12))).toBe('-00:05.012');
  });

  test('Positive m:s:ms test', () => {
    expect(timeformat((7 * 60 + 5) * 1000 + 12)).toBe('07:05.012');
  });

  test('Negative m:s:ms test', () => {
    expect(timeformat(-((7 * 60 + 5) * 1000 + 12))).toBe('-07:05.012');
  });

  test('Positive hours test', () => {
    expect(timeformat((117 * 60 + 5) * 1000 + 12)).toBe('117:05.012');
  });

  test('Negative hours test', () => {
    expect(timeformat(-((117 * 60 + 5) * 1000 + 12))).toBe('-117:05.012');
  });
});
