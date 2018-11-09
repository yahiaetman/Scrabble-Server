const _ = require('lodash');
const fs = require('fs');
const dateFormat = require('dateformat');
// eslint-disable-next-line import/no-extraneous-dependencies
const { ipcMain } = require('electron');
const WebSocket = require('ws');
const winston = require('winston');
const { timeparse, timeformat } = require('./utils/time');
const ScrabbleUtils = require('./utils/scrabble-utils');
const Scrabble = require('./scrabble');
const Structs = require('./utils/structs');
const { MessageTypes, EndReasons } = require('./utils/communication-enums');

const States = {
  // The server listens to connection requests till 2 client are connected and identified
  INIT: 0,
  // In this state, the server is ready to start a game.
  READY: 1,
  // A game is running and the current player can send a PASS, EXCHANGE or PLAY
  IDLE: 2,
  // The previous player sent a PLAY and the current player should send CHALLENGE or NO_CHALLENGE
  AWAIT_CHALLENGE: 3,
};

const EventTypes = {
  CONNECT: 0, // A Client wants to connect to the server
  CLOSE: 1, // A Client connection is closed
  MESSAGE: 2, // A Client sent a message
  START: 3, // The User pressed Start
  END: 4, // The game ended for one of the reasons found in enum EndReasons
  DISCONNECT: 5, // The User pressed disconnect for one of the clients
  SWAP: 6, // The User swapped the order of the clients
  CHALLENGE_TIME_ENDED: 7, // No Challenge was recieved in the allocated time
};

const EndMessages = {
  [EndReasons.TIME_ENDED]: 'Time Out',
  [EndReasons.ALL_TILES_USED]: 'All Tiles Used',
  [EndReasons.CONNECTION_ERROR]: 'Connection Error',
  [EndReasons.STOP_BUTTON_PRESSED]: 'Stop Button was Pressed',
};

class Server {
  constructor(window) {
    // Generate Logs and Checkpoints folder if not exists
    ['./logs/', './checkpoints/'].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    });

    // Create a logger that outputs in log file named using the current timestamp
    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`),
      ),
      transports: [
        new winston.transports.File({
          filename: `./logs/output-${dateFormat(new Date(), 'yyyy-mm-dd-h-MM-ss')}.log`,
          handleExceptions: true,
        }),
      ],
      exitOnError: (err) => {
        this.updateStatusUI(`${err.name} occurred. See logs for more info`);
        return false;
      },
    });

    this.logger.info('Starting Application ...');

    this.window = window;
    this.closing = false; // A Flag that is true only when the application is closing

    // Set Event Listeners for UI Events
    ipcMain.on('swap', (event, data) => {
      this.logger.info('User clicked swap');
      this.processEvent({ type: EventTypes.SWAP, data });
    });
    ipcMain.on('start', (event, data) => {
      this.logger.info('User clicked start');
      this.processEvent({ type: EventTypes.START, source: 'user', data });
    });
    ipcMain.on('disconnect', (event, data) => {
      this.logger.info('User clicked disconnect');
      this.processEvent({ type: EventTypes.DISCONNECT, source: 'user', data });
    });
    ipcMain.on('stop', () => {
      this.logger.info('User clicked stop');
      this.processEvent({ type: EventTypes.END, reason: EndReasons.STOP_BUTTON_PRESSED });
    });

    // Initial State
    this.state = States.INIT;

    // Read configuration and checkpoint if any
    this.config = JSON.parse(fs.readFileSync('config.json'));
    this.checkpointPath = './checkpoints/checkpoint.json';
    this.checkpoint = fs.existsSync(this.checkpointPath)
      ? JSON.parse(fs.readFileSync(this.checkpointPath))
      : null;

    // Start the websocket server
    this.wss = new WebSocket.Server({
      host: this.config.host,
      port: this.config.port,
    });

    this.logger.info('Starting Server ...');

    // This event will occur when the server successfully starts listening to a port
    this.wss.on('listening', () => {
      this.logger.info(`Server started and listening to ${this.config.host}:${this.config.port}`);
      this.updateStatusUI(`Listening over ${this.config.host}:${this.config.port}`);
    });

    // A List to store info and websocket for connected clients
    this.clients = [
      {
        connected: false,
        index: 0,
        name: null,
        ip: '0.0.0.0',
        ws: null,
      },
      {
        connected: false,
        index: 1,
        name: null,
        ip: '0.0.0.0',
        ws: null,
      },
    ];

    // This is called whenever a client requests a connection
    this.wss.on('connection', (ws, request) => {
      // This is used by the heartbeat system (ping-pong) to check if a client is still responding
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      // Whenever the server sends a "ping" to a client, the client should reply with "pong"
      // So that the server knows it is alive
      this.processEvent({ type: EventTypes.CONNECT, ws, request });
    });

    // The heartbeat system (ping-pongs) is used to check if client is alive
    // Eveny ping interval, the server will send a ping to all its clients and await a pong
    // If no pong is received till next ping, then the client is dead and should be terminated
    this.heartbeat = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          this.logger.warn('Client terminated because it does not reply to pings');
          ws.terminate();
        } else {
          ws.isAlive = false;
          ws.ping(() => {});
        }
      });
    }, timeparse(this.config['ping interval']));

    // Create a scrabble game with the given configuration
    this.game = new Scrabble(this.config, {
      timeoutCallback: () => {
        // This callback is called when the time is out
        this.logger.info('Time Out');
        this.processEvent({ type: EventTypes.END, reason: EndReasons.TIME_ENDED });
      },
      challengeTimeoutCallback: () => {
        // This callback is called when the challenge time is out
        this.logger.info('Challenge time ended without recieving a message');
        this.processEvent({ type: EventTypes.CHALLENGE_TIME_ENDED });
      },
      intervalCallback: () => {
        // This callback is called every second
        this.updateScoreBoardUI();
      },
    });

    // Set current game state to checkpoint if any exists
    this.game.currentState = this.checkpoint;

    this.window.webContents.send('set-board-design', {
      design: this.config.design,
    });

    // Update UI
    this.updateServerUI();
    this.updateGameUI();
    this.updateScoreBoardUI();
  }

  writeCheckpoint(updateTimeOnly) {
    this.logger.info(`Writing a checkpoint to ${this.checkpointPath}`);
    if (updateTimeOnly && !_.isNull(this.checkpoint)) {
      // If UpdateTimeOnly is true, only update player times in latest checkpoint
      this.checkpoint.time = this.game.currentState.time;
      this.checkpoint.players[0].time = this.game.currentState.players[0].time;
      this.checkpoint.players[1].time = this.game.currentState.players[1].time;
    } else {
      // Copy current state into checkpoint
      this.checkpoint = _.cloneDeep(this.game.currentState);
    }
    // write checkpoint in JSON format into the checkpoint file
    fs.writeFile(this.checkpointPath, JSON.stringify(this.checkpoint), (err) => {
      if (err) this.logger.error(`Counld not save checkpoint: ${err}`);
    });
  }

  removeCheckpoint(saveFinal) {
    // When the game truly ends, Remove the checkpoint
    // Then save the final state into timestamp-marked file as a log
    this.checkpoint = null;
    if (fs.existsSync(this.checkpointPath)) {
      this.logger.info('Removing checkpoint file');
      fs.unlinkSync(this.checkpointPath);
    } else {
      this.logger.info('No checkpoint file found, so no file will be removed');
    }
    if (saveFinal && !_.isNull(this.game.currentState)) {
      const filepath = `./checkpoints/final-${dateFormat(new Date(), 'yyyy-mm-dd-h-MM-ss')}.json`;
      this.logger.info(`Saving the final state into: ${filepath}`);
      fs.writeFile(filepath, JSON.stringify(this.game.currentState), (err) => {
        if (err) this.logger.error(`Counld not save final state: ${err}`);
      });
    }
  }

  updateScoreBoardUI() {
    if (this.closing || _.isNull(this.game.currentState)) return;
    const { times, scores } = this.game.getCurrentInfo();

    // Send an message to Renderer thread to update scoreboard
    this.window.webContents.send('update-scoreboard-ui', {
      time: _.sum(times),
      current: this.game.currentState.current,
      challengeTime: this.game.challengeTimer.lap(),
      awaitingChallenge: this.state === States.AWAIT_CHALLENGE,
      players: _.map(this.clients, (client, index) => ({
        name: client.name || '---',
        time: times[index],
        score: scores[index],
      })),
    });
  }

  updateGameUI() {
    if (this.closing) return;
    if (_.isNull(this.game.currentState)) return;
    // Create a history list to display on the renderer
    // NOTE: only send displayed info since sending data requires is expensive
    const history = this.game.history.map(({ move, result }) => {
      switch (move.type) {
        case MessageTypes.START:
          return {
            player: 2,
            turn: '-',
            text: 'Game Start',
            result: '',
          };
        case MessageTypes.END: {
          let resultText;
          if (result.end) {
            resultText = _.isNull(result.winner) ? 'Draw' : `Player${result.winner + 1} won`;
          } else {
            resultText = 'Game Ended Abruptly';
          }
          return {
            player: 3,
            turn: '-',
            text: 'Game End',
            result: resultText,
          };
        }
        case MessageTypes.PASS:
          return {
            player: result.player,
            turn: result.state.turn.toString(),
            text: `Player${result.player + 1}: PASS`,
            result: '',
          };
        case MessageTypes.EXCHANGE:
          return {
            player: result.player,
            turn: result.state.turn.toString(),
            text: `Player${result.player + 1}: EXCHANGE ${
              _.filter(move.tiles, tile => tile !== 0).length
            } Tile(s)`,
            result: '',
          };
        case MessageTypes.PLAY:
          return {
            player: result.player,
            turn: result.state.turn.toString(),
            text: `Player${result.player + 1}: ${String.fromCharCode(64 + move.col)}${move.row} ${
              move.dir === 0 ? 'RIGHT' : 'DOWN'
            } ${ScrabbleUtils.convertPlayableTilesToString(move.tiles)}`,
            result: `${result.score > 0 ? '+' : ''}${result.score}`,
          };
        case MessageTypes.NO_CHALLENGE:
          return {
            player: result.player,
            turn: '-',
            text: `Player${result.player + 1}: APPROVE`,
            result: result.missed ? 'Challenge Missed' : '',
          };
        case MessageTypes.CHALLENGE:
          return {
            player: result.player,
            turn: '-',
            text: `Player${result.player + 1}: CHALLENGE`,
            result: result.accepted ? 'Challenge Accepted' : 'Challenge Rejected',
          };
        default:
          return {
            player: null,
            turn: '-',
            text: '',
            result: '',
          };
      }
    });
    // Send an message to Renderer thread to update board and history list
    this.window.webContents.send('update-game-ui', {
      board: this.game.currentState.board || _.times(15, () => _.times(15, _.constant(0))),
      history,
    });
    // Also update score board
    this.updateScoreBoardUI();
  }

  updateServerUI() {
    if (this.closing) return;
    // Send an message to Renderer thread to update server control UI
    this.window.webContents.send('update-server-ui', {
      ready: this.state === States.READY,
      running: this.state === States.IDLE || this.state === States.AWAIT_CHALLENGE,
      hasCheckPoint: !_.isNull(this.checkpoint),
      clients: _.map(this.clients, client => ({
        connected: client.connected,
        index: client.index,
        name: client.name,
        ip: client.ip,
      })),
    });
  }

  updateStatusUI(text) {
    if (this.closing) return;
    // Send an message to Renderer thread to update status
    this.window.webContents.send('update-status-ui', { text });
  }

  getCurrentPlayerTimeInfo() {
    // Get time info to be sent to current player
    return {
      time: this.game.currentState.players[this.game.currentState.current].time,
      total: this.game.currentState.time,
    };
  }

  getCurrentClient() {
    // Get the client object of the player whose turn is pending right now
    return this.clients[this.game.currentState.current];
  }

  getOtherClient() {
    // Get the client object of the other player (opponent of the one who has the current turn)
    return this.clients[1 - this.game.currentState.current];
  }

  getCurrentPlayerName() {
    // Get name of current player
    return this.clients[this.game.currentState.current].name;
  }

  getOtherPlayerName() {
    // Get name of opponent player
    return this.clients[1 - this.game.currentState.current].name;
  }

  sendStartMessages() {
    // Send messages to client to start a game
    // The message will include the starting state
    const createStartMessage = (state, i) => ({
      type: MessageTypes.START,
      order: state.current === i ? 1 : 2,
      tiles: _.assign(
        _.fill(new Array(7), 0),
        _.flatten(_.map(state.players[i].rack, (count, tile) => _.times(count, _.constant(tile)))),
      ),
      board: _.flatten(state.board),
      score: state.players[i].score,
      opponent: state.players[1 - i].score,
      time: state.players[i].time,
      total: state.time,
    });

    this.clients.forEach((client) => {
      const message = createStartMessage(this.game.currentState, client.index);
      const buffer = Structs.StartStruct.pack(message);
      client.ws.send(buffer);
    });
  }

  sendEndMessages(reason) {
    // If game really ended (not prematurely), send final scores, otherwise, send zeros
    const { scores } = this.game.getCurrentInfo();

    // Send messages to stop the game
    this.clients.forEach((client) => {
      if (client.connected) {
        client.ws.send(
          Structs.EndStruct.pack({
            type: MessageTypes.END,
            reason,
            score: scores[client.index],
            opponent: scores[1 - client.index],
          }),
        );
      }
    });
  }

  processEvent(event) {
    // First, Process Events that should run similarly despite the current state
    // Denoted as ANY in the communication document
    if (event.type === EventTypes.END) {
      this.logger.info(`Ending the game: ${EndMessages[event.reason]}`);
      // Check if the game actually ended (not prematurely)
      const finished = _.includes([EndReasons.ALL_TILES_USED, EndReasons.TIME_ENDED], event.reason);
      // End game (send true if game end is abrupt)
      this.game.end(!finished);
      // Send End Messages
      this.sendEndMessages(event.reason);
      if (finished) {
        // If game is finished, display results in log and remove the checkpoint
        this.logger.info('Game Ended');
        const { times, scores } = this.game.getCurrentInfo();
        this.logger.info(`Player 1 got ${scores[0]} and remaining time is ${timeformat(times[0])}`);
        this.logger.info(`Player 2 got ${scores[1]} and remaining time is ${timeformat(times[1])}`);
        if (scores[0] > scores[1]) this.logger.info('Player 1 won');
        else if (scores[0] < scores[1]) this.logger.info('Player 2 won');
        else this.logger.info('It is a draw');
        this.removeCheckpoint(true);
      } else {
        // If game end is abrupt, update checkpoint and display it as the current state
        this.logger.info('Game temporarily stopped');
        this.writeCheckpoint(true);
        this.game.currentState = this.checkpoint;
      }
      // If game state was INIT then a client was disconnected so stay in INIT
      // otherwise go to READY
      this.state = this.state === States.INIT ? States.INIT : States.READY;
      this.updateServerUI();
      this.updateGameUI();
      this.updateScoreBoardUI();
      this.updateStatusUI(`Game Ended: ${EndMessages[event.reason]}`);
      return;
    }

    if (event.type === EventTypes.CONNECT) {
      // The server is not in init state then 2 clients are already connected
      if (this.state !== States.INIT) {
        this.logger.info('A Client tried to connect while the server was busy');
        event.ws.close(1013, 'Server Busy');
        return;
      }
    }

    if (event.type === EventTypes.CLOSE) {
      // Remove data of closed client, if not already removed
      if (event.client.connected) {
        const { client } = event;
        this.logger.warn(`A Websocket ${client.ip} has been closed`);
        const { name } = client;
        client.connected = false;
        client.name = null;
        client.ip = '0.0.0.0';
        client.ws = null;
        // Some times we received CLOSE for client which is no longer in our list
        // so we need to check if we should process it
        if (_.includes(this.clients, client)) {
          this.logger.warn(`${name} disconnected`);
          this.updateStatusUI(`${name} disconnected`);
          if (this.state === States.IDLE || this.state === States.AWAIT_CHALLENGE) {
            // If the game was running, send an END event at the end of the current event loop
            process.nextTick(() => {
              this.processEvent({ type: EventTypes.END, reason: EndReasons.CONNECTION_ERROR });
            });
          }
          this.state = States.INIT;
          this.updateServerUI();
        }
      }
      return;
    }

    if (event.type === EventTypes.DISCONNECT) {
      // User requested to disconnect a certain client
      const { index } = event.data;
      const client = this.clients[index];
      this.logger.info(`Disconnected "${client.name}" IP:${client.ip}`);
      if (client.connected) client.ws.close(1000, 'Server disconnected you');
      return;
    }

    // Process events that are start from a specific state
    if (this.state === States.INIT) {
      if (event.type === EventTypes.CONNECT) {
        // Find an empty client slot
        const index = _.findIndex(this.clients, client => !client.connected);
        if (index === -1) {
          // If no empty slot exists, close connection
          this.logger.warn('A client tried to connect while no slot is available');
          event.ws.close(1013, 'No slot for more connections');
        } else {
          // Create a new client object and replace the empty one
          // NOTE: the empty one is replaced instead of reused
          // because an old websocket may still reference it when triggering events
          const client = {
            index,
            connected: true,
            ip: event.request.connection.remoteAddress,
            name: null,
            ws: event.ws,
          };
          this.logger.info(`A new client ${client.ip} is connected`);
          this.clients[index] = client;
          // Set callbacks for new client
          client.ws.on('message', (message) => {
            if (typeof message === 'string') {
              // We shouldn't receive string, since we only use buffers
              this.logger.warn(`Received a String Message: ${message}`);
            } else {
              this.logger.info(`Received: ${[...message]}`);
              this.processEvent({ type: EventTypes.MESSAGE, message, client });
            }
          });
          client.ws.on('error', (error) => {
            // Any error will automatically fire a close event after it is done
            this.logger.error(`Websocket Error for Client${client.index}: ${error}`);
          });
          client.ws.on('close', (code, reason) => {
            this.logger.info(`Received Close Event: Code ${code} - ${reason} `);
            this.processEvent({
              type: EventTypes.CLOSE,
              code,
              reason,
              client,
            });
          });
          // Send a message to request name, right after connection
          client.ws.send(Structs.TypeStruct.pack({ type: MessageTypes.NAME }));
          this.updateServerUI();
          this.updateStatusUI(`Connection request from ${client.ip}`);
        }
      } else if (event.type === EventTypes.MESSAGE) {
        if (event.message[0] === MessageTypes.NAME) {
          // Read name sent by client
          event.client.name = event.message.toString('utf8', 1);
          this.logger.info(`Client ${event.client.ip} has sent their name: ${event.client.name}`);
          if (_.every(this.clients, client => !_.isNull(client.name))) {
            // If 2 clients are now connected and identified, we are ready to start a game
            this.logger.info('Server is now ready to start the game');
            this.state = States.READY;
          }
          this.updateServerUI();
          this.updateStatusUI(
            `Hello, ${event.client.name}${this.state === States.READY ? ', We are now ready' : ''}`,
          );
        }
      }
    } else if (this.state === States.READY) {
      if (event.type === EventTypes.SWAP) {
        // Swap player players if user pressed swap
        this.logger.info('Swapping first and second player');
        this.clients.reverse();
        this.clients.forEach((client, index) => {
          client.index = index;
        });
        this.updateServerUI();
      } else if (event.type === EventTypes.START) {
        if (event.data.useCheckPoint && !_.isNull(this.checkpoint)) {
          // If user pressed pause, start from a checkpoint if any exists
          this.logger.info('Starting game from a Checkpoint');
          this.game.startFromCheckpoint(this.checkpoint);
        } else {
          this.logger.info(`Starting game from seed: ${event.data.seed}`);
          this.removeCheckpoint(false); // Remove old checkpoint if exists
          this.game.start(event.data.seed);
          this.checkpoint = this.game.currentState;
        }
        // Send START messages to both clients
        this.sendStartMessages();
        this.state = States.IDLE;
        this.updateServerUI();
        this.updateGameUI();
        this.updateStatusUI('Game Started');
      }
    } else if (this.state === States.IDLE) {
      if (event.type === EventTypes.MESSAGE) {
        // Check if message is sent from current player
        if (event.client.index === this.game.currentState.current) {
          switch (
            event.message[0] // Message type is always stored in first byte
          ) {
            case MessageTypes.PASS: {
              this.game.timer.pause(); // Pause timer before doing our computations
              this.logger.info(`Player ${event.client.index + 1} sent a PASS`);
              this.game.apply({ type: MessageTypes.PASS });
              this.getCurrentClient().ws.send(
                Structs.TypeWithTimeStruct.pack({
                  type: MessageTypes.PASS,
                  ...this.getCurrentPlayerTimeInfo(),
                }),
              );
              this.updateGameUI();
              this.updateStatusUI(`${this.getOtherPlayerName()} passed their turn`);
              this.writeCheckpoint();
              this.logger.info(this.game.toString());
              this.game.timer.pause(); // Unpause timer after doing our computations
              break;
            }
            case MessageTypes.EXCHANGE: {
              this.game.timer.pause(); // Pause timer before doing our computations
              let move;
              let result;
              try {
                move = Structs.TypeWithTilesStruct.unpack(event.message);
                result = this.game.apply(move);
                this.logger.info(
                  `Player ${event.client.index
                    + 1} sent an EXCHANGE for ${ScrabbleUtils.convertTilesToString(move.tiles)}`,
                );
              } catch (error) {
                // Trying to unpack a message with incorrect size will cause an exception
                result = { valid: false, reason: error.toString() };
              }
              if (result.valid) {
                this.logger.info(
                  `Move is valid and Server will return ${ScrabbleUtils.convertTilesToString(
                    result.tiles,
                  )}`,
                );
                this.getOtherClient().ws.send(
                  Structs.TypeWithTilesStruct.pack({
                    type: MessageTypes.EXCHANGE,
                    tiles: _.assign(_.fill(new Array(7), 0), result.tiles),
                  }),
                );
                this.getCurrentClient().ws.send(
                  Structs.TypeWithCountAndTimeStruct.pack({
                    type: MessageTypes.EXCHANGE,
                    count: result.tiles.length,
                    ...this.getCurrentPlayerTimeInfo(),
                  }),
                );
                this.updateGameUI();
                this.updateStatusUI(
                  `${this.getOtherPlayerName()} exchanged ${result.tiles.length} tile(s)`,
                );
                this.writeCheckpoint();
                this.logger.info(this.game.toString());
              } else {
                this.logger.warn(`Move is invalid: ${result.reason}`);
                this.getCurrentClient().ws.send(
                  Structs.TypeWithTimeStruct.pack({
                    type: MessageTypes.INVALID,
                    ...this.getCurrentPlayerTimeInfo(),
                  }),
                );
              }
              this.game.timer.pause(); // Unpause timer after doing our computations
              break;
            }
            case MessageTypes.PLAY: {
              this.game.timer.pause();
              let move;
              let result;
              try {
                move = Structs.PlayStruct.unpack(event.message);
                result = this.game.apply(move);
                this.logger.info(
                  `Player ${event.client.index + 1} sent an PLAY: ${String.fromCharCode(
                    64 + move.col,
                  )}${move.row} ${
                    move.dir === 0 ? 'RIGHT' : 'DOWN'
                  } ${ScrabbleUtils.convertPlayableTilesToString(move.tiles)}`,
                );
              } catch (error) {
                // Trying to unpack a message with incorrect size will cause an exception
                result = { valid: false, reason: error.toString() };
              }
              if (result.valid) {
                this.logger.info(
                  'Move is valid and Server will await a challenge from the other side',
                );
                if (result.invalidWords.length > 0) {
                  this.logger.warn('Move has the following invalid words:');
                  result.invalidWords.forEach((word) => {
                    this.logger.warn(
                      `${word.word} at ${String.fromCharCode(64 + word.col)}${word.row} ${
                        word.dir === 0 ? 'RIGHT' : 'DOWN'
                      }`,
                    );
                  });
                }
                this.getCurrentClient().ws.send(
                  Structs.PlayWithTimeStruct.pack({
                    ...move,
                    challenge: this.game.challengeTimespan,
                    ...this.getCurrentPlayerTimeInfo(),
                  }),
                );
                this.state = States.AWAIT_CHALLENGE;
                this.updateGameUI();
                this.updateStatusUI(`${this.getOtherPlayerName()} played, awaiting challenge ...`);
                this.logger.info(this.game.toString());
                this.game.challengeTimer.start(this.game.challengeTimespan);
              } else {
                this.logger.warn(`Move is invalid: ${result.reason}`);
                this.getCurrentClient().ws.send(
                  Structs.TypeWithTimeStruct.pack({
                    type: MessageTypes.INVALID,
                    ...this.getCurrentPlayerTimeInfo(),
                  }),
                );
                this.game.timer.pause();
              }
              break;
            }
            default:
              this.logger.error(
                `Received unexpected message from player ${event.client.index + 1}`,
              );
          }
        } else {
          this.logger.error(
            `Received message from player ${event.client.index + 1} out of their turn`,
          );
        }
      }
    } else if (this.state === States.AWAIT_CHALLENGE) {
      if (event.type === EventTypes.MESSAGE) {
        // Check if message is sent from current player
        if (event.client.index === this.game.currentState.current) {
          switch (
            event.message[0] // Message type is always stored in first byte
          ) {
            case MessageTypes.NO_CHALLENGE: {
              this.game.challengeTimer.stop();
              this.logger.info(`Player ${event.client.index + 1} sent an Approval`);
              const result = this.game.apply({ type: MessageTypes.NO_CHALLENGE });
              if (result.missed) this.logger.warn('A chance for an acceptable challenge has been missed');
              this.getOtherClient().ws.send(
                Structs.TypeWithTilesStruct.pack({
                  type: MessageTypes.NO_CHALLENGE,
                  tiles: _.assign(_.fill(new Array(7), 0), result.tiles),
                }),
              );
              if (result.end) {
                this.logger.info('No more tiles are available, ending game ...');
                process.nextTick(() => {
                  this.processEvent({ type: EventTypes.END, reason: EndReasons.ALL_TILES_USED });
                });
              }
              this.state = States.IDLE;
              this.updateGameUI();
              this.updateStatusUI(`${this.getCurrentPlayerName()} didn't challenge`);
              this.writeCheckpoint();
              this.game.timer.pause();
              break;
            }
            case MessageTypes.CHALLENGE: {
              this.game.challengeTimer.stop();
              this.logger.info(`Player ${event.client.index + 1} sent an Challenge`);
              const result = this.game.apply({ type: MessageTypes.CHALLENGE });
              if (result.accepted) {
                this.logger.info('Challenge Accepted');
                this.getOtherClient().ws.send(
                  Structs.TypeStruct.pack({
                    type: MessageTypes.CHALLENGE_ACCEPTED,
                  }),
                );
                this.getCurrentClient().ws.send(
                  Structs.TypeWithTimeStruct.pack({
                    type: MessageTypes.CHALLENGE_ACCEPTED,
                    ...this.getCurrentPlayerTimeInfo(),
                  }),
                );
                this.state = States.IDLE;
                this.updateGameUI();
                this.updateStatusUI(`${this.getCurrentPlayerName()} challenged and it is accepted`);
                this.logger.info(this.game.toString());
              } else {
                this.logger.info(
                  `Challenge Rejected. Server will send the following tiles: ${ScrabbleUtils.convertTilesToString(
                    result.tiles,
                  )}`,
                );
                this.getOtherClient().ws.send(
                  Structs.TypeStruct.pack({
                    type: MessageTypes.CHALLENGE_REJECTED,
                  }),
                );
                this.getCurrentClient().ws.send(
                  Structs.TypeWithTilesAndTimeStruct.pack({
                    type: MessageTypes.CHALLENGE_REJECTED,
                    tiles: _.assign(_.fill(new Array(7), 0), result.tiles),
                    ...this.getCurrentPlayerTimeInfo(),
                  }),
                );
                if (result.end) {
                  this.logger.info('No more tiles are available, ending game ...');
                  process.nextTick(() => {
                    this.processEvent({ type: EventTypes.END, reason: EndReasons.ALL_TILES_USED });
                  });
                }
                this.state = States.IDLE;
                this.updateGameUI();
                this.updateStatusUI(`${this.getOtherPlayerName()} challenged and it is rejected`);
                this.writeCheckpoint();
              }
              this.game.timer.pause();
              break;
            }
            default:
              this.logger.error(
                `Received unexpected message from player ${event.client.index + 1}`,
              );
          }
        } else {
          this.logger.error(
            `Received message from player ${event.client.index + 1} out of their turn`,
          );
        }
      } else if (event.type === EventTypes.CHALLENGE_TIME_ENDED) {
        this.game.challengeTimer.stop();
        this.logger.info(
          'Nothing recieved from player withing challenge period, defaulting to NO CHALLENGE',
        );
        const result = this.game.apply({ type: MessageTypes.NO_CHALLENGE });
        if (result.missed) this.logger.warn('A chance for an acceptable challenge has been missed');
        this.getCurrentClient().ws.send(
          Structs.TypeWithTimeStruct.pack({
            type: MessageTypes.NO_CHALLENGE,
            ...this.getCurrentPlayerTimeInfo(),
          }),
        );
        this.getOtherClient().ws.send(
          Structs.TypeWithTilesStruct.pack({
            type: MessageTypes.NO_CHALLENGE,
            tiles: _.assign(_.fill(new Array(7), 0), result.tiles),
          }),
        );
        if (result.end) {
          this.logger.info('No more tiles are available, ending game ...');
          process.nextTick(() => {
            this.processEvent({ type: EventTypes.END, reason: EndReasons.ALL_TILES_USED });
          });
        }
        this.state = States.IDLE;
        this.updateGameUI();
        this.updateStatusUI(
          `${this.getCurrentPlayerName()} didn't reply within challenge timespan`,
        );
        this.writeCheckpoint();
        this.game.timer.pause();
      }
    }
  }

  close() {
    this.closing = true;
    clearInterval(this.heartbeat);
    this.wss.close();
    this.logger.info('Closing Application');
    this.logger.close();
  }
}

module.exports = Server;
