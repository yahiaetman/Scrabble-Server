<template>
  <div class="board">
    <div class="letters"/>
    <div class="board-div">
      <table class="board-table">
        <thead>
          <th/>
          <th
            v-for="(square, j) in design[0]"
            :key="'c'+j">{{ String.fromCharCode(65+j) }}</th>
          <th/>
        </thead>
        <tbody>
          <tr
            v-for="(row, i) in design"
            :key="'r'+i">
            <th>{{ i + 1 }}</th>
            <td
              v-for="(square, j) in row"
              :key="'d'+i+j"
              :class="classes[square]">
              <i
                v-if="isCenter(i, j)"
                class="material-icons md-dark md-18 center-star">star</i>
              <transition name="bounce">
                <button
                  v-if="isLetter(board[i][j])"
                  :class="['tile',{'underlined':isUnderLined(board[i][j])}]">
                  {{ getLetter(board[i][j]) }}
                </button>
              </transition>
            </td>
            <th>{{ i + 1 }}</th>
          </tr>
        </tbody>
        <tfoot>
          <th/>
          <th
            v-for="(square, j) in design[0]"
            :key="'c'+j">{{ String.fromCharCode(65+j) }}</th>
          <th/>
        </tfoot>
      </table>
    </div>
    <div class="idx">
      <table class="idx-table">
        <tbody>
          <tr>
            <td class="idx-color double-letter">Double Letter</td>
          </tr>
          <tr>
            <td class="idx-color triple-letter">Triple Letter</td>
          </tr>
          <tr>
            <td class="idx-color double-word">Double Word</td>
          </tr>
          <tr>
            <td class="idx-color triple-word">Triple Word</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
export default {
  props: {
    board: {
      type: Array,
      default: () => [
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
    },
    design: {
      type: Array,
      default: () => [
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
    },
  },
  data() {
    return {
      classes: {
        0: '',
        1: 'double-letter',
        2: 'triple-letter',
        3: 'double-word',
        4: 'triple-word',
      },
    };
  },
  computed: {
    size() {
      return {
        rows: this.design.length,
        columns: this.design.length === 0 ? 0 : Math.min(...this.design.map(row => row.length)),
      };
    },
  },
  methods: {
    isLetter(id) {
      return (id >= 1 && id <= 26) || (id >= 101 && id <= 126);
    },
    getLetter(id) {
      if (id >= 101 && id <= 126) return String.fromCharCode(97 + id - 101);
      if (id >= 1 && id <= 26) return String.fromCharCode(65 + id - 1);
      return '';
    },
    isUnderLined(id) {
      return id >= 100;
    },
    isCenter(i, j) {
      return i === Math.trunc(this.size.rows / 2) && j === Math.trunc(this.size.columns / 2);
    },
  },
};
</script>

<style lang="scss">
@import "../variables.scss";

.board{
    grid-area: board;
    display: grid;
    grid-template-columns: 1fr 8fr 1fr;
    grid-template-rows: 1fr;
    grid-template-areas:
    "letters tab idx";
    height: 100%;
    gap: 10px;
}

.letters {
    grid-area: letters;
}

.board-div {
    grid-area: tab;
    //border: $border-width solid $border-color;
}

.idx {
    grid-area: idx;
}

.board-table {
    width: 100%;
    height: 100%;
    table-layout: fixed;
    border-collapse: collapse;
}

.board-table td {
    border: $border-width solid $border-color;
    text-align: center;
    vertical-align: middle;
    position: relative;
}

.board-table th {
    font-family: 'Roboto', sans-serif;
    font-weight: 300;
    color: $font-color;
}

.idx-table {
    width: 100%;
    table-layout: auto;
    border-collapse: collapse;
}

.idx-table td {
    border: $border-width solid $border-color;
    text-align: center;
    vertical-align: middle;
    position: relative;
    font-family: 'Roboto', sans-serif;
    font-weight: 500;
    font-size: 16px;
    color: $background-color;
}

.idx-table td.idx-color {
    min-width: 20px;
}

.double-letter {
    background-color: #89B6A5;
}
.triple-letter {
    background-color: #414770;
}
.double-word {
    background-color: #845A6D;
}
.triple-word {
    background-color: #E54B4B;
}
.center-star {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1;
}

.tile {
    position: relative;
    z-index: 10;
    background-color: antiquewhite;
    border: none;
    box-shadow: 0 0 3px 3px #00000044;
    border-radius: 5px;
    font-family: 'Roboto', sans-serif;
    font-weight: 400;
    text-align: center;
    vertical-align: middle;
    width: 75%;
    height: 75%;
}

.underlined {
    text-decoration-line: underline;
}

.bounce-enter-active {
  animation: bounce-in .5s;
}
.bounce-leave-active {
  animation: bounce-in .5s reverse;
}
@keyframes bounce-in {
  0% {
    transform: scale(0);
  }
  50% {
    transform: scale(1.5);
  }
  100% {
    transform: scale(1);
  }
}
</style>
