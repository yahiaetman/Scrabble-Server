const _ = require('lodash');
const seedrandom = require('seedrandom');
const ScrabbleUtils = require('../main/utils/scrabble-utils');

describe('Rack Tests', () => {
  test('Adding letters to empty rack', () => {
    const rack = {};
    ScrabbleUtils.addToRack([10, 10, 20, 1, 100], rack);
    expect(rack).toEqual({
      10: 2,
      20: 1,
      1: 1,
      100: 1,
    });
  });

  test('Adding letters to non-empty rack', () => {
    const rack = { 10: 2, 5: 3, 26: 4 };
    ScrabbleUtils.addToRack([10, 20, 1, 100, 10], rack);
    expect(rack).toEqual({
      10: 4,
      20: 1,
      1: 1,
      100: 1,
      5: 3,
      26: 4,
    });
  });

  test('Remove letters from non-empty rack with enough tiles', () => {
    const rack = { 10: 2, 5: 3, 26: 4 };
    const ok = ScrabbleUtils.removeFromRack([10, 26, 10, 5], rack);
    expect(ok).toBeTruthy();
    expect(rack).toEqual({
      5: 2,
      26: 3,
    });
  });

  test('Remove letters from non-empty rack without enough tiles', () => {
    const rack = { 10: 1, 5: 3, 26: 4 };
    const ok = ScrabbleUtils.removeFromRack([10, 26, 10, 5], rack);
    expect(ok).toBeFalsy();
  });

  test('Remove letters from non-empty rack with missing tiles', () => {
    const rack = { 10: 1, 5: 3 };
    const ok = ScrabbleUtils.removeFromRack([10, 26, 10, 5], rack);
    expect(ok).toBeFalsy();
  });

  test('Remove letters from empty rack', () => {
    const rack = {};
    const ok = ScrabbleUtils.removeFromRack([10, 26, 10, 5], rack);
    expect(ok).toBeFalsy();
  });

  test('Remove nothing from empty rack', () => {
    const rack = {};
    const ok = ScrabbleUtils.removeFromRack([], rack);
    expect(ok).toBeTruthy();
    expect(rack).toEqual({});
  });
});

describe('Shuffle Tests', () => {
  test('shuffle always returns same order for same seed', () => {
    const seed = seedrandom();
    const list = _.range(100);
    const prng1 = seedrandom(seed);
    const shuffled1 = ScrabbleUtils.shuffle(list, () => prng1.int32());
    const prng2 = seedrandom(seed);
    const shuffled2 = ScrabbleUtils.shuffle(list, () => prng2.int32());
    expect(shuffled1).toEqual(shuffled2);
  });
});

describe('Board Update Tests', () => {
  test('Add to empty board starting from Out of bounds', () => {
    const tiles = [10, 20, 5];
    const position = { col: 3, row: 0 };
    const direction = 0;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
    expect(word).toBeNull();
  });

  test('Add to empty board in Right Direction', () => {
    const tiles = [10, 20, 5];
    const position = { col: 0, row: 0 };
    const direction = 0;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[10, 20, 5], [0, 0, 0], [0, 0, 0]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 20, src: 'rack', position: { col: 1, row: 0 } },
      { tile: 5, src: 'rack', position: { col: 2, row: 0 } },
    ]);
  });

  test('Add to empty board in Right Direction (Out of Bounds)', () => {
    const tiles = [10, 20, 5];
    const position = { col: 1, row: 0 };
    const direction = 0;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[0, 10, 20], [0, 0, 0], [0, 0, 0]]);
    expect(word).toBeNull();
  });

  test('Add to empty board in Down Direction', () => {
    const tiles = [10, 20, 5];
    const position = { col: 0, row: 0 };
    const direction = 1;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[10, 0, 0], [20, 0, 0], [5, 0, 0]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 20, src: 'rack', position: { col: 0, row: 1 } },
      { tile: 5, src: 'rack', position: { col: 0, row: 2 } },
    ]);
  });

  test('Add to empty board in Down Direction (Out of Bounds)', () => {
    const tiles = [10, 20, 5];
    const position = { col: 0, row: 1 };
    const direction = 1;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[0, 0, 0], [10, 0, 0], [20, 0, 0]]);
    expect(word).toBeNull();
  });

  test('Add to a non-empty board', () => {
    const tiles = [10, 20, 5];
    const position = { col: 0, row: 0 };
    const direction = 0;
    const board = [[0, 0, 0], [0, 6, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[10, 20, 5], [0, 6, 0], [0, 0, 0]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 20, src: 'rack', position: { col: 1, row: 0 } },
      { tile: 5, src: 'rack', position: { col: 2, row: 0 } },
    ]);
  });

  test('Add before a letter', () => {
    const tiles = [10, 20];
    const position = { col: 0, row: 0 };
    const direction = 0;
    const board = [[0, 0, 5], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[10, 20, 5], [0, 0, 0], [0, 0, 0]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 20, src: 'rack', position: { col: 1, row: 0 } },
    ]);
  });

  test('Add after a letter', () => {
    const tiles = [10, 20];
    const position = { col: 1, row: 0 };
    const direction = 0;
    const board = [[5, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[5, 10, 20], [0, 0, 0], [0, 0, 0]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 1, row: 0 } },
      { tile: 20, src: 'rack', position: { col: 2, row: 0 } },
    ]);
  });

  test('Add around a letter', () => {
    const tiles = [10, 20];
    const position = { col: 0, row: 0 };
    const direction = 0;
    const board = [[0, 5, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[10, 5, 20], [0, 0, 0], [0, 0, 0]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 5, src: 'board', position: { col: 1, row: 0 } },
      { tile: 20, src: 'rack', position: { col: 2, row: 0 } },
    ]);
  });

  test('Add around a letter (Out of Bounds)', () => {
    const tiles = [10, 20, 13];
    const position = { col: 0, row: 0 };
    const direction = 0;
    const board = [[0, 5, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[10, 5, 20], [0, 0, 0], [0, 0, 0]]);
    expect(word).toBeNull();
  });

  test('Add around letters', () => {
    const tiles = [10, 20, 5];
    const position = { col: 0, row: 1 };
    const direction = 0;
    const board = [[0, 7, 11, 12, 0], [0, 5, 0, 6, 0], [1, 0, 0, 0, 20]];
    const size = { columns: 5, rows: 3 };
    const word = ScrabbleUtils.updateBoard(tiles, position, direction, board, size);
    expect(board).toEqual([[0, 7, 11, 12, 0], [10, 5, 20, 6, 5], [1, 0, 0, 0, 20]]);
    expect(word).toEqual([
      { tile: 10, src: 'rack', position: { col: 0, row: 1 } },
      { tile: 5, src: 'board', position: { col: 1, row: 1 } },
      { tile: 20, src: 'rack', position: { col: 2, row: 1 } },
      { tile: 6, src: 'board', position: { col: 3, row: 1 } },
      { tile: 5, src: 'rack', position: { col: 4, row: 1 } },
    ]);
  });
});

describe('Word Expand Tests', () => {
  test('Expand 1 Letter to Left-Right With Nothing Around', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 0;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down With Nothing Around', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 1;
    const board = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Left-Right With Non-surrounding letters', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 0;
    const board = [[10, 0, 20], [0, 0, 0], [13, 0, 24]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down With Non-surrounding letters', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 1;
    const board = [[10, 0, 20], [0, 0, 0], [13, 0, 24]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Left-Right With Only One Letter on the Left', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 0;
    const board = [[0, 0, 0], [10, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 10, src: 'board', position: { col: 0, row: 1 } },
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Left-Right With Only One Letter on the Right', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 0;
    const board = [[0, 0, 0], [0, 0, 10], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
      { tile: 10, src: 'board', position: { col: 2, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Left-Right With Only One Letter Upwards', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 0;
    const board = [[0, 10, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Left-Right With Only One Letter Downwards', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 0;
    const board = [[0, 0, 0], [0, 0, 0], [0, 10, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down With Only One Letter on the Left', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 1;
    const board = [[0, 0, 0], [10, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down With Only One Letter on the Right', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 1;
    const board = [[0, 0, 0], [0, 0, 10], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down With Only One Letter Upwards', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 1;
    const board = [[0, 10, 0], [0, 0, 0], [0, 0, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 10, src: 'board', position: { col: 1, row: 0 } },
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down With Only One Letter Downwards', () => {
    let word = [
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
    ];
    const direction = 1;
    const board = [[0, 0, 0], [0, 0, 0], [0, 10, 0]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 5, src: 'rack', position: { col: 1, row: 1 } },
      { tile: 10, src: 'board', position: { col: 1, row: 2 } },
    ]);
  });

  test('Expand 1 Letter From Top-Left Corner To Right', () => {
    let word = [
      { tile: 1, src: 'rack', position: { col: 0, row: 0 } },
    ];
    const direction = 0;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 1, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 2, src: 'board', position: { col: 1, row: 0 } },
      { tile: 3, src: 'board', position: { col: 2, row: 0 } },
    ]);
  });

  test('Expand 1 Letter From Top-Left Corner To Downwards', () => {
    let word = [
      { tile: 1, src: 'rack', position: { col: 0, row: 0 } },
    ];
    const direction = 1;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 1, src: 'rack', position: { col: 0, row: 0 } },
      { tile: 4, src: 'board', position: { col: 0, row: 1 } },
      { tile: 7, src: 'board', position: { col: 0, row: 2 } },
    ]);
  });

  test('Expand 1 Letter From Bottom-Left Corner To Right', () => {
    let word = [
      { tile: 7, src: 'rack', position: { col: 0, row: 2 } },
    ];
    const direction = 0;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 7, src: 'rack', position: { col: 0, row: 2 } },
      { tile: 8, src: 'board', position: { col: 1, row: 2 } },
      { tile: 9, src: 'board', position: { col: 2, row: 2 } },
    ]);
  });

  test('Expand 1 Letter From Bottom-Left Corner To Downwards', () => {
    let word = [
      { tile: 7, src: 'rack', position: { col: 0, row: 2 } },
    ];
    const direction = 1;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 1, src: 'board', position: { col: 0, row: 0 } },
      { tile: 4, src: 'board', position: { col: 0, row: 1 } },
      { tile: 7, src: 'rack', position: { col: 0, row: 2 } },
    ]);
  });

  test('Expand 1 Letter From Top-Right Corner To Right', () => {
    let word = [
      { tile: 3, src: 'rack', position: { col: 2, row: 0 } },
    ];
    const direction = 0;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 1, src: 'board', position: { col: 0, row: 0 } },
      { tile: 2, src: 'board', position: { col: 1, row: 0 } },
      { tile: 3, src: 'rack', position: { col: 2, row: 0 } },
    ]);
  });

  test('Expand 1 Letter From Top-Right Corner To Downwards', () => {
    let word = [
      { tile: 3, src: 'rack', position: { col: 2, row: 0 } },
    ];
    const direction = 1;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 3, src: 'rack', position: { col: 2, row: 0 } },
      { tile: 6, src: 'board', position: { col: 2, row: 1 } },
      { tile: 9, src: 'board', position: { col: 2, row: 2 } },
    ]);
  });

  test('Expand 1 Letter From Bottom-Right Corner To Right', () => {
    let word = [
      { tile: 9, src: 'rack', position: { col: 2, row: 2 } },
    ];
    const direction = 0;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 7, src: 'board', position: { col: 0, row: 2 } },
      { tile: 8, src: 'board', position: { col: 1, row: 2 } },
      { tile: 9, src: 'rack', position: { col: 2, row: 2 } },
    ]);
  });

  test('Expand 1 Letter From Bottom-Right Corner To Downwards', () => {
    let word = [
      { tile: 9, src: 'rack', position: { col: 2, row: 2 } },
    ];
    const direction = 1;
    const board = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
    const size = { columns: 3, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 3, src: 'board', position: { col: 2, row: 0 } },
      { tile: 6, src: 'board', position: { col: 2, row: 1 } },
      { tile: 9, src: 'rack', position: { col: 2, row: 2 } },
    ]);
  });

  test('Expand 3 Letter to Left-Right in 7x3 board', () => {
    let word = [
      { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
      { tile: 5, src: 'board', position: { col: 3, row: 1 } },
      { tile: 20, src: 'rack', position: { col: 4, row: 1 } },
    ];
    const direction = 0;
    const board = [[0, 0, 7, 11, 12, 0, 0], [0, 8, 10, 5, 20, 4, 17], [0, 1, 15, 0, 0, 20, 0]];
    const size = { columns: 7, rows: 3 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 8, src: 'board', position: { col: 1, row: 1 } },
      { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
      { tile: 5, src: 'board', position: { col: 3, row: 1 } },
      { tile: 20, src: 'rack', position: { col: 4, row: 1 } },
      { tile: 4, src: 'board', position: { col: 5, row: 1 } },
      { tile: 17, src: 'board', position: { col: 6, row: 1 } },
    ]);
  });

  test('Expand 1 Letter to Up-Down in 7x4 board', () => {
    let word = [
      { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
    ];
    const direction = 1;
    const board = [[0, 0, 7, 11, 12, 0, 0], [0, 8, 10, 5, 20, 4, 17], [0, 1, 15, 0, 0, 20, 0], [7, 0, 0, 0, 18, 0, 0]];
    const size = { columns: 7, rows: 4 };
    word = ScrabbleUtils.expandWord(word, direction, board, size);
    expect(word).toEqual([
      { tile: 7, src: 'board', position: { col: 2, row: 0 } },
      { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
      { tile: 15, src: 'board', position: { col: 2, row: 2 } },
    ]);
  });
});

describe('Score Calculation Tests', () => {
  const scores = {
    10: 1, 20: 2, 5: 3, 100: 0,
  };
  // 0: Normal, 1: Double Letter, 2: Triple Letter, 3: Double Word, 4: Triple Word
  const design1 = [
    [2, 0, 0, 0, 2],
    [0, 1, 0, 1, 0],
    [4, 0, 3, 0, 4],
    [0, 1, 0, 1, 0],
    [2, 0, 0, 0, 2],
  ];
  const design2 = [
    [1, 0, 0, 0, 1],
    [0, 0, 1, 0, 0],
    [4, 2, 3, 2, 4],
    [0, 0, 1, 0, 0],
    [1, 0, 0, 0, 1],
  ];

  test('No Words', () => {
    const words = [];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(0);
  });

  test('Blank tiles Should be zero', () => {
    const words = [
      [
        { tile: 110, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 120, src: 'rack', position: { col: 3, row: 2 } },
        { tile: 105, src: 'board', position: { col: 4, row: 2 } },
      ],
      [
        { tile: 110, src: 'rack', position: { col: 4, row: 2 } },
        { tile: 120, src: 'rack', position: { col: 4, row: 3 } },
        { tile: 105, src: 'board', position: { col: 4, row: 4 } },
      ],
      [
        { tile: 110, src: 'rack', position: { col: 2, row: 3 } },
        { tile: 120, src: 'rack', position: { col: 3, row: 3 } },
        { tile: 105, src: 'board', position: { col: 4, row: 3 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(0);
  });

  test('Normal Squares Only', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 1, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 0 } },
        { tile: 5, src: 'board', position: { col: 3, row: 0 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(6);
  });

  test('Double Letter Only', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
        { tile: 20, src: 'rack', position: { col: 3, row: 1 } },
        { tile: 5, src: 'board', position: { col: 4, row: 1 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(8);
  });

  test('Two Double Letters (One already on board)', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 1, row: 1 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 1 } },
        { tile: 5, src: 'board', position: { col: 3, row: 1 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(7);
  });

  test('Two Double Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 1, row: 1 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 1 } },
        { tile: 5, src: 'rack', position: { col: 3, row: 1 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(10);
  });

  test('Triple Letter Only (One already on board)', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 2, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 3, row: 0 } },
        { tile: 5, src: 'board', position: { col: 4, row: 0 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(6);
  });

  test('Triple Letter Only', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 2, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 3, row: 0 } },
        { tile: 5, src: 'rack', position: { col: 4, row: 0 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(12);
  });

  test('Double Word Only', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 1, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 5, src: 'board', position: { col: 3, row: 2 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(12);
  });

  test('Triple Word Only', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 4, row: 1 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 2 } },
        { tile: 5, src: 'board', position: { col: 4, row: 3 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(18);
  });

  test('One Double Word and Two Triple Words', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 0, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 1, row: 2 } },
        { tile: 5, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 3, row: 2 } },
        { tile: 10, src: 'rack', position: { col: 4, row: 2 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(162);
  });

  test('One Double Word (Alreay on board) and Two Triple Words', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 0, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 1, row: 2 } },
        { tile: 5, src: 'board', position: { col: 2, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 3, row: 2 } },
        { tile: 10, src: 'rack', position: { col: 4, row: 2 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(81);
  });

  test('One Triple Word and Two Triple Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 4, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 1 } },
        { tile: 5, src: 'rack', position: { col: 4, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 3 } },
        { tile: 10, src: 'rack', position: { col: 4, row: 4 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(39);
  });

  test('One Triple Word (Already on Board) and Two Triple Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 4, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 1 } },
        { tile: 5, src: 'board', position: { col: 4, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 3 } },
        { tile: 10, src: 'rack', position: { col: 4, row: 4 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design1, scores);
    expect(score).toBe(13);
  });

  test('One Double Word and Two Double Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 5, src: 'rack', position: { col: 2, row: 3 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design2, scores);
    expect(score).toBe(20);
  });

  test('One Double Word and Two Double Letters (One Already on Board)', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 2, row: 1 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 5, src: 'board', position: { col: 2, row: 3 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design2, scores);
    expect(score).toBe(14);
  });

  test('One Double Word and Two Triple Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 1, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 5, src: 'rack', position: { col: 3, row: 2 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design2, scores);
    expect(score).toBe(28);
  });

  test('One Double Word and Two Triple Letters (One Already on Board)', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 1, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 2, row: 2 } },
        { tile: 5, src: 'board', position: { col: 3, row: 2 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design2, scores);
    expect(score).toBe(16);
  });

  test('One Triple Word and Two Double Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 4, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 1 } },
        { tile: 5, src: 'rack', position: { col: 4, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 3 } },
        { tile: 10, src: 'rack', position: { col: 4, row: 4 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design2, scores);
    expect(score).toBe(33);
  });

  test('One Triple Word (Already on Board) and Two Double Letters', () => {
    const words = [
      [
        { tile: 10, src: 'rack', position: { col: 4, row: 0 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 1 } },
        { tile: 5, src: 'board', position: { col: 4, row: 2 } },
        { tile: 20, src: 'rack', position: { col: 4, row: 3 } },
        { tile: 10, src: 'rack', position: { col: 4, row: 4 } },
      ],
    ];
    const score = ScrabbleUtils.calculateScore(words, design2, scores);
    expect(score).toBe(11);
  });
});

describe('Board Format Test', () => {
  test('Empty 0x0 Board', () => {
    const board = [];
    expect(ScrabbleUtils.convertBoardToString(board)).toBe('');
  });

  test('Empty 3x3 Board', () => {
    const board = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    expect(ScrabbleUtils.convertBoardToString(board)).toBe(
      '  A B C  \n01. . .01\n02. . .02\n03. . .03\n  A B C  ',
    );
  });

  test('3x3 Board containing Non-blank Tiles', () => {
    const board = [
      [0, 1, 0],
      [2, 0, 3],
      [0, 26, 0],
    ];
    expect(ScrabbleUtils.convertBoardToString(board)).toBe(
      '  A B C  \n01. A .01\n02B . C02\n03. Z .03\n  A B C  ',
    );
  });

  test('3x3 Board containing Blank Tiles', () => {
    const board = [
      [0, 101, 0],
      [102, 4, 103],
      [0, 126, 0],
    ];
    expect(ScrabbleUtils.convertBoardToString(board)).toBe(
      '  A B C  \n01. a .01\n02b D c02\n03. z .03\n  A B C  ',
    );
  });
});

describe('Tile Format Test', () => {
  test('Empty Rack Format', () => {
    const rack = {};
    expect(ScrabbleUtils.convertRackToString(rack)).toBe('');
  });

  test('Non-Empty Rack Format', () => {
    const rack = { 1: 4, 26: 1, 100: 2 };
    expect(ScrabbleUtils.convertRackToString(rack)).toBe('A,A,A,A,_,_,Z');
  });

  test('Empty Tiles Format', () => {
    const tiles = [];
    expect(ScrabbleUtils.convertTilesToString(tiles)).toBe('');
  });

  test('Non-Empty Tiles Format', () => {
    const tiles = [1, 26, 100, 26];
    expect(ScrabbleUtils.convertTilesToString(tiles)).toBe('A,Z,_,Z');
  });

  test('Empty Playable Tiles Format', () => {
    const tiles = [];
    expect(ScrabbleUtils.convertPlayableTilesToString(tiles)).toBe('');
  });

  test('Non-Empty Playable Tiles Format', () => {
    const tiles = [1, 26, 102, 26, 126];
    expect(ScrabbleUtils.convertPlayableTilesToString(tiles)).toBe('A,Z,b,Z,z');
  });
});
