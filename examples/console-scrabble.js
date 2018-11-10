/*
This is an example to run the scrabble game without a server (Two players on same console).
This example was made solely for debugging purposes and as example for how to use the Scrabble game class.
To run this example, enter 'node ./examples/console-scrabble.js [seed]' from the project folder.
seed [optional, default=''] is the random seed for the scrabble game (used for shuffling the bag).

In each turn, you can choose one of 3 Actions:
- PASS
- EXCHANGE [Tiles] where tiles must contain at least one tile and each tile is written in Uppercase (Blank is an Underscore)
- PLAY [Column] [Row] [Direction] [Tiles] [Score] where:
-- Column and Row is where to put the first tile. Column can be a letter from A to O and Row can be a number from 1 to 15
-- Direction defines where the remaining tiles will be placed relative to the first tile and it can R for Right or D for Down
-- Tiles are the placed tile and can be a letter from A-Z (or a-z if the tile is originally a blank).
-- Score is the number of points gathered by this move

After a PLAY is made, you must reply with one of the following:
- OK to approve his move
- CHALLENGE to challenge his move
If the challenge period ends before you choose a reply, it will be considered an approval.
*/

const _ = require('lodash');
const readline = require('readline');
const Scrabble = require('../main/scrabble');
const config = require('../config.json');
const { MessageTypes } = require('../main/utils/communication-enums');
const { timeformat } = require('../main/utils/time');

// Parse Tiles from user input to send with EXCHANGE (Tile-Format-1)
function parseTiles(input) {
  return _.map(_.padEnd(input, 7, '.'), (tile) => {
    if (tile === '.') return 0;
    if (tile === '_') return 100;
    return tile.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
  });
}

// Parse Tiles from user input to send with PLAY (Tile-Format-2)
function parsePlayableTiles(input) {
  return _.map(_.padEnd(input, 7, '.'), (tile) => {
    if (tile === '.') return 0;
    let code = tile.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    if (tile.toLowerCase() === tile) code += 100;
    return code;
  });
}

// Console interface to read user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'SCRABBLE> ',
});

// Forward declaration of Game variable
let game;

// Display game end info
function displayGameEnd() {
  const { scores } = game.getCurrentInfo();
  console.log(`\nPlayer 1: ${scores[0]}\nPlayer 2: ${scores[1]}`);
  if (scores[0] > scores[1]) {
    console.log('Player 1 won');
  } else if (scores[1] > scores[0]) {
    console.log('Player 2 won');
  } else {
    console.log('Draw');
  }
  console.log('GG!');
}

// Start a game instance
game = new Scrabble(config, {
  timeoutCallback: () => {
    // When time is out, end game and display results
    console.log('Time Out');
    game.end();
    displayGameEnd();
    process.exit(0);
  },
  challengeTimeoutCallback: () => {
    // When challenge time is out, automatically default to NO_CHALLENGE
    console.log('Challenge time Out');
    game.challengeTimer.stop(); // Stop challenge timer
    const move = { type: MessageTypes.NO_CHALLENGE };
    const result = game.apply(move);
    console.log(game.toString());
    game.timer.pause(); // Unpause game timer
    if (result.end) {
      // If tiles are finished, end game
      console.log('Tiles Finished');
      game.end();
      displayGameEnd();
      process.exit(0);
    } else {
      rl.prompt();
    }
  },
});

game.start(process.argv[2] || ''); // Start game with the random seed given by the user if any
console.log(game.toString()); // Display initial game state

rl.prompt();

// Register a callback for user input
rl.on('line', (line) => {
  // Split input into command parameter
  const command = line.trim().split(/\s+/);
  let move = null;
  // Check command type and create a move accordingly
  switch (command[0].toLowerCase()) {
    case 'ok':
      console.log('ok!');
      move = { type: MessageTypes.NO_CHALLENGE };
      break;
    case 'challenge':
      console.log('challenge!');
      move = { type: MessageTypes.CHALLENGE };
      break;
    case 'pass':
      console.log('pass!');
      move = { type: MessageTypes.PASS };
      break;
    case 'exchange': {
      console.log('exchange!');
      const tiles = parseTiles(command[1]);
      move = { type: MessageTypes.EXCHANGE, tiles };
      break;
    }
    case 'play': {
      console.log('play!');
      const col = command[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
      const row = +command[2];
      const dir = command[3].toLowerCase() === 'd' ? 1 : 0;
      const tiles = parsePlayableTiles(command[4]);
      const score = +command[5];
      move = {
        type: MessageTypes.PLAY,
        col,
        row,
        dir,
        tiles,
        score,
      };
      break;
    }
    default:
      console.log('Unknown command');
      break;
  }
  // If move is null, then the command was unknown, so do nothing
  if (move != null) {
    if (
      move.type === MessageTypes.NO_CHALLENGE
      || move.type === MessageTypes.CHALLENGE
    ) {
      game.challengeTimer.stop(); // If this is a PLAY reply, stop the challenge timer
    } else {
      game.timer.pause(); // If this is a PASS, EXCHANGE or PLAY, pause the game timer
    }
    const result = game.apply(move);
    if (result.valid) {
      console.log(game.toString());
      if (move.type === MessageTypes.PLAY) {
        // If this is a PLAY, display invalid words if any
        if (result.invalidWords.length > 0) {
          result.invalidWords.forEach((word) => {
            console.log(
              `INVALID WORD: ${word.word} (${String.fromCharCode(
                65 + word.col - 1,
              )
                + word.row.toString()
                + (word.dir ? 'D' : 'R')})`,
            );
          });
        }
        // If this is a PLAY, start the challenge timer
        console.log(`You have ${timeformat(game.challengeTimespan)} to challenge or approve`);
        game.challengeTimer.start(game.challengeTimespan);
      } else {
        // If this is not a PLAY, unpause the game timer
        game.timer.pause();
      }
      if (result.end) {
        // If tiles are finished, end the game
        console.log('Tiles Finished');
        game.end();
        displayGameEnd();
        process.exit(0);
      }
    } else {
      console.log(`Invalid Move: ${result.reason}`);
      // If move is invalid, unpause the game timer
      game.timer.pause();
    }
  }
  rl.prompt();
}).on('close', () => {
  console.log('Goodbye!'); // Remember to say goodbye to the user before quitting :D
  process.exit(0);
});
