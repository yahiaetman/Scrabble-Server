<template>
  <div class="move-list ui-box">
    <div
      ref="moves"
      class="moves">
      <div
        v-for="move in history"
        :key="move"
        class="move">
        <div :class="['turn', {'start':(move.player==2)}, {'turn-1':(move.player==0)}, {'turn-2':(move.player==1)}, {'end':(move.player==3)}]">
          {{ move.turn }}
        </div>
        <div class="move-text">{{ move.text }}</div>
        <div class="result">{{ move.result }}</div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  props: { history: { type: Array, default: () => [] } },
  updated() {
    this.$refs.moves.scrollTop = this.$refs.moves.scrollHeight;
  },
};
</script>

<style lang="scss">
@import "../variables.scss";

.move-list {
  grid-area: list;
  display: flex;
  justify-content: stretch;
  align-content: stretch;
  overflow: hidden;
}

.moves {
  width: 100%;
  overflow: auto;
  margin-top: 10px;
  margin-bottom: 10px;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
}

.moves::-webkit-scrollbar {
  width: 5px;
}

.moves::-webkit-scrollbar-track {
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
}

.moves::-webkit-scrollbar-corner {
  background-color: transparent;
  box-shadow: inset 0 0 6px rgba(0, 0, 0, 0.3);
}

.moves::-webkit-scrollbar-thumb {
  background-color: darkgrey;
  outline: 1px solid slategrey;
}

.move {
  width: 99%;
  height: 10%;
  display: grid;
  grid-template-columns: 1fr 9fr;
  grid-template-rows: 50% 50%;
  grid-template-areas:
    "turn move-text"
    "turn result";
  gap: 0;
}

.move:nth-child(even) {
  background-color: #666666;
}

.move:nth-child(odd) {
  background-color: #444444;
}

.turn {
  grid-area: turn;
  display: table-cell;
  text-align: center;
  vertical-align: middle;
  height: 100%;
  font-family: "Roboto", sans-serif;
  font-size: 18px;
  font-weight: 300;
  color: black;
}

.start {
  background-color: rgb(52, 199, 73);
}

.turn-1 {
  background-color: rgb(252, 86, 82);
}

.turn-2 {
  background-color: rgb(254, 195, 66);
}

.end {
  background-color: rgb(52, 91, 199);
}

.move-text {
  grid-area: move-text;
  font-family: "Roboto", sans-serif;
  padding: 5px;
  font-size: 14px;
  font-weight: 300;
  color: white;
}

.result {
  grid-area: result;
  font-family: "Roboto", sans-serif;
  padding: 5px;
  font-size: 14px;
  font-weight: 300;
  color: white;
}
</style>
