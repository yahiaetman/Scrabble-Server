<template>
    <div class="window">
        <div class="title-bar">
            <button class="circle-button close" @click="close"></button>
            <button class="circle-button minimize" @click="minimize"></button>
            <button class="circle-button maximize" @click="maximize"></button>
        </div>
        <div class="window-content">
            <history :history="history"/>
            <board :board="board"/>
            <control :ready="ready" :running="running" :clients="clients" :has-check-point="hasCheckPoint"/>
            <score-board :status="status" :time="time" :current="current" :players="players"/>
        </div>
    </div>
</template>

<script>
import History from "./components/History";
import ScoreBoard from "./components/ScoreBoard";
import Board from "./components/Board";
import Control from "./components/Control";

export default {
    data(){
        return {
            status: "Server Starting ...",
            clients: [
                {connected: false, index: 0, name: null, ip: ""},
                {connected: false, index: 1, name: null, ip: ""}
            ],
            ready: false,
            running: false,
            hasCheckPoint: false,
            board:[
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
                [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
            ],
            time: 0,
            current: 0,
            players: [
                {name:"----", ip: "127.0.0.1", time: 0, score: 0},
                {name:"----", ip: "127.0.0.1", time: 0, score: 0}
            ],
            history: []
        }
    },
    mounted(){
        ipc.on('update-server-ui', (event, data) => {
            this.clients = data.clients;
            this.ready = data.ready;
            this.running = data.running;
            this.hasCheckPoint = data.hasCheckPoint;
        });
        ipc.on('update-game-ui', (event, data) => {
            this.board = data.board;
            this.history = data.history;
        });
        ipc.on('update-scoreboard-ui', (event, data) => {
            this.time = data.time;
            this.current = data.current;
            this.players = data.players;
        });
        ipc.on('update-status-ui', (event, data) => {
            this.status = data.text;
        });
    },
    methods:{
        close(){
            electron.remote.getCurrentWindow().close();
        },
        minimize(){
            electron.remote.getCurrentWindow().minimize();
        },
        maximize(){
            electron.remote.getCurrentWindow().maximize();
        }
    },
    components:{
        'history': History,
        'score-board': ScoreBoard,
        'board': Board,
        'control': Control
    }
}
</script>

<style lang="scss">
@import "./variables.scss";

.window {
    margin: 0%;
    position: absolute; top: 0; right: 0; bottom: 0; left: 0;
    border-radius: 5px;
    background-color: $background-color;
}

.title-bar {
    position: fixed;
    overflow: hidden;
    top: 0;
    left: 0;
    z-index: 999;
    width: 100%;
    padding-top: 5px;
    padding-left: 10px;
    height: 24px;
    -webkit-user-select: none;
    cursor: default;
    pointer-events: none;
    -webkit-app-region: drag;
}

.window-content {
    display: grid;
    grid-template-rows: 80% 20%;
    grid-template-columns: 25% 75%;
    grid-template-areas: 
    "list board"
    "control score";
    gap: 10px;
    margin: 5vh;
    height: 90vh;
    font-family: 'Roboto', sans-serif;
    color: $font-color;
}

.circle-button {
    width: 10px;
    height: 10px;
    margin-top: 0; 
    padding: 0;
    border: none;
    border-radius: 10px;
    -webkit-app-region: no-drag;
    cursor: default;
    pointer-events: all;
}

.close {
    background-color: rgb(252, 86, 82);
}
.minimize {
    background-color: rgb(254, 195, 66);
}
.maximize {
    background-color: rgb(52, 199, 73);
}
</style>
