<template>
    <div class="score-board ui-box">
        <div class="status-player-1">
            <span class="player-turn player-turn-1">PLAYER 1</span>
            <span class="player-name">{{players[0].name}}</span>
            <span class="player-ip">{{players[0].ip}}</span>
            <span class="player-score">{{players[0].score}} Pts</span>
            <span :class="['player-time', {'player-time-current': current==0}]">{{players[0].time | displayTime}}</span>
        </div>
        <div class="status-player-2">
            <span class="player-turn player-turn-2">PLAYER 2</span>
            <span class="player-name">{{players[1].name}}</span>
            <span class="player-ip">{{players[1].ip}}</span>
            <span class="player-score">{{players[1].score}} Pts</span>
            <span :class="['player-time', {'player-time-current': current==1}]">{{players[1].time | displayTime}}</span>
        </div>
        <div class="time">{{time | displayTime}}</div>
        <div class="status">{{status}}</div>
    </div>
</template>

<script>
export default {
    props: {
        status: {default:""},
        time: {default: 0},
        current: {default: 0},
        players: {default: [
            {name:"----", ip: "127.0.0.1", time: 0, score: 0},
            {name:"----", ip: "127.0.0.1", time: 0, score: 0}
        ]}
    },
    filters:{
        displayTime: function(time){
            let sign = Math.sign(time);
            time = Math.trunc(time * sign);
            let s = Math.trunc(time/1000)%60;
            let m = Math.trunc(time/60000);
            return `${sign<0?'-':''}${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`
        }
    }
}
</script>

<style lang="scss">
@import "../variables.scss";

.score-board{
    grid-area: score;
    display: grid;
    grid-template-columns: 40% 20% 40%;
    grid-template-rows: 50% 50%;
    grid-template-areas: 
    "player-1 time player-2"
    "player-1 status player-2";
    gap: 0;
}

.status-player-1 {
    grid-area: player-1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    padding-left: 10px;
}


.status-player-2 {
    grid-area: player-2;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-end;
    padding-right: 10px;
}

.time {
    grid-area: time;
    text-align: center;
    font-family: 'Roboto', sans-serif;
    font-size: 48px;
    font-weight: 100;
}

.status {
    grid-area: status;
    display: table-cell;
    text-align: center;
    vertical-align: bottom;
    font-family: 'Roboto', sans-serif;
    font-size: 18px;
    font-weight: 100;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 95%;
    max-height: 95%;
}

.player-turn {
    font-family: 'Roboto', sans-serif;
    font-size: 12px;
    font-weight: 300;
    border-radius: 5px;
    padding: 2px;
    color: black;
}

.player-turn-1 {
    background-color: rgb(252, 86, 82);
}

.player-turn-2 {
    background-color: rgb(254, 195, 66);
}

.player-name {
    font-family: 'Roboto', sans-serif;
    font-size: 28px;
    font-weight: 100;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 95%;
}

.player-ip {
    font-family: 'Roboto', sans-serif;
    font-size: 12px;
    font-weight: 100;
}

.player-score {
    font-family: 'Roboto', sans-serif;
    font-size: 24px;
    font-weight: 100;
}

.player-time {
    font-family: 'Roboto', sans-serif;
    font-size: 24px;
    font-weight: 300;
    padding: 2px;
}

.player-time-current {
    color: black;
    background-color: white;
    border-radius: 5px;
}
</style>