<template>
  <div class="window">
    <div class="title-bar">
      <button
        class="circle-button close"
        @click="close"/>
      <button
        class="circle-button minimize"
        @click="minimize"/>
      <button
        class="circle-button maximize"
        @click="maximize"/>
    </div>
    <div class="window-content">
      <history :history="history"/>
      <board
        :board="board"
        :design="design"
      />
      <control
        :ready="ready"
        :running="running"
        :clients="clients"
        :has-check-point="hasCheckPoint"/>
      <score-board
        :status="status"
        :time="time"
        :current="current"
        :challenge-time="challengeTime"
        :awaiting-challenge="awaitingChallenge"
        :players="players"/>
    </div>
  </div>
</template>

<script>
// eslint-disable-next-line import/no-unresolved
import History from './components/History';
// eslint-disable-next-line import/no-unresolved
import ScoreBoard from './components/ScoreBoard';
// eslint-disable-next-line import/no-unresolved
import Board from './components/Board';
// eslint-disable-next-line import/no-unresolved
import Control from './components/Control';

export default {
  components: {
    history: History,
    'score-board': ScoreBoard,
    board: Board,
    control: Control,
  },
  data() {
    return {
      status: 'Server Starting ...',
      clients: [
        {
          connected: false, index: 0, name: null, ip: '',
        },
        {
          connected: false, index: 1, name: null, ip: '',
        },
      ],
      ready: false,
      running: false,
      hasCheckPoint: false,
      board: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ],
      design: [
        [4, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 4],
        [0, 3, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0],
        [0, 0, 3, 0, 0, 0, 1, 0, 1, 0, 0, 0, 3, 0, 0],
        [1, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1],
        [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0],
        [0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0],
        [0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0],
        [4, 0, 0, 1, 0, 0, 0, 3, 0, 0, 0, 1, 0, 0, 4],
        [0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0],
        [0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 2, 0],
        [0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0],
        [1, 0, 0, 3, 0, 0, 0, 1, 0, 0, 0, 3, 0, 0, 1],
        [0, 0, 3, 0, 0, 0, 1, 0, 1, 0, 0, 0, 3, 0, 0],
        [0, 3, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0],
        [4, 0, 0, 1, 0, 0, 0, 4, 0, 0, 0, 1, 0, 0, 4],
      ],
      time: 0,
      current: 0,
      challengeTime: 0,
      awaitingChallenge: false,
      players: [
        { name: '----', time: 0, score: 0 },
        { name: '----', time: 0, score: 0 },
      ],
      history: [],
    };
  },
  mounted() {
    window.ipc.on('set-board-design', (event, data) => {
      this.design = data.design;
    });
    window.ipc.on('update-server-ui', (event, data) => {
      this.clients = data.clients;
      this.ready = data.ready;
      this.running = data.running;
      this.hasCheckPoint = data.hasCheckPoint;
    });
    window.ipc.on('update-game-ui', (event, data) => {
      this.board = data.board;
      this.history = data.history;
    });
    window.ipc.on('update-scoreboard-ui', (event, data) => {
      this.time = data.time;
      this.current = data.current;
      this.players = data.players;
      this.challengeTime = data.challengeTime;
      this.awaitingChallenge = data.awaitingChallenge;
    });
    window.ipc.on('update-status-ui', (event, data) => {
      this.status = data.text;
    });
  },
  methods: {
    close() {
      window.electron.remote.getCurrentWindow().close();
    },
    minimize() {
      window.electron.remote.getCurrentWindow().minimize();
    },
    maximize() {
      window.electron.remote.getCurrentWindow().maximize();
    },
  },
};
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
