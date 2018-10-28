const _ = require('lodash');
const fs = require('fs');
const dateFormat = require('dateformat');
const { timeparse, timeformat } = require('./utils/time');
const { ipcMain } = require('electron');
const WebSocket = require('ws');
const winston = require('winston');
const ScrabbleUtils = require('./utils/scrabble-utils');
const Scrabble = require('./scrabble');
const Structs = require('./utils/structs');
const { MessageTypes, EndReasons } = require('./utils/communication-enums');

const States = {
    INIT: 0,
    READY: 1,
    IDLE: 2,
    AWAIT_CHALLENGE: 3
};

const EventTypes = {
    CONNECT: 0,
    CLOSE: 1,
    MESSAGE: 2,
    START: 3,
    END: 4,
    DISCONNECT: 5,
    SWAP: 6
}

class Server {
    constructor(window){
        //Generate Logs and Checkpoints folder if not exists
        for(let dir of ['./logs/', './checkpoints/'])
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir);

        //Create a logger that outputs in log file named using the current timestamp
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(info =>  `${info.timestamp} ${info.level}: ${info.message}`)
            ),
            transports: [
                new winston.transports.File({ filename: `./logs/output-${dateFormat(new Date(), "yyyy-mm-dd-h-MM-ss")}.log`, handleExceptions: true })
            ]
        });

        this.logger.info("Starting Application ...");

        this.window = window;
        this.closing = false; //A Flag that is true only when the application is closing 

        //Set Event Listeners for UI Events
        ipcMain.on("swap", (event, data)=>{
            this.logger.info("User clicked swap");
            this.processEvent({type: EventTypes.SWAP, data:data});
        });
        ipcMain.on("start", (event, data)=>{
            this.logger.info("User clicked start");
            this.processEvent({type: EventTypes.START, source: "user", data:data});
        });
        ipcMain.on("disconnect", (event, data)=>{
            this.logger.info("User clicked disconnect");
            this.processEvent({type: EventTypes.DISCONNECT, source: "user", data:data});
        });
        ipcMain.on("stop", (event, data)=>{
            this.logger.info("User clicked stop");
            this.processEvent({type: EventTypes.END, reason: EndReasons.STOP_BUTTON_PRESSED});
        });

        this.state = States.INIT;

        this.config = JSON.parse(fs.readFileSync('config.json'));
        this.checkpointPath = './checkpoints/checkpoint.json';
        this.checkpoint = fs.existsSync(this.checkpointPath)?JSON.parse(fs.readFileSync(this.checkpointPath)):null;

        this.wss = new WebSocket.Server({
            host: this.config.host,
            port: this.config.port
        });

        this.logger.info("Starting Server ...")

        this.wss.on('listening', () => {
            this.logger.info("Server started and listening to " + this.config.host + ":" + this.config.port);
            this.updateStatusUI("Listening over " + this.config.host + ":" + this.config.port);
        });

        this.clients = [
            {connected: false, index: 0, name: null, ip: "0.0.0.0", ws: null},
            {connected: false, index: 1, name: null, ip: "0.0.0.0", ws: null}
        ];

        this.wss.on('connection', (ws, request) => {
            ws.isAlive = true;
            ws.on('pong', () => {ws.isAlive = true;});
            this.processEvent({type: EventTypes.CONNECT, ws: ws, request: request});
        });

        
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                if (ws.isAlive === false) {
                    this.logger.warn("Client terminated because it does not reply to pings");
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping(() => {});
            });
        }, timeparse(this.config["ping interval"]));
        

        this.game = new Scrabble(this.config, () => {
            this.logger.info("Time out");
            this.processEvent({type: EventTypes.END, reason: EndReasons.TIME_ENDED});
        }, () => {
            this.updateScoreBoardUI();
        });

        this.game.currentState = this.checkpoint;

        this.updateServerUI();
        this.updateGameUI();
    }

    writeCheckpoint(updateTimeOnly){
        this.logger.info("Writing a checkpoint to " + this.checkpointPath);
        if(updateTimeOnly && !_.isNull(this.checkpoint)){
            this.checkpoint.time = this.game.currentState.time;
            this.checkpoint.players[0].time = this.game.currentState.players[0].time;
            this.checkpoint.players[1].time = this.game.currentState.players[1].time;
        } else {
            this.checkpoint = _.cloneDeep(this.game.currentState);
        }
        fs.writeFile(this.checkpointPath, JSON.stringify(this.checkpoint, null, 4), err => {
            console.log(err);
        });
    }

    removeCheckpoint(){
        this.logger.info("Removing checkpoint file");
        if(fs.existsSync(this.checkpointPath))
            fs.unlinkSync(this.checkpointPath);
        if(!_.isNull(this.checkpoint)){
            fs.writeFile(`./checkpoints/checkpoint-${dateFormat(new Date(), "yyyy-mm-dd-h-MM-ss")}.json`, JSON.stringify(this.checkpoint, null, 4), err => {
                console.log(err);
            });
            this.checkpoint = null;
        }
    }

    updateScoreBoardUI(final){
        if(this.closing) return;
        let scores, times;
        if(final){
            scores = this.game.getScores();
            times = this.game.getTimes();
        }else{
            scores = this.game.getCurrentScores();
            times = this.game.getCurrentTimes();
        }
        this.window.webContents.send('update-scoreboard-ui', {
            time: _.sum(times),
            current: this.game.currentState.current,
            players: _.map(this.clients, (client, index) => ({
                name: client.name || "---",
                ip: client.ip,
                time: times[index],
                score: scores[index]
            }))
        });
    }

    updateGameUI(){
        if(this.closing) return;
        if(_.isNull(this.game.currentState)) return;
        let historyList = [], turn=0, player=this.game.history.length==0?0:this.game.history[0].result.state.current;
        for(let {move, result} of this.game.history){
            if(move.type == MessageTypes.START){
                historyList.push({
                    player: 2,
                    turn: '-',
                    text: 'Game Start',
                    result: ''
                });
            } else if(move.type == MessageTypes.END){
                historyList.push({
                    player: 3,
                    turn: '-',
                    text: 'Game End',
                    result: result.end?(_.isNull(result.winner)?"Draw":`Player${result.winner+1} won`):""
                });
            } else if(move.type == MessageTypes.PASS){
                historyList.push({
                    player: player,
                    turn: turn.toString(),
                    text: `Player${player+1}: PASS`,
                    result: ''
                });
                player = 1-player;
                turn++;
            } else if(move.type == MessageTypes.EXCHANGE){
                historyList.push({
                    player: player,
                    turn: turn.toString(),
                    text: `Player${player+1}: EXCHANGE ${_.filter(move.tiles, tile => tile!=0).length} Tile(s)`,
                    result: ''
                });
                player = 1-player;
                turn++;
            } else if(move.type == MessageTypes.PLAY){
                historyList.push({
                    player: player,
                    turn: turn.toString(),
                    text: `Player${player+1}: ${String.fromCharCode(64+move.col)}${move.row} ${move.dir==0?'RIGHT':'DOWN'} ${ScrabbleUtils.convertPlayedTilesToString(move.tiles)}`,
                    result: `${result.score>0?'+':''}${result.score}`
                });
                player = 1-player;
                turn++;
            } else if(move.type == MessageTypes.NO_CHALLENGE){
                historyList.push({
                    player: player,
                    turn: '-',
                    text: `Player${player+1}: APPROVE`,
                    result: result.missed?"Challenge Missed":""
                });
            } else if(move.type == MessageTypes.CHALLENGE){
                historyList.push({
                    player: player,
                    turn: '-',
                    text: `Player${player+1}: CHALLENGE`,
                    result: result.accepted?"Challenge Accepted":"Challenge Rejected"
                });
                if(!result.accepted) player = 1-player;
            }
        }
        this.window.webContents.send('update-game-ui', {
            board: this.game.currentState.board || _.times(15, () => _.times(15, _.constant(0))),
            history: historyList
        });
        this.updateScoreBoardUI();
    }

    updateServerUI(){
        if(this.closing) return;
        this.window.webContents.send('update-server-ui', {
            ready: this.state == States.READY,
            running: this.state == States.IDLE || this.state == States.AWAIT_CHALLENGE,
            hasCheckPoint: !_.isNull(this.checkpoint),
            clients: _.map(this.clients, client => ({connected: client.connected, index: client.index, name: client.name, ip: client.ip}))
        });
    }

    updateStatusUI(text){
        if(this.closing) return;
        this.window.webContents.send('update-status-ui', {text: text});
    }

    getCurrentPlayerTimeInfo(){
        return {
            time: this.game.getCurrentPlayer().time,
            total: this.game.currentState.time
        }
    }

    getCurrentClient(){
        return this.clients[this.game.currentState.current];
    }

    getOtherClient(){
        return this.clients[1 - this.game.currentState.current];
    }

    getCurrentPlayerName(){
        return this.clients[this.game.currentState.current].name;
    }

    getOtherPlayerName(){
        return this.clients[1 - this.game.currentState.current].name;
    }

    sendStartMessages(){
        let createStartMsg = (state, i) => ({
            type: MessageTypes.START,
            order: state.current==i?1:2,
            tiles: _.assign(_.fill(new Array(7), 0), _.flatten(_.map(state.players[i].hand, (count, tile) => _.times(count, _.constant(tile))))),
            board: _.flatten(state.board),
            score: state.players[i].score,
            opponent: state.players[1-i].score,
            time: state.players[i].time,
            total: state.time
        });

        for(let i = 0; i < 2; i++)
            this.clients[i].ws.send(Structs.StartStruct.pack(createStartMsg(this.game.currentState, i)));
    }

    sendEndMessages(reason){
        let scores = (reason == EndReasons.ALL_TILES_USED || reason == EndReasons.TIME_ENDED)?this.game.getScores():[0,0];

        for(let i = 0; i < 2; i++){
            let client = this.clients[i];
            if(client.connected){
                client.ws.send(Structs.EndStruct.pack({
                    type: MessageTypes.END,
                    reason: reason,
                    score: scores[i],
                    opponent: scores[1-i]
                }));
            }
        }
    }

    processEvent(event){
        //ANY HERE
        if(event.type == EventTypes.END){
            this.logger.info("Ending the game");
            this.game.end();
            this.sendEndMessages(event.reason);
            let isFinal = event.reason == EndReasons.ALL_TILES_USED || event.reason == EndReasons.TIME_ENDED;
            if(isFinal){
                this.logger.info("Game Ended");
                let scores = this.game.getScores();
                let times = this.game.getTimes();
                this.logger.info(`Player 1 got ${scores[0]} and remaining time is ${timeformat(times[0])}`);
                this.logger.info(`Player 2 got ${scores[1]} and remaining time is ${timeformat(times[1])}`);
                if(scores[0] > scores[1]) this.logger.info("Player 1 won");
                else if(scores[0] < scores[1]) this.logger.info("Player 2 won");
                else this.logger.info("It is a draw");
                this.removeCheckpoint();
            } else {
                this.logger.info("Game temporarily stopped");
                this.writeCheckpoint(true);
                this.game.currentState = this.checkpoint;
            }
            this.state = this.state==States.INIT?States.INIT:States.READY;
            this.updateServerUI();
            this.updateGameUI();
            this.updateScoreBoardUI(isFinal);
            this.updateStatusUI("Game Ended");
            
            return;
        }
        if(event.type == EventTypes.CONNECT){
            if(this.state != States.INIT){
                this.logger.info("A Client tried to connect while the server was busy");
                event.ws.close(1013, "Server Busy");
                return;
            }
        }
        if(event.type == EventTypes.CLOSE){
            if(event.client.connected){
                let client = event.client;
                this.logger.warn(`A Websocket ${client.ip} has been closed`);
                let name = client.name;
                client.connected = false;
                client.name = null;
                client.ip = "0.0.0.0";
                client.ws = null;
                if(_.includes(this.clients, client)){
                    this.logger.warn(name + " disconnected");
                    this.updateStatusUI(name + " disconnected");
                    if(this.state == States.IDLE || this.state == States.AWAIT_CHALLENGE){
                        setImmediate(() => {this.processEvent({type: EventTypes.END, reason: EndReasons.CONNECTION_ERROR});});
                    }
                    this.state = States.INIT;
                    this.updateServerUI();
                }
            }
            return;
        }
        if(event.type == EventTypes.DISCONNECT){
            let index = event.data.index;
            let client = this.clients[index];
            this.logger.info(`Disconnected "${client.name}" IP:${client.ip}`);
            if(client.connected)
                client.ws.close(1000, "Server disconnected you");
            return;
        }

        //NOT ANY... MORE :D
        if(this.state == States.INIT){
            if(event.type == EventTypes.CONNECT){
                let index = _.findIndex(this.clients, client => !client.connected);
                if(index == -1){
                    this.logger.warn("A client tried to connect while no slot is available");
                    event.ws.close(1013, "No slot for more connections");
                } else {
                    let client = {
                        index: index,
                        connected: true,
                        ip: event.request.connection.remoteAddress,
                        name: null,
                        ws: event.ws
                    };
                    this.logger.info(`A new client ${client.ip} is connected`);
                    this.clients[index] = client;
                    client.ws.on('message', message => {
                        this.logger.info("Received Buffer: " + [...event.message]);
                        this.processEvent({type: EventTypes.MESSAGE, message: message, client: client});
                    });
                    client.ws.on('error', (error) => {
                        this.logger.error(`Websocket Error for Client${client.index}: ${error}`);
                    });
                    client.ws.on('close', (code, reason) => {
                        this.logger.info(`Received Close Event: Code ${code} - ${reason} `);
                        this.processEvent({type: EventTypes.CLOSE, code: code, reason: reason, client: client});
                    });
                    client.ws.send(Structs.TypeStruct.pack({type: MessageTypes.NAME}));
                    this.updateServerUI();
                    this.updateStatusUI("Connection request from " + client.ip);
                }
            } else if(event.type == EventTypes.MESSAGE){
                if(event.message[0] == MessageTypes.NAME){
                    event.client.name = event.message.toString('utf8', 1);
                    this.logger.info(`Client ${event.client.ip} has sent their name: ${event.client.name}`);
                    if(_.every(this.clients, client => !_.isNull(client.name))){
                        this.logger.info("Server is now ready to start the game");
                        this.state = States.READY;
                    }
                    this.updateServerUI();
                    this.updateStatusUI("Hello, " + event.client.name + (this.state == States.READY? ", We are now ready":""));
                }
            }
        }else if(this.state == States.READY){
            if(event.type == EventTypes.SWAP){
                this.logger.info("Swapping first and second player");
                this.clients.reverse()
                for(let i = 0; i < 2; i++) this.clients[i].index = i;
                this.updateServerUI();
            } else if(event.type == EventTypes.START){
                if(event.data.useCheckPoint && !_.isNull(this.checkpoint)){
                    this.logger.info("Starting game from a Checkpoint");
                    this.game.startFromCheckpoint(this.checkpoint);
                } else {
                    this.logger.info("Starting game from seed: " + event.data.seed);
                    this.removeCheckpoint();
                    this.game.start(event.data.seed);
                    this.checkpoint = this.game.currentState;
                }
                this.sendStartMessages();

                this.state = States.IDLE;
                this.updateServerUI();
                this.updateGameUI();
                this.updateStatusUI("Game Started");
            }
        }else if(this.state == States.IDLE){
            if(event.type == EventTypes.MESSAGE){
                if(event.client.index == this.game.currentState.current){
                    switch(event.message[0]){
                        case MessageTypes.PASS: {
                            this.logger.info(`Player ${event.client.index+1} sent a PASS`);
                            this.game.apply({type: MessageTypes.PASS});
                            this.getCurrentClient().ws.send(Structs.TypeWithTimeStruct.pack({
                                type: MessageTypes.PASS,
                                ...this.getCurrentPlayerTimeInfo()
                            }));
                            this.updateGameUI();
                            this.updateStatusUI(`${this.getOtherPlayerName()} passed their turn`);
                            this.writeCheckpoint();
                            this.logger.info(this.game.toString());
                            break;
                        }
                        case MessageTypes.EXCHANGE: {
                            let move, result;
                            try {
                                move = Structs.TypeWithTilesStruct.unpack(event.message);
                                result = this.game.apply(move);
                                this.logger.info(`Player ${event.client.index+1} sent an EXCHANGE for ${ScrabbleUtils.convertRawTilesToString(move.tiles)}`);
                            } catch (error) {
                                result = {valid: false, reason: error.toString()};
                            }
                            if(result.valid){
                                this.logger.info(`Move is valid and Server will return ${ScrabbleUtils.convertRawTilesToString(result.tiles)}`);
                                this.getOtherClient().ws.send(Structs.TypeWithTilesStruct.pack({
                                    type: MessageTypes.EXCHANGE,
                                    tiles: _.assign(_.fill(new Array(7), 0), result.tiles)
                                }));
                                this.getCurrentClient().ws.send(Structs.TypeWithCountAndTimeStruct.pack({
                                    type: MessageTypes.EXCHANGE,
                                    count: result.tiles.length,
                                    ...this.getCurrentPlayerTimeInfo()
                                }));
                                this.updateGameUI();
                                this.updateStatusUI(`${this.getOtherPlayerName()} exchanged ${result.tiles.length} tile(s)`);
                                this.writeCheckpoint();
                                this.logger.info(this.game.toString());
                            } else {
                                this.logger.warn("Move is invalid: " + result.reason);
                                this.getCurrentClient().ws.send(Structs.TypeWithTimeStruct.pack({
                                    type: MessageTypes.INVALID,
                                    ...this.getCurrentPlayerTimeInfo()
                                }));
                            }
                            break;
                        }
                        case MessageTypes.PLAY: {
                            let move, result;
                            try {
                                move = Structs.PlayStruct.unpack(event.message);
                                result = this.game.apply(move);
                                this.logger.info(`Player ${event.client.index+1} sent an PLAY: ${String.fromCharCode(64+move.col)}${move.row} ${move.dir==0?'RIGHT':'DOWN'} ${ScrabbleUtils.convertPlayedTilesToString(move.tiles)}`);
                            } catch (error) {
                                result = {valid: false, reason: error.toString()};
                            }
                            if(result.valid){
                                this.logger.info(`Move is valid and Server will await a challenge from the other side`);
                                if(result.invalidWords.length > 0){
                                    this.logger.warn("Move has the following invalid words:");
                                    for(let word of result.invalidWords){
                                        this.logger.warn(`${word.word} at ${String.fromCharCode(64+word.col)}${word.row} ${word.dir==0?'RIGHT':'DOWN'}`)
                                    }
                                }
                                this.getCurrentClient().ws.send(Structs.PlayWithTimeStruct.pack({
                                    ...move,
                                    ...this.getCurrentPlayerTimeInfo()
                                }));
                                this.state = States.AWAIT_CHALLENGE;
                                this.updateGameUI();
                                this.updateStatusUI(`${this.getOtherPlayerName()} played, awaiting challenge ...`);
                                this.logger.info(this.game.toString());
                            } else {
                                this.logger.warn("Move is invalid: " + result.reason);
                                this.getCurrentClient().ws.send(Structs.TypeWithTimeStruct.pack({
                                    type: MessageTypes.INVALID,
                                    ...this.getCurrentPlayerTimeInfo()
                                }));
                            }
                            break;
                        }
                    }
                }
            }
        }else if(this.state == States.AWAIT_CHALLENGE){
            if(event.type == EventTypes.MESSAGE){
                if(event.client.index == this.game.currentState.current){
                    switch(event.message[0]){
                        case MessageTypes.NO_CHALLENGE: {
                            this.logger.info(`Player ${event.client.index+1} sent an Approval`);
                            let result = this.game.apply({type: MessageTypes.NO_CHALLENGE});
                            if(result.missed)
                                this.logger.warn("A chance to for acceptable challenge has been missed");
                            this.getOtherClient().ws.send(Structs.TypeWithTilesStruct.pack({
                                type: MessageTypes.NO_CHALLENGE,
                                tiles: _.assign(_.fill(new Array(7), 0), result.tiles)
                            }));
                            if(result.end){
                                this.logger.info("No more tiles are available, ending game ...");
                                setImmediate(() => {this.processEvent({type: EventTypes.END, reason: EndReasons.ALL_TILES_USED})});
                            }
                            this.state = States.IDLE;
                            this.updateGameUI();
                            this.updateStatusUI(`${this.getCurrentPlayerName()} didn't challenge`);
                            this.writeCheckpoint();
                            break;
                        }
                        case MessageTypes.CHALLENGE: {
                            this.logger.info(`Player ${event.client.index+1} sent an Challenge`);
                            let result = this.game.apply({type: MessageTypes.CHALLENGE});
                            if(result.accepted){
                                this.logger.info("Challenge Accepted");
                                this.getOtherClient().ws.send(Structs.TypeStruct.pack({
                                    type: MessageTypes.CHALLENGE_ACCEPTED
                                }));
                                this.getCurrentClient().ws.send(Structs.TypeWithTimeStruct.pack({
                                    type: MessageTypes.CHALLENGE_ACCEPTED,
                                    ...this.getCurrentPlayerTimeInfo()
                                }));
                                this.state = States.IDLE;
                                this.updateGameUI();
                                this.updateStatusUI(`${this.getCurrentPlayerName()} challenged and it is accepted`);
                                this.logger.info(this.game.toString());
                            } else {
                                this.logger.info(`Challenge Rejected. Server will send the following tiles: ${ScrabbleUtils.convertRawTilesToString(result.tiles)}`);
                                this.getOtherClient().ws.send(Structs.TypeStruct.pack({
                                    type: MessageTypes.CHALLENGE_REJECTED
                                }));
                                this.getCurrentClient().ws.send(Structs.TypeWithTilesAndTimeStruct.pack({
                                    type: MessageTypes.CHALLENGE_REJECTED,
                                    tiles: _.assign(_.fill(new Array(7), 0), result.tiles),
                                    ...this.getCurrentPlayerTimeInfo()
                                }));
                                if(result.end){
                                    this.logger.info("No more tiles are available, ending game ...");
                                    setImmediate(() => {this.processEvent({type: EventTypes.END, reason: EndReasons.ALL_TILES_USED})});
                                }
                                this.state = States.IDLE;
                                this.updateGameUI();
                                this.updateStatusUI(`${this.getOtherPlayerName()} challenged and it is rejected`);
                                this.writeCheckpoint();
                            }
                            break;
                        }
                    }
                }
            }
        }
    }

    close(){
        this.closing = true;
        this.wss.close();
        this.logger.info("Closing Application");
        this.logger.close();
    }

};

module.exports = Server;