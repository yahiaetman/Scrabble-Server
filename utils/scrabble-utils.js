const _ = require('lodash');

const Squares = {
    NORMAL: 0,
    DOUBLE_LETTER: 1,
    TRIPLE_LETTER: 2,
    DOUBLE_WORD: 3,
    TRIPLE_WORD: 4
}

const Directions = {
    left: {row: 0, col: -1},
    right: {row: 0, col: 1},
    down: {row: 1, col: 0},
    up: {row: -1, col: 0}
}

const add = (p,d) => ({row: p.row+d.row, col: p.col+d.col});

const tileNames = _.concat(['_'], _.map(_.range(26), x => String.fromCharCode(65 + x)));
const tileCodes = _.concat([100], _.range(1, 27));
const tileNamesToCodes = _.zipObject(tileNames, tileCodes);
const tileCodesToNames = _.zipObject(tileCodes, tileNames);

const inBounds = p => (p.col >= 0 && p.col < 15 && p.row >= 0 && p.row < 15);

const isValidTileCode = code => ((code > 0 && code <= 26) || code == 100);
const isValidPlayableTile = code => (((code > 0 && code <= 26)) || (code > 100 && code <= 126));
const getPlayableTileOrigin = code => (code >= 100? 100 : code);
const getPlayableTileLetter = code => (code >= 100? code - 100 : code);
const isTileBlank = code => (code >= 100);

const convertPlayableTileToString = function(tile) {
    if(tile == 0) return '.';
    let letter = tileCodesToNames[getPlayableTileLetter(tile)];
    if(isTileBlank(tile))
        letter = letter.toLowerCase();
    return letter;
};

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

    removeFromHand(tiles, rack) {
        let valid = true;
        _.each(tiles, tile => {
            rack[tile] = _.get(rack, tile, 0) - 1;
            if(rack[tile] < 0) valid = false;
        });
        return valid;
    },
    
    addToHand(tiles, rack) {
        _.each(tiles, tile => {
            rack[tile] = _.get(rack, tile, 0) + 1;
        });
    },
    
    shuffle: (bag, prng) => _.map(_.sortBy(_.map(bag, tile => ({tile: tile, order: prng.int32()})), entry => entry.order), entry => entry.tile),
    
    updateBoard(tiles, position, dir, board) {
        let forward = dir?Directions.down:Directions.right;
        let word = [];
        for(let index = 0; index < tiles.length;){
            if(!inBounds(position)) return null;
            if(board[position.row][position.col]) {
                word.push({
                    tile: board[position.row][position.col],
                    src: 'board',
                    position: position
                });
            } else {
                board[position.row][position.col] = tiles[index];
                word.push({
                    tile: board[position.row][position.col],
                    src: 'rack',
                    position: position
                });
                index++;
            }
            position = add(forward, position);
        }
        return word
    },

    expandWord(word, dir, board) {
        let forward = dir?Directions.down:Directions.right;
        let backward = dir?Directions.up:Directions.left;
        let position = add(backward, word[0].position);
        while(true) {
            if(!inBounds(position)) break;
            let tile = board[position.row][position.col]
            if(tile == 0) break;
            word.unshift({
                tile: tile,
                src: 'board',
                position: position
            });
            position = add(backward, position);
        }
        position = add(forward, word[word.length-1].position);
        while(true) {
            if(!inBounds(position)) break;
            let tile = board[position.row][position.col]
            if(tile == 0) break;
            word.push({
                tile: tile,
                src: 'board',
                position: position
            });
            position = add(forward, position);
        }
        return word;
    },

    calculateScore(words, design, tileScores){
        let score = 0;
        for (let word of words) {
            let wordMultiplier = 1;
            let wordScore = 0;
            for (const letter of word) {
                let tile = letter.tile;
                let tileScore = tile>100?0:tileScores[tile];
                let squareType = design[letter.position.row][letter.position.col];
                switch (squareType) {
                    case Squares.DOUBLE_LETTER:
                        tileScore *= 2;       
                        break;
                
                    case Squares.TRIPLE_LETTER:
                        tileScore *= 3;       
                        break;

                    case Squares.DOUBLE_WORD:
                        wordMultiplier *= 2;       
                        break;
                    
                    case Squares.TRIPLE_WORD:
                        wordMultiplier *= 3;       
                        break;
                }
                wordScore += tileScore;
            }
            score += wordScore * wordMultiplier;
        }
        return score;
    },

    convertBoardToString(board){
        let boardStr = _.map(board, (row, index) => (index+1).toString().padStart(2,'0') + _.map(row, convertPlayableTileToString).join(' ') + (index+1).toString().padStart(2,'0')).join('\n');
        boardStr = '  A B C D E F G H I J K L M N O  \n' + boardStr + '\n  A B C D E F G H I J K L M N O  ';
        return boardStr;
    },

    convertHandToString(rack){
        return _.flatten(_.map(_.sortBy(_.keys(rack)), tile => _.times(rack[tile], _.constant(tileCodesToNames[tile])))).join();
    },

    convertRawTilesToString(tiles){
        return _.map(_.filter(tiles, tile => tile!=0), tile => tileCodesToNames[tile]).join();
    },

    convertPlayedTilesToString(tiles){
        return _.map(_.filter(tiles, tile => tile!=0), tile => convertPlayableTileToString(tile)).join();
    }
}

module.exports = ScrabbleUtils;