const _ = require('lodash');
const fs = require('fs');
const seedrandom = require('seedrandom');
const Tock = require('tocktimer');
const { timeparse, timeformat } = require('./utils/time');
const ScrabbleUtils = require('./utils/scrabble-utils');
const { MessageTypes } = require('./utils/communication-enums');

// Since I wanted to isolate my scrabble code from the server as much as possible and also avoid constant redefinitions
// I redefined only what I need in a seperate enum to avoid making the scrabble class directly dependant on the server enums
const Moves = {
  START: MessageTypes.START,
  PASS: MessageTypes.PASS,
  EXCHANGE: MessageTypes.EXCHANGE,
  PLAY: MessageTypes.PLAY,
  CHALLENGE: MessageTypes.CHALLENGE,
  NO_CHALLENGE: MessageTypes.NO_CHALLENGE,
  END: MessageTypes.END,
};

class Scrabble {
  constructor(config, options = {}) {
    // The design defines the type of every square on the board
    this.design = config.design;
    // Calculate board size from design array (usually 15x15)
    this.size = {
      rows: this.design.length,
      columns: this.design.length === 0 ? 0 : Math.min(...this.design.map(row => row.length)),
    };
    // Rack size (usually 7)
    this.rackSize = config['rack size'];
    // Bingo score (usually 50)
    this.bingo = config.bingo;
    // Convert score dictionary in config to use tilecodes instead of tilenames
    this.tileScores = _.zipObject(
      ScrabbleUtils.tileCodes,
      _.map(ScrabbleUtils.tileNames, name => config['tile scores'][name]),
    );
    // Convert frequency dictionary in config to use tilecodes instead of tilenames
    this.tileFrequencies = _.zipObject(
      ScrabbleUtils.tileCodes,
      _.map(ScrabbleUtils.tileNames, name => config['tile frequencies'][name]),
    );
    // Parse starting time for each player
    this.times = _.map(config['starting timespans'], timeparse);
    // Parse the time allowed for each player to challenge the opponent
    this.challengeTimespan = timeparse(config['challenge timespan']);
    // The time penalty for going overtime (remove 'points' for 'every' certain amount of time)
    this.penalty = {
      points: config.penalty.points,
      every: timeparse(config.penalty.every),
    };
    // Read tournment dictionary
    this.dictionary = new Set(
      fs
        .readFileSync(config.dictionary, 'utf-8')
        .trim()
        .split(/[\r\n]+/),
    );
    // Create an empty history list
    this.history = [];
    // The current state of the game (null if the game hasn't started)
    this.currentState = null;
    // Timer for whole game
    this.timer = new Tock({
      countdown: true,
      interval: 1000,
      callback: () => {
        if (options.intervalCallback) options.intervalCallback();
      },
      complete: () => {
        if (options.timeoutCallback) options.timeoutCallback();
      },
    });
    // Timer for each challenge period
    this.challengeTimer = new Tock({
      countdown: true,
      interval: 1000,
      callback: () => {
        if (options.intervalCallback) options.intervalCallback();
      },
      complete: () => {
        if (options.challengeTimeoutCallback) options.challengeTimeoutCallback();
      },
    });
    // Initially the game is not running and is not finished
    this.running = false;
    this.finished = false;
  }

  // Start a game from scratch using the given seed
  start(seed) {
    const prng = seedrandom(seed, { state: true });
    let bag = _.flatten(
      _.map(ScrabbleUtils.tileCodes, tile => _.times(this.tileFrequencies[tile], _.constant(tile))),
    );
    bag = ScrabbleUtils.shuffle(bag, () => prng.int32());
    const players = [{}, {}];
    // If number of tiles in bag is less than double the rack size, divide the remaining tiles evenly between the players
    const initialTileCount = Math.min(this.rackSize, Math.trunc(bag.length / 2));
    players[0] = {
      rack: _.countBy(_.slice(bag, 0, initialTileCount)),
      score: 0,
      time: this.times[0],
    };
    players[1] = {
      rack: _.countBy(_.slice(bag, initialTileCount, 2 * initialTileCount)),
      score: 0,
      time: this.times[1],
    };
    this.currentState = {
      board: _.times(this.size.rows, () => _.times(this.size.columns, _.constant(0))),
      players,
      current: 0,
      time: _.sum(this.times),
      bag: _.slice(bag, 2 * initialTileCount),
      prng: prng.state(), // We only save the RNG state in the game state in order to safely serialize it to json
      turn: 0,
    };
    // Add game start event to history
    this.history = [
      { move: { type: Moves.START }, result: { state: this.currentState } },
    ];
    this.timer.start(this.currentState.time);
    this.running = true;
    this.finished = false;
  }

  // Start game from a previously saved checkpoint
  startFromCheckpoint(state) {
    if (state.prng) {
      // If RNG state is a string, then it is a seed
      if (_.isString(state.prng)) state.prng = seedrandom(state.prng, { state: true }).state();
    } else {
      // If no RNG state exists, create one randomly
      state.prng = seedrandom().state();
    }
    this.currentState = state;
    // Add game start event to history
    this.history.push({ move: { type: Moves.START }, result: { state: this.currentState } });
    this.timer.start(this.currentState.time);
    this.running = true;
    this.finished = false;
  }

  apply(move) {
    const playerIndex = this.currentState.current; // The index of the current player
    const valid = { valid: true, player: playerIndex }; // An Empty valid result which will be extended below
    const invalid = { valid: false, player: playerIndex }; // An Empty invalid result which will be extended below
    const last = this.history[this.history.length - 1]; // Get the last entry from the history table

    if (move.type === Moves.CHALLENGE) {
      if (last.move.type !== Moves.PLAY) return { ...invalid, reason: 'Last move was not a play' };
      let state;
      let result;
      if (last.result.invalidWords.length > 0) {
        // If there was any invalid words in the last move, then accept the challenge
        ({ state } = this.history[this.history.length - 2].result); // Get the state from before the last PLAY move
        result = { ...valid, accepted: true };
      } else {
        // If there was no invalid words in the last move, then reject the challenge
        ({ state } = last.result);
        result = {
          ...valid,
          accepted: false,
          tiles: last.result.tiles, // What tiles should we send to the last player from the bag
          end: last.result.tilesFinished, // It is possible that the last player finished his tiles so the game should end
        };
      }
      const nextState = _.cloneDeep(state);
      nextState.current = 1 - nextState.current;
      // Update players' time
      nextState.time = Math.max(0, this.timer.lap());
      nextState.players[1 - playerIndex].time = this.currentState.players[
        1 - playerIndex
      ].time;
      nextState.players[playerIndex].time = nextState.time - nextState.players[1 - playerIndex].time;
      result.state = nextState;
      this.history.push({ move, result });
      this.currentState = nextState;
      return result;
    }

    // In case of NO_CHALLENGE, PASS, EXCHANGE or PLAY, we either clone or modify a clone of the current state
    const nextState = _.cloneDeep(this.currentState);
    // Update players' time
    nextState.time = Math.max(0, this.timer.lap());
    nextState.players[playerIndex].time = nextState.time - nextState.players[1 - playerIndex].time;

    if (move.type === Moves.NO_CHALLENGE) {
      if (last.move.type !== Moves.PLAY) return { ...invalid, reason: 'Last move was not a play' };
      const result = {
        ...valid,
        tiles: last.result.tiles, // What tiles should we send to the last player from the bag
        missed: last.result.invalidWords.length > 0, // Tell the player if he missed a chance for an acceptable challenge
        end: last.result.tilesFinished, // It is possible that the last player finished his tiles so the game should end
        state: nextState,
      };
      this.history.push({ move, result });
      this.currentState = nextState;
      return result;
    }

    if (last.move.type === Moves.PLAY) {
      // If the last move was a play, this move must be either a CHALLENGE or a NO_CHALLENGE
      return {
        ...invalid,
        reason: 'Last move was a play, so you must challenge or approve',
      };
    }

    nextState.turn += 1; // Increment turn. Only incremented for PASS, EXCHANGE and PLAY

    if (move.type === Moves.PASS) {
      // Only toggle player turn
      nextState.current = 1 - nextState.current;
      const result = { ...valid, state: nextState };
      this.history.push({ move, result });
      this.currentState = nextState;
      return result;
    }

    // Get current player object
    const player = nextState.players[nextState.current];
    const tiles = _.filter(move.tiles, tile => tile !== 0); // Filter tiles (zeros means no tile)
    if (tiles.length === 0) return { ...invalid, reason: 'No tiles played' };

    if (move.type === Moves.EXCHANGE) {
      // Check that every tile code is valid (Tile-Format-1)
      if (!_.every(tiles, ScrabbleUtils.isValidTileCode)) return { ...invalid, reason: 'Invalid tile codes' };
      // Try to remove tiles from player rack
      if (!ScrabbleUtils.removeFromRack(tiles, player.rack)) return { ...invalid, reason: "rack doesn't contain exchanged tiles" };
      // If number of tiles in bag is less than rack size (usually 7), reject the move
      if (nextState.bag.length < this.rackSize) return { ...invalid, reason: `Bag has less than ${this.rackSize} tiles` };
      // Get new tiles and remove them from bag
      const newTiles = nextState.bag.slice(0, tiles.length);
      nextState.bag = nextState.bag.slice(tiles.length);
      // Add the new tiles to the bag
      ScrabbleUtils.addToRack(newTiles, player.rack);
      // Use the stored RNG state to reshuffle the bag
      const prng = seedrandom('', { state: nextState.prng });
      nextState.bag = ScrabbleUtils.shuffle(
        _.concat(nextState.bag, tiles.sort()),
        () => prng.int32(),
      );
      // Then store the new RNG state
      nextState.prng = prng.state();
      // Toggle player turns
      nextState.current = 1 - nextState.current;
      const result = {
        ...valid,
        state: nextState,
        tiles: newTiles,
      };
      this.history.push({ move, result });
      this.currentState = nextState;
      return result;
    }

    if (move.type === Moves.PLAY) {
      // Direction must be 0 (R) or 1 (D)
      if (move.dir > 1) return { ...invalid, reason: 'Invalid Direction' };

      // Check that every tile is a valid playable tile (Tile-Format-2)
      if (!_.every(tiles, ScrabbleUtils.isValidPlayableTile)) return { ...invalid, reason: 'Invalid tile codes' };

      // Get original tiles and try to remove them from rack
      const originalTiles = _.map(tiles, ScrabbleUtils.getPlayableTileOrigin);
      if (!ScrabbleUtils.removeFromRack(originalTiles, player.rack)) return { ...invalid, reason: "Rack doesn't contain placed tiles" };

      // Get new tiles from bag and add them to player rack
      const newTiles = nextState.bag.slice(0, tiles.length);
      nextState.bag = nextState.bag.slice(tiles.length);
      ScrabbleUtils.addToRack(newTiles, player.rack);

      const position = { row: move.row - 1, col: move.col - 1 }; // position of first tile (decremented by 1 since indices start from 0)

      if (!ScrabbleUtils.inBounds(position, this.size)) return { ...invalid, reason: 'First position not in board bounds' };
      if (nextState.board[position.row][position.col]) return { ...invalid, reason: 'First position is not empty' };

      // We need to need to remember if the board was empty or not, to check of the move validity later
      const wasEmpty = _.every(nextState.board, row => _.every(row, tile => tile === 0));

      // Update board and get the major word (the unexpanded word created by the tiles in the move direction)
      const majorWord = ScrabbleUtils.updateBoard(
        tiles,
        position,
        move.dir,
        nextState.board,
        this.size,
      );
      // If major word is null, then the move tried to add tiles out of board bounds
      if (_.isNull(majorWord)) return { ...invalid, reason: 'Word goes out of board bounds' };
      // Minor words are words created by added tiles in the orthogonal direction of the move
      const minorWords = [];
      majorWord.forEach((letter) => {
        if (letter.src === 'rack') {
          const minorWord = ScrabbleUtils.expandWord(
            [letter],
            1 - move.dir,
            nextState.board,
            this.size,
          );
          if (minorWord.length > 1) minorWords.push(minorWord);
        }
      });
      ScrabbleUtils.expandWord(majorWord, move.dir, nextState.board, this.size);

      if (wasEmpty) {
        // If the board was empty bofore our move, then one of our tiles must be on the center square
        const center = {
          row: Math.trunc(this.size.rows / 2),
          col: Math.trunc(this.size.columns / 2),
        };
        if (
          !_.some(
            majorWord,
            tile => tile.position.row === center.row && tile.position.col === center.col,
          )
        ) {
          return {
            ...invalid,
            reason: 'First word is not on the center of the board',
          };
        }
      } else if (
        minorWords.length === 0
        && _.every(majorWord, tile => tile.src === 'rack')
      ) {
        // If there are no minor words and the major word is has no tile that was originally on the board
        // Then our move doesn't use any tiles that was on the board and this is invalid
        return {
          ...invalid,
          reason: "Word doesn't connect with other tiles on board",
        };
      }

      const words = majorWord.length > 1 ? _.concat([majorWord], minorWords) : minorWords;

      // Calculate the score of the move and check if it matches what the player sent
      const score = ScrabbleUtils.calculateScore(words, this.design, this.tileScores)
        + (tiles.length === this.rackSize ? this.bingo : 0);
      if (score !== move.score) {
        return {
          ...invalid,
          reason: `Score is incorrect, Correct value is ${score}`,
        };
      }

      player.score += score;
      nextState.current = 1 - nextState.current; // Toggle current player after applying the move

      // Check if the move creates any invalid words and put them in the result to be stored in history
      const invalidWords = [];
      words.forEach((word) => {
        const wordStr = _.map(
          word,
          letter => ScrabbleUtils.tileCodesToNames[
            ScrabbleUtils.getPlayableTileLetter(letter.tile)
          ],
        )
          .join('')
          .toLowerCase();
        if (!this.dictionary.has(wordStr)) {
          invalidWords.push({
            word: wordStr,
            row: word[0].position.row + 1,
            col: word[0].position.col + 1,
            dir: word[0].position.row === word[1].position.row ? 0 : 1,
          });
        }
      });

      const result = {
        ...valid,
        state: nextState,
        tiles: newTiles,
        score,
        invalidWords,
        tilesFinished: _.sum(_.values(player.rack)) === 0, // If all tiles are finished, then the game may end if the move is approved
      };
      this.history.push({ move, result });
      this.currentState = nextState;
      return result;
    }

    return { ...invalid, reason: 'Unknown Message Type' }; // If the move is neither of the above then it must be invalid
  }

  // Given the player's time, calculate a penalty if it is negative
  calculateTimePenalty(time) {
    return time < 0
      ? this.penalty.points * Math.ceil(-time / this.penalty.every)
      : 0;
  }

  // At the end of the game, each player must deduct from his score the sum of the tile scores in his rack
  calculateRemainingTilesPenalty(rack) {
    return _.sum(_.map(rack, (count, tile) => count * this.tileScores[tile]));
  }

  end(abrupt = false) {
    const finished = !abrupt;
    // If the game was ended abruptly (error or user stopped it)
    // Then we keep the last state as is (only update time)
    // Otherwise, we calculate the final scores
    if (this.running) {
      const next = _.cloneDeep(this.currentState);
      let result = { end: finished, state: next };
      // Update the time in the final state
      next.time = Math.max(0, this.timer.lap());
      next.players[next.current].time = next.time - next.players[1 - next.current].time;
      if (finished) {
        // If the game is finished, calculate final scores
        next.players.forEach((player) => {
          player.score
            -= this.calculateTimePenalty(player.time)
            + this.calculateRemainingTilesPenalty(player.rack);
        });
        const scores = _.map(next.players, player => player.score);
        // check who is the winner (0: player 1 won, 1: player 2 won, null: draw)
        let winner = null;
        if (scores[0] > scores[1]) winner = 0;
        else if (scores[0] < scores[1]) winner = 1;
        result = { scores, winner, ...result };
      }
      this.currentState = next;
      // Add an end event to the history
      this.history.push({ move: { type: Moves.END }, result });
      this.timer.stop();
      this.challengeTimer.stop();
      this.running = false;
      this.finished = finished; // Game is finished only if it did not end abruptly
    }
  }

  getCurrentInfo() {
    if (_.isNull(this.currentState)) {
      // If there are no state, the times and scores are zeros
      return { times: [0, 0], scores: [0, 0] };
    }
    const times = _.map(this.currentState.players, player => player.time);
    const scores = _.map(this.currentState.players, player => player.score);
    if (this.running) {
      // If the game is running, we must update currently displayed time
      const time = Math.max(0, this.timer.lap());
      times[this.currentState.current] = time - times[1 - this.currentState.current];
    }
    if (this.running || !this.finished) {
      // If the game is still running, we must show the points that each player lost
      // If the game ended abruptly, we should show the final scores yet too (confidential)
      for (let i = 0; i < 2; i += 1) {
        scores[i] -= this.calculateTimePenalty(times[i]);
      }
    }
    return { times, scores };
  }

  // Convert current state into a string
  toString() {
    const boardStr = ScrabbleUtils.convertBoardToString(
      this.currentState.board,
    );
    const bagStr = _.map(
      this.currentState.bag,
      tile => ScrabbleUtils.tileCodesToNames[tile],
    ).join();
    const playerToStr = player => `Score: ${player.score}, Time: ${timeformat(
      player.time,
    )}, rack: ${ScrabbleUtils.convertRackToString(player.rack)}`;
    return `Remaining Time: ${timeformat(
      this.currentState.time,
    )}\nBag: ${bagStr}\nCurrent Player: ${this.currentState.current
      + 1}\nPlayer 1: ${playerToStr(
      this.currentState.players[0],
    )}\nPlayer 2: ${playerToStr(this.currentState.players[1])}\n${boardStr}`;
  }
}

module.exports = Scrabble;
