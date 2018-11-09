const _ = require('lodash');

// Square Types.
// The numbers defined in this enum should be used to design the board in the config file
const Squares = {
  NORMAL: 0,
  DOUBLE_LETTER: 1,
  TRIPLE_LETTER: 2,
  DOUBLE_WORD: 3,
  TRIPLE_WORD: 4,
};

const Directions = {
  left: { row: 0, col: -1 },
  right: { row: 0, col: 1 },
  down: { row: 1, col: 0 },
  up: { row: -1, col: 0 },
};

// Utility function to move a position on step in a certain direction
const add = (p, d) => ({ row: p.row + d.row, col: p.col + d.col });

// Tile names include _ and A-Z
const tileNames = _.concat(
  ['_'],
  _.map(_.range(26), x => String.fromCharCode('A'.charCodeAt(0) + x)),
);
// Tile codes include 100 and 1-26 (Format-1)
const tileCodes = _.concat([100], _.range(1, 27));
// Two dictionaries: one to convert tile names to codes and vice versa
const tileNamesToCodes = _.zipObject(tileNames, tileCodes);
const tileCodesToNames = _.zipObject(tileCodes, tileNames);

// Utility function to check if a position is in board bounds
const inBounds = (p, size) => p.col >= 0 && p.col < size.columns && p.row >= 0 && p.row < size.rows;

// Checks if tile code (Format-1) is valid (must be either 100 or between 1 and 26)
const isValidTileCode = code => (code > 0 && code <= 26) || code === 100;
// Checks if playable tile code (Format-2) is valid (must be either between 1 and 26 or between 101 and 126)
const isValidPlayableTile = code => (code > 0 && code <= 26) || (code > 100 && code <= 126);
// Takes a playable tile and returns the original tile code
const getPlayableTileOrigin = code => (code >= 100 ? 100 : code);
// Returns the played letter (both 1-26 and 101-126 maps to A-Z)
const getPlayableTileLetter = code => (code >= 100 ? code - 100 : code);
// Checks if a tile (Format-1 or Format-2) is a blank tile
const isTileBlank = code => code >= 100;

// Converts a playable tile to a string (1-26 to A-Z, 101-126 to a-z and 0 to .)
function convertPlayableTileToString(tile) {
  if (tile === 0) return '.';
  let letter = tileCodesToNames[getPlayableTileLetter(tile)];
  if (isTileBlank(tile)) letter = letter.toLowerCase();
  return letter;
}

const ScrabbleUtils = {
  Squares,
  tileNames,
  tileCodes,
  tileNamesToCodes,
  tileCodesToNames,

  inBounds,

  isValidTileCode,
  isValidPlayableTile,
  getPlayableTileOrigin,
  getPlayableTileLetter,
  isTileBlank,
  convertPlayableTileToString,

  // Removes a list of tiles from a rack and returns false if the rack didn't contain the sent tiles
  removeFromRack(tiles, rack) {
    let valid = true;
    _.each(tiles, (tile) => {
      const newCount = _.get(rack, tile, 0) - 1;
      if (newCount < 0) {
        valid = false;
        return false;
      }
      if (newCount === 0) _.unset(rack, tile);
      // This is done to compact the rack object size (no more zero values)
      else rack[tile] = newCount;
      return true;
    });
    return valid;
  },

  // Add a list of tiles to a rack
  addToRack(tiles, rack) {
    _.each(tiles, (tile) => {
      rack[tile] = _.get(rack, tile, 0) + 1;
    });
  },

  // This function, given a random number generator, shuffles the given list
  shuffle: (bag, rng) => _.map(
    _.sortBy(
      _.map(bag, tile => ({
        tile,
        order: rng(),
      })),
      entry => entry.order,
    ),
    entry => entry.tile,
  ),

  // Add a PLAY move to a board and returns the unexpanded major word
  // For example, if the player add p,r to s.a.k to create 'spark',
  // then this function will return 'par'.
  // Use 'expandWord' in the same direction to get the remaining letters to create 'spark'
  updateBoard(tiles, startPosition, dir, board, size) {
    const forward = dir ? Directions.down : Directions.right;
    const word = [];
    let position = startPosition;
    for (let index = 0; index < tiles.length;) {
      if (!inBounds(position, size)) return null; // If the position goes out of bounds, then this update is not possible.
      if (board[position.row][position.col]) {
        // If the current square has a tile, do not overwrite it and add it to our word.
        word.push({
          tile: board[position.row][position.col],
          src: 'board', // We mark where each letter in our word came from to test if the move is valid
          position,
        });
      } else {
        // If the current square is empty, overwrite it and add it to our word.
        board[position.row][position.col] = tiles[index];
        word.push({
          tile: board[position.row][position.col],
          src: 'rack',
          position,
        });
        index += 1;
      }
      position = add(forward, position);
    }
    return word;
  },

  // Given an unexpanded word, this function will expand it the given direction and return the full word
  // Read 'updateBoard' if you need to understand why we need this function
  expandWord(word, dir, board, size) {
    const forward = dir ? Directions.down : Directions.right;
    const backward = dir ? Directions.up : Directions.left;
    let position = add(backward, word[0].position);
    for (;;) {
      if (!inBounds(position, size)) break; // If we go out of bounds then we can't keep expanding in this direction
      const tile = board[position.row][position.col];
      if (tile === 0) break; // If we go reach an empty then we can't keep expanding in this direction
      // Add this tile to the beginning of the word
      word.unshift({
        tile,
        src: 'board',
        position,
      });
      position = add(backward, position);
    }
    position = add(forward, word[word.length - 1].position);
    for (;;) {
      if (!inBounds(position, size)) break; // If we go out of bounds then we can't keep expanding in this direction
      const tile = board[position.row][position.col];
      if (tile === 0) break; // If we go reach an empty then we can't keep expanding in this direction
      // Add this tile to the end of the word
      word.push({
        tile,
        src: 'board',
        position,
      });
      position = add(forward, position);
    }
    return word;
  },

  // Given a list of word, the board design and tile scores, calculate the word score
  // Note: this function doesn't calculate the bingo points
  calculateScore(words, design, tileScores) {
    let score = 0;
    words.forEach((word) => {
      let wordMultiplier = 1;
      let wordScore = 0;
      word.forEach((letter) => {
        const { tile } = letter;
        let tileScore = tile > 100 ? 0 : tileScores[tile]; // If tile is blank, then its score is 0
        const squareType = design[letter.position.row][letter.position.col];
        switch (squareType) {
          // Double and Triple Letter Squares only affect the current tile
          case Squares.DOUBLE_LETTER:
            tileScore *= 2;
            break;
          case Squares.TRIPLE_LETTER:
            tileScore *= 3;
            break;
          // Double and Triple Letter Squares affect the whole word
          case Squares.DOUBLE_WORD:
            wordMultiplier *= 2;
            break;
          case Squares.TRIPLE_WORD:
            wordMultiplier *= 3;
            break;
          default:
            break;
        }
        wordScore += tileScore;
      });
      score += wordScore * wordMultiplier;
    });
    return score;
  },

  // Format the board as a string
  convertBoardToString(board) {
    if (board.length === 0) return '';
    let boardStr = _.map(
      board,
      (row, index) => (index + 1).toString().padStart(2, '0')
        + _.map(row, convertPlayableTileToString).join(' ')
        + (index + 1).toString().padStart(2, '0'),
    ).join('\n');
    const header = _.map(_.range(board[0].length), index => String.fromCharCode(index + 'A'.charCodeAt(0))).join(' ');
    boardStr = `  ${header}  \n${boardStr}\n  ${header}  `;
    return boardStr;
  },

  // Format Rack as a string
  convertRackToString(rack) {
    return _.flatten(
      _.map(_.keys(rack).sort(), tile => _.times(rack[tile], _.constant(tileCodesToNames[tile]))),
    ).join();
  },

  // Format Tile Code List (Format-1) as a string
  convertTilesToString(tiles) {
    return _.map(
      _.filter(tiles, tile => tile !== 0),
      tile => tileCodesToNames[tile],
    ).join();
  },

  // Format Playable Tile List (Format-2) as a string
  convertPlayableTilesToString(tiles) {
    return _.map(_.filter(tiles, tile => tile !== 0), tile => convertPlayableTileToString(tile)).join();
  },
};

module.exports = ScrabbleUtils;
