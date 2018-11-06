const _ = require('lodash');
const readline = require('readline');
const WebSocket = require('ws');
const Structs = require('./utils/structs');
const ScrabbleUtils = require('./utils/scrabble-utils');
const { MessageTypes, EndReasons } = require('./utils/communication-enums');
const { timeformat } = require('./utils/time');

const States = {
    INIT: 0,
    READY: 1,
    IDLE: 2,
    THINKING: 3,
    AWAIT_EXCHANGE_RESPONSE: 4,
    AWAIT_PLAY_RESPONSE: 5,
    AWAIT_AGENT_CHALLENGE: 6,
    AWAIT_CHALLENGE_RESPONSE: 7
};

const StatesNames = {
    [States.INIT]: "Initializing",
    [States.READY]: "Ready",
    [States.IDLE]: "Idle",
    [States.THINKING]: "Thinking",
    [States.AWAIT_EXCHANGE_RESPONSE]: "Await Exchange Response",
    [States.AWAIT_PLAY_RESPONSE]: "Await Play Response",
    [States.AWAIT_AGENT_CHALLENGE]: "Await Agent Challenge",
    [States.AWAIT_CHALLENGE_RESPONSE]: "Await Challenge Response"
};

let history = [];
let current = {board: null, rack: null};
let state = States.INIT;

function displayTime(info){
    console.log("Your Time: " + timeformat(info.time));
    console.log("Total Time: " + timeformat(info.total));        
}

function displayScore(info){
    console.log("Your Score: " + info.score);
    console.log("Opponent Score: " + info.opponent);
}

function displayCurrentGameState(){
    console.log(ScrabbleUtils.convertBoardToString(current.board))
    console.log("your rack: " + ScrabbleUtils.convertHandToString(current.rack));
}

let name = process.argv[2] || `Client${process.pid}`;
let port = process.argv[3] || '8080';
let host = process.argv[4] || '127.0.0.1';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${name}> `
});

rl.prompt();

const ws = new WebSocket(`ws://${host}:${port}`);


ws.on('message', data => {
    console.log("Received Buffer: " + [...data]);
    if(data[0] == MessageTypes.END){
        console.log("Game Ended");
        let info = Structs.EndStruct.unpack(data);
        let cleanEnd = true;
        if(info.reason == EndReasons.ALL_TILES_USED){
            console.log("All tiles used");
        } else if(info.reason == EndReasons.TIME_ENDED){
            console.log("Time ended");
        } else if(info.reason == EndReasons.STOP_BUTTON_PRESSED){
            console.log("Stop button pressed");
            cleanEnd = false;
        } else if(info.reason == EndReasons.CONNECTION_ERROR){
            console.log("Connection");
            cleanEnd = false;
        }
        if(cleanEnd){
            console.log("Your score: " + info.score);
            console.log("Opponent score: " + info.opponent);
            if(info.score > info.opponent){
                console.log("You Won");
            } else if(info.score < info.opponent){
                console.log("You Lost");
            } else {
                console.log("It's a draw");
            }
        }
        state = States.READY;
        console.log("Curent State: " + StatesNames[state]);
        rl.prompt();
        return;
    }
    if(state == States.INIT){
        if(data[0] == MessageTypes.NAME){
            console.log("Server Requested your name! Stay tuned for the game...");
            ws.send(Buffer.concat([Buffer.from([MessageTypes.NAME]), Buffer.from(name)]));
            state = States.READY;
        }
    } else if (state == States.READY){
        if(data[0] == MessageTypes.START){
            let info = Structs.StartStruct.unpack(data);
            current.board = _.chunk(info.board, 15);
            current.rack = _.countBy(info.tiles);
            history.push(current);
            console.log("Game Start");
            displayScore(info);
            displayTime(info);
            displayCurrentGameState();
            if(info.order == 1){
                console.log("It is your turn now");
                state = States.THINKING;
            } else {
                state = States.IDLE;
            }
        }
    } else if(state == States.IDLE){
        if(data[0] == MessageTypes.PASS){
            console.log("Opponent Passed. Your turn");
            let info = Structs.TypeWithTimeStruct.unpack(data);
            displayTime(info);
            state = States.THINKING;
        } else if(data[0] == MessageTypes.EXCHANGE){
            console.log("Opponent Exchanged Their Tiles. Your turn");
            let info = Structs.TypeWithCountAndTimeStruct.unpack(data);
            console.log(`${info.count} Tiles(s) Exchanged`);
            displayTime(info);
            state = States.THINKING;
        } else if(data[0] == MessageTypes.PLAY){
            console.log("Opponent Played his tiles. Your turn");
            let info = Structs.PlayWithTimeStruct.unpack(data);
            displayTime(info);
            history.push(current);
            current = _.cloneDeep(current);
            ScrabbleUtils.updateBoard(_.filter(info.tiles, tile => tile != 0), {col: info.col-1, row: info.row-1}, info.dir, current.board);
            displayCurrentGameState();
            console.log(`Available time for challenge: ${timeformat(info.challenge)}`);
            state = States.AWAIT_AGENT_CHALLENGE;
        }
    } else if(state == States.AWAIT_EXCHANGE_RESPONSE){
        if(data[0] == MessageTypes.INVALID){
            console.log("Exchange Rejected.");
            current = history[history.length-1];
            state = States.THINKING;
        } else if(data[0] == MessageTypes.EXCHANGE){
            console.log("Exchanged Accepted.");
            let info = Structs.TypeWithTilesStruct.unpack(data);
            ScrabbleUtils.addToHand(_.filter(info.tiles, tile => tile != 0), current.rack);
            displayCurrentGameState();
            state = States.IDLE;
        }
    } else if(state == States.AWAIT_PLAY_RESPONSE){
        if(data[0] == MessageTypes.INVALID){
            console.log("Play Rejected.");
            current = history[history.length-1];
            displayCurrentGameState();
            state = States.THINKING;
        } else if(data[0] == MessageTypes.NO_CHALLENGE){
            console.log("Play Accepted Without Challenge.");
            let info = Structs.TypeWithTilesStruct.unpack(data);
            ScrabbleUtils.addToHand(_.filter(info.tiles, tile => tile != 0), current.rack);
            displayCurrentGameState();
            state = States.IDLE;
        } else if(data[0] == MessageTypes.CHALLENGE_ACCEPTED){
            console.log("Play Rejected Due To Accepted Challenge.");
            current = history[history.length-1];
            displayCurrentGameState();
            state = States.IDLE;
        } else if(data[0] == MessageTypes.CHALLENGE_REJECTED){
            console.log("Play Accepted with Rejected Challenge.");
            let info = Structs.TypeWithTilesAndTimeStruct.unpack(data);
            displayTime(info);
            ScrabbleUtils.addToHand(_.filter(info.tiles, tile => tile != 0), current.rack);
            displayCurrentGameState();
            state = States.THINKING;
        }
    } else if(state == States.AWAIT_AGENT_CHALLENGE){
        if(data[0] == MessageTypes.NO_CHALLENGE){
            console.log("Challenge Time Out.");
            let info = Structs.TypeWithTimeStruct.unpack(data);
            displayTime(info);
            displayCurrentGameState();
            state = States.THINKING;
        }
    } else if(state == States.AWAIT_CHALLENGE_RESPONSE){
        if(data[0] == MessageTypes.CHALLENGE_ACCEPTED){
            console.log("Challenge Accepted.");
            let info = Structs.TypeWithTimeStruct.unpack(data);
            displayTime(info);
            current = history[history.length-1];
            displayCurrentGameState();
            state = States.THINKING;
        } else if(data[0] == MessageTypes.CHALLENGE_REJECTED){
            console.log("Challenge Rejected.");
            state = States.IDLE;
        }
    }
    console.log("Curent State: " + StatesNames[state]);
    if(state == States.THINKING || state == States.AWAIT_AGENT_CHALLENGE)
        rl.prompt();
});

ws.on('close', (code, reason) => {
    console.log('Connection Closed');
    console.log(code + " - " + reason);
    state = States.INIT;
    rl.pause();
})

rl.on('line', (line) => {
    let command = line.trim().split(/\s+/);
    let move = null;
    switch (command[0].toLowerCase()) {
    case 'challenge':
        console.log('challenge!');
        move = {type: MessageTypes.CHALLENGE};
        break;
    case 'ok':
        console.log('no challenge!');
        move = {type: MessageTypes.NO_CHALLENGE};
        break;
    case 'pass':
        console.log('pass!');
        move = {type: MessageTypes.PASS};
        break;
    case 'exchange':
        console.log('exchange!');
        tiles = _.map(_.padEnd(command[1],7,'.'), x => x=='.'?0:(x=='_'?100:(x.charCodeAt(0)-'A'.charCodeAt(0)+1)));
        move = {type: MessageTypes.EXCHANGE, tiles: tiles};
        break;
    case 'play':
        console.log('play!');
        col = command[1].charCodeAt(0) - 'A'.charCodeAt(0) + 1;
        row = +command[2];
        dir = (command[3].toLowerCase()=='d')?1:0;
        tiles = _.map(_.padEnd(command[4],7,'.'), x => x=='.'?0:((x.toUpperCase().charCodeAt(0)-'A'.charCodeAt(0)+1) + ((x.toLowerCase()==x)?100:0)));
        score = +command[5];
        move = {type: MessageTypes.PLAY, col: col, row: row, dir: dir, tiles: tiles, score: score};
        break;
    default:
        console.log('Unknown command');
        break;
    }
    if(move != null){
        if(state == States.THINKING){
            if(move.type == MessageTypes.PASS){
                ws.send(Structs.TypeStruct.pack(move));
                state = States.IDLE;
            } else if(move.type == MessageTypes.EXCHANGE){
                ws.send(Structs.TypeWithTilesStruct.pack(move));
                history.push(current);
                current = _.cloneDeep(current);
                ScrabbleUtils.removeFromHand(_.filter(move.tiles, tile => tile != 0), current.rack);
                state = States.AWAIT_EXCHANGE_RESPONSE;
            } else if(move.type == MessageTypes.PLAY){
                ws.send(Structs.PlayStruct.pack(move));
                history.push(current);
                current = _.cloneDeep(current);
                let filteredTiles = _.filter(move.tiles, tile => tile != 0);
                ScrabbleUtils.removeFromHand(filteredTiles, current.rack);
                ScrabbleUtils.updateBoard(filteredTiles, {col: move.col-1, row: move.row-1}, move.dir, current.board);
                displayCurrentGameState();
                state = States.AWAIT_PLAY_RESPONSE;
            } else {
                console.log('Invalid command');
            }
        } else if(state == States.AWAIT_AGENT_CHALLENGE){
            if(move.type == MessageTypes.NO_CHALLENGE){
                ws.send(Structs.TypeStruct.pack(move));
                state = States.THINKING;
            } else if(move.type == MessageTypes.CHALLENGE){
                ws.send(Structs.TypeStruct.pack(move));
                state = States.AWAIT_CHALLENGE_RESPONSE;
            } else {
                console.log('Invalid command');
            }
        }
    }
    console.log("Curent State: " + StatesNames[state]);
    if(state == States.THINKING)
        rl.prompt();
}).on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
});