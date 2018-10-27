const _ = require('lodash');
const Scrabble = require("../scrabble");
const config = require("../config.json");
const readline = require('readline');
const { MessageTypes } = require('../utils/communication-enums');

function displayGameEnd(){
    let scores = game.getScores();
    console.log(`\nPlayer 1: ${scores[0]}\nPlayer 2: ${scores[1]}`);
    if(scores[0] > scores[1]){
        console.log("Player 1 won");
    } else if(scores[1] > scores[0]){
        console.log("Player 2 won");
    } else {
        console.log("Draw");
    }
    console.log("GG!")
}

let game = new Scrabble(config, () => {
    console.log("Time Out");
    game.end();
    displayGameEnd();
    process.exit(0);
});
game.start("Hello");
console.log(game.toString());


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'SCRABBLE> '
});

rl.prompt();

rl.on('line', (line) => {
    let command = line.trim().split(/\s+/);
    let move = null;
    switch (command[0].toLowerCase()) {
    case 'ok':
        console.log('ok!');
        move = {type: MessageTypes.NO_CHALLENGE};
        break;
    case 'challenge':
        console.log('challenge!');
        move = {type: MessageTypes.CHALLENGE};
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
        let result = game.apply(move);
        if(result.valid){
            console.log(game.toString());    
            if(move.type == 4 && result.invalidWords.length > 0){
                for(let word of result.invalidWords){
                    console.log(`INVALID WORD: ${word.word} (${String.fromCharCode(65+word.col-1) + word.row.toString() + (word.dir?"D":"R")})`);
                }
            }
            if(result.end){
                console.log("Tiles Finished");
                game.end();
                displayGameEnd();
                process.exit(0);
            }      
        } else {
            console.log(`Invalid Move: ${result.reason}`);
        }
    
    }
    rl.prompt();
}).on('close', () => {
    console.log('Goodbye!');
    process.exit(0);
});