const _ = require('lodash');
const fs = require('fs');
const seedrandom = require('seedrandom');
const Tock = require('tocktimer');
const { timeparse, timeformat } = require('./utils/time');
const ScrabbleUtils = require('./utils/scrabble-utils');
const { MessageTypes } = require('./utils/communication-enums');

const Moves = {
    START: MessageTypes.START,
    PASS: MessageTypes.PASS,
    EXCHANGE: MessageTypes.EXCHANGE,
    PLAY: MessageTypes.PLAY,
    CHALLENGE: MessageTypes.CHALLENGE,
    NO_CHALLENGE: MessageTypes.NO_CHALLENGE,
    END: MessageTypes.END
}

class Scrabble {
    constructor(config, options={}){
        this.design = config.design;
        this.tileScores = _.zipObject(ScrabbleUtils.tileCodes, _.map(ScrabbleUtils.tileNames, name => config.letterScores[name]));
        this.tileFrequencies = _.zipObject(ScrabbleUtils.tileCodes, _.map(ScrabbleUtils.tileNames, name => config.letterFrequencies[name]));
        this.times = _.map(config["starting timespans"], timeparse);
        this.totaltime = _.sum(this.times);
        this.challengeTimespan = timeparse(config["challenge timespan"]);
        this.penalty = {
            points: config.penalty.points,
            every: timeparse(config.penalty.every)
        };
        this.dictionary = new Set(fs.readFileSync(config.dictionary, 'utf-8').trim().split(/[\r\n]+/));
        this.history = []
        this.currentState = null;
        this.timer = new Tock({
            countdown: true,
            interval: 1000,
            callback: () => { if(options.intervalCallback) options.intervalCallback(); },
            complete: () => { if(options.timeoutCallback) options.timeoutCallback(); }
        });
        this.challengeTimer = new Tock({
            countdown: true,
            interval: 1000,
            callback: () => { if(options.intervalCallback) options.intervalCallback(); },
            complete: () => { if(options.challengeTimeoutCallback) options.challengeTimeoutCallback(); }
        });
        this.running = false;
        this.finished = false;

    }

    start(seed){
        let prng = seedrandom(seed, {state: true});
        let bag = _.flatten(_.map(ScrabbleUtils.tileCodes, tile => _.times(this.tileFrequencies[tile], _.constant(tile))));
        bag = ScrabbleUtils.shuffle(bag, prng);
        let players = [{}, {}];
        players[0] = {
            rack: _.countBy(_.slice(bag, 0, 7)),
            score: 0,
            time: this.times[0]
        }
        players[1] = {
            rack: _.countBy(_.slice(bag, 7, 14)),
            score: 0,
            time: this.times[1],
        }
        this.currentState = {
            board: _.times(15, () => _.times(15, _.constant(0))),
            players: players,
            current: 0,
            time: _.sum(this.times),
            bag: _.slice(bag, 14),
            prng: prng.state(),
            turn: 0
        };
        this.history = [{move: {type: Moves.START}, result: {state: this.currentState}}];
        this.timer.start(this.currentState.time);
        this.running = true; 
        this.finished = false;
    }

    startFromCheckpoint(state){
        if(state.prng){
            if(_.isString(state.prng)) state.prng = seedrandom(state.prng, {state: true}).state();
        } else {
            state.prng = seedrandom().state();
        }
        this.currentState = state;
        this.history = [{move: {type: Moves.START}, result: {state: this.currentState}}];
        this.timer.start(this.currentState.time);
        this.running = true;
        this.finished = false;
    }

    apply(move){
        let playerIndex = this.currentState.current;
        let last = this.history[this.history.length - 1];

        if(move.type == Moves.CHALLENGE){
            if(last.move.type != Moves.PLAY) return {valid: false, reason: "Last move was not a play"};
            let state, result;
            if(last.result.invalidWords.length > 0){ //ACCEPTED
                state = this.history[this.history.length - 2].result.state;
                result = {valid: true, player: playerIndex, accepted: true};
            } else { //REJECTED
                state = last.result.state;
                result = {valid: true, player: playerIndex, accepted: false, tiles: last.result.tiles, end: last.result.tilesFinished};
            }
            let nextState = _.cloneDeep(state);
            nextState.current = 1-nextState.current;
            nextState.time = Math.max(0, this.timer.lap());
            nextState.players[1 - this.currentState.current].time = this.currentState.players[1 - this.currentState.current].time;
            nextState.players[this.currentState.current].time = nextState.time - nextState.players[1 - this.currentState.current].time;
            result.state = nextState;
            this.history.push({move: move, result: result});
            this.currentState = nextState;
            return result;
        }

        let nextState = _.cloneDeep(this.currentState);
        nextState.time = Math.max(0, this.timer.lap());
        nextState.players[nextState.current].time = nextState.time - nextState.players[1-nextState.current].time;

        if(move.type == Moves.NO_CHALLENGE){
            if(last.move.type != Moves.PLAY) return {valid: false, player: playerIndex, reason: "Last move was not a play"};
            let result = {valid: true, player: playerIndex, tiles: last.result.tiles, missed: last.result.invalidWords.length > 0, end: last.result.tilesFinished, state: nextState};
            this.history.push({move: move, result: result});
            this.currentState = nextState;
            return result;
        }

        if(last.move.type == Moves.PLAY) return {valid: false, player: playerIndex, reason: "Last move was a play, so you must challenge or approve"};

        nextState.turn++;

        if(move.type == Moves.PASS){
            nextState.current = 1 - nextState.current;

            let result = {valid: true, player: playerIndex, state: nextState};
            this.history.push({move: move, result: result});
            this.currentState = nextState;
            return result;
        }

        let player = nextState.players[nextState.current];
        let tiles = _.filter(move.tiles, tile => tile != 0);
        if(tiles.length == 0) return {valid: false, reason: "No tiles played"};

        if(move.type == Moves.EXCHANGE) {
            if(!_.every(tiles, ScrabbleUtils.isValidTileCode)) return {valid: false, player: playerIndex, reason: "Invalid tile codes"};
            if(!ScrabbleUtils.removeFromHand(tiles, player.rack)) return {valid: false, player: playerIndex, reason: "rack doesn't contain exchanged tiles"};
            if(nextState.bag.length < 7) return {valid: false, player: playerIndex, reason: "Bag has less than 7 tiles"};
            let newTiles = nextState.bag.slice(0,tiles.length);
            nextState.bag = nextState.bag.slice(tiles.length);
            ScrabbleUtils.addToHand(newTiles, player.rack);
            let prng = seedrandom('', {state: this.currentState.prng});
            nextState.bag = ScrabbleUtils.shuffle(_.concat(nextState.bag, _.sortBy(tiles)), prng);
            nextState.prng = prng.state();
            nextState.current = 1 - nextState.current;

            let result = {valid: true, player: playerIndex, state: nextState, tiles: newTiles};
            this.history.push({move: move, result: result});
            this.currentState = nextState;
            return result;
        }
        
        if(move.type == Moves.PLAY){
            if(move.dir > 1) return {valid: false, player: playerIndex, reason: "Invalid Direction"};

            if(!_.every(tiles, ScrabbleUtils.isValidPlayableTile)) return {valid: false, player: playerIndex, reason: "Invalid tile codes"};
            
            let originalTiles = _.map(tiles, ScrabbleUtils.getPlayableTileOrigin);
            if(!ScrabbleUtils.removeFromHand(originalTiles, player.rack)) return {valid: false, player: playerIndex, reason: "Rack doesn't contain placed tiles"};

            let newTiles = nextState.bag.slice(0,tiles.length);
            nextState.bag = nextState.bag.slice(tiles.length);
            ScrabbleUtils.addToHand(newTiles, player.rack);
            
            let position = {row: move.row-1, col: move.col-1};
            
            if(!ScrabbleUtils.inBounds(position)) return {valid: false, player: playerIndex, reason: "First position not in board bounds"};
            if(nextState.board[position.row][position.col]) return {valid: false, player: playerIndex, reason: "First position is not empty"};

            let wasEmpty = _.every(nextState.board, row => _.every(row, tile => tile == 0));
            
            let majorWord = ScrabbleUtils.updateBoard(tiles, position, move.dir, nextState.board);
            if(_.isNull(majorWord)) return {valid: false, player: playerIndex, reason: "Word goes out of board bounds"};
            let minorWords = [];
            for(let letter of majorWord){
                if(letter.src == "rack"){
                    let minorWord = ScrabbleUtils.expandWord([letter], 1-move.dir, nextState.board);
                    if(minorWord.length > 1) minorWords.push(minorWord);
                }
            }
            ScrabbleUtils.expandWord(majorWord, move.dir, nextState.board);
            
            if(wasEmpty){
                if(!_.some(majorWord, tile => tile.position.row == 7 && tile.position.col == 7)) return {valid: false, player: playerIndex, reason: "First word is not on the center of the board"};
            } else {
                if(minorWords.length == 0 && _.every(majorWord, tile => tile.src == 'rack')) return {valid: false, player: playerIndex, reason: "Word doesn't connect with other tiles on board"};
            }

            let words = majorWord.length>1?_.concat([majorWord], minorWords):minorWords;
            
            let score = ScrabbleUtils.calculateScore(words, this.design, this.tileScores) + (tiles.length==7?50:0);
            if(score != move.score) return {valid: false, player: playerIndex, reason: `Score is incorrect, Correct value is ${score}`};

            player.score += score;
            nextState.current = 1 - nextState.current;

            let invalidWords = [];
            for (let word of words) {
                let wordStr = _.map(word, letter => ScrabbleUtils.tileCodesToNames[ScrabbleUtils.getPlayableTileLetter(letter.tile)]).join('').toLowerCase();
                console.log(wordStr);
                if(!this.dictionary.has(wordStr))
                    invalidWords.push({word: wordStr, row: word[0].position.row+1, col: word[0].position.col + 1, dir: (word[0].position.row==word[1].position.row?0:1)});
            }

            let result = {
                valid: true, 
                player: playerIndex,
                state: nextState,
                tiles: newTiles,
                score: score,
                invalidWords: invalidWords,
                tilesFinished: (_.sum(_.values(player.rack)) == 0)
            };
            this.history.push({move: move, result: result});
            this.currentState = nextState;
            return result;
        }
    }

    calculateTimePenalty(time){
        return time < 0 ? this.penalty.points * Math.ceil(-time / this.penalty.every): 0;
    }

    calculateRemainingTilesPenalty(rack){
        return _.sum(_.map(rack, (count, tile) => count * this.tileScores[tile]));
    }
    
    end(abrupt = false){
        let finished = !abrupt;
        if(this.running){
            let next = _.cloneDeep(this.currentState);
            let result = {end: finished, state: next};
            next.time = Math.max(0, this.timer.lap());
            next.players[next.current].time = next.time - next.players[1-next.current].time;
            if(finished){
                for (let player of next.players) {
                    player.score -= this.calculateTimePenalty(player.time) + this.calculateRemainingTilesPenalty(player.rack);
                }
                let scores = _.map(next.players, player => player.score);
                let winner = (scores[0] == scores[1])?null:(scores[0]>scores[1]?0:1);
                result = {scores: scores, winner: winner, ...result};
            }
            this.currentState = next;
            this.history.push({move: {type: Moves.END}, result: result});
            this.timer.stop();
            this.challengeTimer.stop();
            this.running = false;
            this.finished = finished;
        }
    }

    getCurrentInfo(){
        if(_.isNull(this.currentState)){
            return {times:[0,0], scores:[0,0]};
        } else{
            let times = _.map(this.currentState.players, player => player.time);
            let scores = _.map(this.currentState.players, player => player.score); 
            if(this.running){
                let time = Math.max(0, this.timer.lap());
                times[this.currentState.current] = time - times[1 - this.currentState.current];
            }
            if(this.running || !this.finished)
                for(let i = 0; i < 2; i++) 
                    scores[i] -= this.calculateTimePenalty(times[i]);
            return {times, scores};
        }
    }
    
    toString(){
        let boardStr = ScrabbleUtils.convertBoardToString(this.currentState.board);
        let bagStr = _.map(this.currentState.bag, tile => ScrabbleUtils.tileCodesToNames[tile]).join();
        const playerToStr = player => `Score: ${player.score}, Time: ${timeformat(player.time)}, rack: ${ScrabbleUtils.convertHandToString(player.rack)}`;
        return `Remaining Time: ${timeformat(this.currentState.time)}\nBag: ${bagStr}\nCurrent Player: ${this.currentState.current+1}\nPlayer 1: ${playerToStr(this.currentState.players[0])}\nPlayer 2: ${playerToStr(this.currentState.players[1])}\n${boardStr}`;
    }

}

module.exports = Scrabble;