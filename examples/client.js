/*
This is a sample client that follows the Scrabble Communication Protocol for CMP402 Fall-2018 Course Project.
The client allows the user the play scrabble through the console.
To run the client, enter 'node ./examples/client.js [name] [port] [host]' from the project folder.
name [optional] is the player name which will be sent and displayed on the server UI.
port [optional, default=8080] is the port to which the server listens.
host [optional, default=127.0.0.1] is the server io address.

After running the client, wait till the server starts the game.
On your turn, you can choose one of 3 Actions:
- PASS
- EXCHANGE [Tiles] where tiles must contain at least one tile and each tile is written in Uppercase (Blank is an Underscore)
- PLAY [Column] [Row] [Direction] [Tiles] [Score] where:
-- Column and Row is where to put the first tile. Column can be a letter from A to O and Row can be a number from 1 to 15
-- Direction defines where the remaining tiles will be placed relative to the first tile and it can R for Right or D for Down
-- Tiles are the placed tile and can be a letter from A-Z (or a-z if the tile is originally a blank).
-- Score is the number of points gathered by this move

When your opponent chooses to PLAY, you must reply with one of the following:
- OK to approve his move
- CHALLENGE to challenge his move
If the challenge period ends before you send a reply, it will be considered an approval.

You can quit the game at any time by pressing Ctrl+C
*/

const _ = require('lodash');
const readline = require('readline');
const WebSocket = require('ws');
const Structs = require('../main/utils/structs');
const ScrabbleUtils = require('../main/utils/scrabble-utils');
const { MessageTypes, EndReasons } = require('../main/utils/communication-enums');
const { timeformat } = require('../main/utils/time');

// An enum with all possible states
const States = {
  INIT: 0,
  READY: 1,
  IDLE: 2,
  THINKING: 3,
  AWAIT_EXCHANGE_RESPONSE: 4,
  AWAIT_PLAY_RESPONSE: 5,
  AWAIT_AGENT_CHALLENGE: 6,
  AWAIT_CHALLENGE_RESPONSE: 7,
};

// The following enum is used for display purposes
const StatesNames = {
  [States.INIT]: 'Initializing',
  [States.READY]: 'Ready',
  [States.IDLE]: 'Idle',
  [States.THINKING]: 'Thinking',
  [States.AWAIT_EXCHANGE_RESPONSE]: 'Await Exchange Response',
  [States.AWAIT_PLAY_RESPONSE]: 'Await Play Response',
  [States.AWAIT_AGENT_CHALLENGE]: 'Await Agent Challenge',
  [States.AWAIT_CHALLENGE_RESPONSE]: 'Await Challenge Response',
};

const size = { rows: 15, columns: 15 }; // Board size
const history = []; // Game history
let current = { board: null, rack: null }; // Current game state
let state = States.INIT; // Current client state

const name = process.argv[2] || `Client${process.pid}`; // Player name
const port = process.argv[3] || '8080'; // Server port
const host = process.argv[4] || '127.0.0.1'; // Server IP Address

// Console interface to read user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `${name}> `,
});

rl.prompt(); // promt function just outputs '[name]>' to the user

// Utility function to display time info received from server
function displayTime(info) {
  console.log(`Your Time: ${timeformat(info.time)}`);
  console.log(`Total Time: ${timeformat(info.total)}`);
}

// Utility function to display score info received from server
function displayScore(info) {
  console.log(`Your Score: ${info.score}`);
  console.log(`Opponent Score: ${info.opponent}`);
}

// Utility function to display current game state
function displayCurrentGameState() {
  console.log(ScrabbleUtils.convertBoardToString(current.board));
  console.log(`your rack: ${ScrabbleUtils.convertRackToString(current.rack)}`);
}

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
    let code = tile.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0) + 1;
    if (tile.toLowerCase() === tile) code += 100;
    return code;
  });
}

// Create Websocket client
const ws = new WebSocket(`ws://${host}:${port}`);

// Register a callback to process messages received from the server
ws.on('message', (data) => {
  // Display received buffer as a array of number for debugging purposes
  console.log(`Received Buffer: ${[...data]}`);
  // END is processed despite our current state
  if (data[0] === MessageTypes.END) {
    console.log('Game Ended');
    const info = Structs.EndStruct.unpack(data);
    // Display the reason for ending the game
    let cleanEnd = true;
    if (info.reason === EndReasons.ALL_TILES_USED) {
      console.log('All tiles used');
    } else if (info.reason === EndReasons.TIME_ENDED) {
      console.log('Time ended');
    } else if (info.reason === EndReasons.STOP_BUTTON_PRESSED) {
      console.log('Stop button pressed');
      cleanEnd = false;
    } else if (info.reason === EndReasons.CONNECTION_ERROR) {
      console.log('Connection');
      cleanEnd = false;
    }
    // If the game ended naturally, display results
    if (cleanEnd) {
      console.log(`Your score: ${info.score}`);
      console.log(`Opponent score: ${info.opponent}`);
      if (info.score > info.opponent) {
        console.log('You Won');
      } else if (info.score < info.opponent) {
        console.log('You Lost');
      } else {
        console.log("It's a draw");
      }
    }
    state = States.READY;
    console.log(`Curent State: ${StatesNames[state]}`);
    rl.prompt();
    return;
  }
  if (state === States.INIT) {
    if (data[0] === MessageTypes.NAME) {
      // After receiving a NAME message, the client must reply with their name
      console.log('Server Requested your name! Stay tuned for the game...');
      ws.send(
        Buffer.concat([Buffer.from([MessageTypes.NAME]), Buffer.from(name)]),
      );
      state = States.READY;
    }
  } else if (state === States.READY) {
    if (data[0] === MessageTypes.START) {
      // The game now has started. Read the initial state from the message
      const info = Structs.StartStruct.unpack(data);
      current.board = _.chunk(info.board, 15);
      current.rack = _.countBy(info.tiles);
      history.length = 0;
      history.push(current);
      console.log('Game Start');
      displayScore(info);
      displayTime(info);
      displayCurrentGameState();
      if (info.order === 1) {
        // If order is 1, then it is this client's turn now
        console.log('It is your turn now');
        state = States.THINKING;
      } else {
        // otherwise, wait for your turn
        state = States.IDLE;
      }
    }
  } else if (state === States.IDLE) {
    if (data[0] === MessageTypes.PASS) {
      console.log('Opponent Passed. Your turn');
      const info = Structs.TypeWithTimeStruct.unpack(data);
      displayTime(info);
      state = States.THINKING;
    } else if (data[0] === MessageTypes.EXCHANGE) {
      console.log('Opponent Exchanged Their Tiles. Your turn');
      const info = Structs.TypeWithCountAndTimeStruct.unpack(data);
      console.log(`${info.count} Tiles(s) Exchanged`);
      displayTime(info);
      state = States.THINKING;
    } else if (data[0] === MessageTypes.PLAY) {
      console.log('Opponent Played his tiles. Your turn');
      const info = Structs.PlayWithTimeStruct.unpack(data);
      displayTime(info);
      history.push(current); // Push current state before updating the board
      // NOTE: there is a possibility that we will go back to a past state if a challenge is accepted
      current = _.cloneDeep(current);
      ScrabbleUtils.updateBoard(
        _.filter(info.tiles, tile => tile !== 0),
        { col: info.col - 1, row: info.row - 1 },
        info.dir,
        current.board,
        size,
      );
      displayCurrentGameState();
      console.log(`Available time for challenge: ${timeformat(info.challenge)}`);
      state = States.AWAIT_AGENT_CHALLENGE; // Now it is our turn to challenge
    }
  } else if (state === States.AWAIT_EXCHANGE_RESPONSE) {
    if (data[0] === MessageTypes.INVALID) {
      console.log('Exchange Rejected.');
      current = history[history.length - 1]; // If our move is rejected, rollback
      state = States.THINKING;
    } else if (data[0] === MessageTypes.EXCHANGE) {
      console.log('Exchanged Accepted.');
      const info = Structs.TypeWithTilesStruct.unpack(data);
      // Add tiles received from the server to our rack
      ScrabbleUtils.addToRack(
        _.filter(info.tiles, tile => tile !== 0),
        current.rack,
      );
      displayCurrentGameState();
      state = States.IDLE;
    }
  } else if (state === States.AWAIT_PLAY_RESPONSE) {
    if (data[0] === MessageTypes.INVALID) {
      console.log('Play Rejected.');
      current = history[history.length - 1]; // If our move is rejected, rollback
      displayCurrentGameState();
      state = States.THINKING;
    } else if (data[0] === MessageTypes.NO_CHALLENGE) {
      console.log('Play Accepted Without Challenge.');
      const info = Structs.TypeWithTilesStruct.unpack(data);
      // Add tiles received from the server to our rack
      ScrabbleUtils.addToRack(
        _.filter(info.tiles, tile => tile !== 0),
        current.rack,
      );
      displayCurrentGameState();
      state = States.IDLE;
    } else if (data[0] === MessageTypes.CHALLENGE_ACCEPTED) {
      console.log('Play Rejected Due To Accepted Challenge.');
      current = history[history.length - 1]; // If opponent challenge is accepted, rollback
      displayCurrentGameState();
      state = States.IDLE;
    } else if (data[0] === MessageTypes.CHALLENGE_REJECTED) {
      console.log('Play Accepted with Rejected Challenge.');
      const info = Structs.TypeWithTilesAndTimeStruct.unpack(data);
      displayTime(info);
      // Add tiles received from the server to our rack
      ScrabbleUtils.addToRack(
        _.filter(info.tiles, tile => tile !== 0),
        current.rack,
      );
      displayCurrentGameState();
      state = States.THINKING;
    }
  } else if (state === States.AWAIT_AGENT_CHALLENGE) {
    // This means the server received no reply with challenge period so it defaulted to NO_CHALLENGE
    if (data[0] === MessageTypes.NO_CHALLENGE) {
      console.log('Challenge Time Out.');
      const info = Structs.TypeWithTimeStruct.unpack(data);
      displayTime(info);
      displayCurrentGameState();
      state = States.THINKING;
    }
  } else if (state === States.AWAIT_CHALLENGE_RESPONSE) {
    if (data[0] === MessageTypes.NO_CHALLENGE) {
      console.log('Challenge Time Out.');
      const info = Structs.TypeWithTimeStruct.unpack(data);
      displayTime(info);
      displayCurrentGameState();
      state = States.THINKING;
    } else if (data[0] === MessageTypes.CHALLENGE_ACCEPTED) {
      console.log('Challenge Accepted.');
      const info = Structs.TypeWithTimeStruct.unpack(data);
      displayTime(info);
      current = history[history.length - 1]; // If our challenge is accepted, rollback opponent move
      displayCurrentGameState();
      state = States.THINKING;
    } else if (data[0] === MessageTypes.CHALLENGE_REJECTED) {
      console.log('Challenge Rejected.');
      state = States.IDLE;
    }
  }
  console.log(`Curent State: ${StatesNames[state]}`);
  // If this is our turn or we should make a reply, prompt the user
  if (state === States.THINKING || state === States.AWAIT_AGENT_CHALLENGE) rl.prompt();
});

ws.on('close', (code, reason) => {
  console.log('Connection Closed');
  console.log(`${code} - ${reason}`);
  state = States.INIT; // If connection with server is closed, go back to initial state
  rl.pause();
});

// Register a callback for user input
rl.on('line', (line) => {
  // Split input into command parameter
  const command = line.trim().split(/\s+/);
  let move = null;
  // Check command type and create a move accordingly
  switch (command[0].toLowerCase()) {
    case 'challenge':
      console.log('challenge!');
      move = { type: MessageTypes.CHALLENGE };
      break;
    case 'ok':
      console.log('no challenge!');
      move = { type: MessageTypes.NO_CHALLENGE };
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
    if (state === States.THINKING) {
      if (move.type === MessageTypes.PASS) {
        // If move is PASS, send to the server and change nothing
        ws.send(Structs.TypeStruct.pack(move));
        state = States.IDLE;
      } else if (move.type === MessageTypes.EXCHANGE) {
        ws.send(Structs.TypeWithTilesStruct.pack(move));
        history.push(current); // Keep current state in history, since we may rollback if our move is rejected
        current = _.cloneDeep(current);
        // Remove exchanged tiles from rack
        ScrabbleUtils.removeFromRack(
          _.filter(move.tiles, tile => tile !== 0),
          current.rack,
        );
        state = States.AWAIT_EXCHANGE_RESPONSE; // Wait for server response
      } else if (move.type === MessageTypes.PLAY) {
        ws.send(Structs.PlayStruct.pack(move));
        history.push(current); // Keep current state in history, since we may rollback if our move is rejected or challenged out
        current = _.cloneDeep(current);
        const filteredTiles = _.filter(move.tiles, tile => tile !== 0);
        ScrabbleUtils.updateBoard(
          filteredTiles,
          { col: move.col - 1, row: move.row - 1 },
          move.dir,
          current.board,
          size,
        );
        // Remember that playable tile format (Format-2) is not the same as tile format in rack (Format-1)
        const srcTiles = _.map(filteredTiles, ScrabbleUtils.getPlayableTileOrigin);
        // Remove exchanged tiles from rack
        ScrabbleUtils.removeFromRack(srcTiles, current.rack);
        displayCurrentGameState();
        state = States.AWAIT_PLAY_RESPONSE;
      } else {
        console.log('Invalid command');
      }
    } else if (state === States.AWAIT_AGENT_CHALLENGE) {
      if (move.type === MessageTypes.NO_CHALLENGE) {
        ws.send(Structs.TypeStruct.pack(move));
        state = States.THINKING; // If we do not challenge, then it is our turn now
      } else if (move.type === MessageTypes.CHALLENGE) {
        ws.send(Structs.TypeStruct.pack(move));
        state = States.AWAIT_CHALLENGE_RESPONSE; // If we challenge, we have to wait for the server response
      } else {
        console.log('Invalid command');
      }
    }
  }
  console.log(`Curent State: ${StatesNames[state]}`);
  // If it is our turn, prompt the user
  if (state === States.THINKING) rl.prompt();
}).on('close', () => {
  console.log('Goodbye!'); // Remember to say goodbye to the user before quitting :D
  process.exit(0);
});
