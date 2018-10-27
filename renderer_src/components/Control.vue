<template>
    <div class="control">
        <div class="conn-player-1 connection">
            <template v-if="clients[0].connected">
                <i class="material-icons close-connection" v-if="!running" @click="disconnect(0)">close</i>
                <div v-else></div>
                <span class="team-name">{{ clients[0].name || clients[0].ip }}</span>
                <span class="player-order">PLAYER 1</span>
            </template>
            <template v-else>
                <div></div>
                <i class="material-icons no-connection">sync</i>
                <div></div>
            </template>
        </div>
        <div class="conn-player-2 connection">
            <template v-if="clients[1].connected">
                <i class="material-icons close-connection" v-if="!running"  @click="disconnect(0)">close</i>
                <div v-else></div>
                <span class="team-name">{{ clients[1].name || clients[1].ip }}</span>
                <span class="player-order">PLAYER 2</span>
            </template>
            <template v-else>
                <div></div>
                <i class="material-icons no-connection">sync</i>
                <div></div>
            </template>
        </div>        
        <div class="buttons">
            <input type="text" name="seed" id="seed" placeholder="Enter Seed ..." class="seed-input" ref="seed">
            <button class="control-button" @click="start(true)" v-if="hasCheckPoint && !running" :disabled="!ready">
                <i class="material-icons">pause</i>
            </button>
            <button class="control-button" @click="start(false)" :disabled="!ready && !running">
                <i class="material-icons">{{running ? "stop" : (hasCheckPoint? "autorenew" : "play_arrow")}}</i>
            </button>
        </div>
        <div class="swap-button-container" v-if="ready">
            <i class="material-icons swap-button" @click="swap">swap_horiz</i>
        </div>
    </div>
</template>

<script>
export default {
    props: {clients:{}, ready:{}, running:{}, hasCheckPoint:{}},
    methods:{
        swap(){
            ipc.send("swap", {});
        },
        start(useCheckPoint){
            if(this.running)
                ipc.send("stop", {});
            else
                ipc.send("start", {seed: this.$refs.seed.value, useCheckPoint: useCheckPoint});
        },
        disconnect(index){
            ipc.send("disconnect", {index: index});
        }
    }
}
</script>

<style lang="scss">
@import "../variables.scss";

.control{
    grid-area: control;
    display: grid;
    grid-template-rows: 3fr 1fr;
    grid-template-columns: 48% 48%;
    grid-template-areas:
    "player-1 player-2"
    "buttons buttons";
    gap: 10px;
}

.conn-player-1 {
    grid-area: player-1;
}

.conn-player-2 {
    grid-area: player-2;
}

.connection {
    border: 1px solid $border-color;
    box-shadow: 0 0 8px 2px #00000088;
    border-radius: 10px 0 10px 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    justify-items: stretch;
}

.close-connection {
    font-size: 12px;
    align-self: flex-end;
}

.no-connection {
    font-size: 36px;
    align-self: center;
    animation: rotation 2s infinite linear;
}

.team-name {
    align-self: center;
    max-width: 80%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: 'Roboto', sans-serif;
    font-size: 18px;
    font-weight: 100;
}

.player-order {
    align-self: flex-start;
    font-family: 'Roboto', sans-serif;
    padding-left: 2px;
    font-size: 11px;
    font-weight: 300;
}

.swap-button-container {
    grid-area: 1 / 1 / span 1 / span 2;
    display: flex;
    justify-content: center;
    align-items: center;
}

.swap-button {
    max-width: 20%;
    text-align: center;
    background-color: $background-color;
    color: $border-color;
    border: 1px solid $border-color;
    border-radius: 50%;
    box-shadow: 0 0 8px 2px #00000088;
    font-size: 36px;
    user-select: none;
}

.swap-button:hover {
    background-color: #444444;
}

.swap-button:active {
    background-color: #888888;
}

.buttons {
    grid-area: buttons;
    display: flex;
}

.seed-input {
    flex: 1 1 auto; 
    width:100px;
    border: 1px solid $border-color;
    border-radius: 5px 0 0 5px;
    background-color: transparent;
    color: white;
    font-family: 'Roboto', sans-serif;
    font-size: 18px;
    font-weight: 300;
    padding: 5px;
    margin: 0%;
}

.seed-input::placeholder {
    font-family: 'Roboto', sans-serif;
    font-size: 18px;
    font-weight: 300;
}

.control-button {
    flex: 0 1 auto; 
    width:48px;
    background-color: transparent;
    border: 1px solid $border-color;
    margin: 0%;
    color: white;
}

.control-button:last-child {
    border-radius: 0 5px 5px 0;
}

.control-button:hover {
    background-color: #444444;
}

.control-button:active {
    background-color: #888888;
}

.control-button:disabled {
    color: #ffffff44;
    background-color: #333333;
}
</style>