# SCRABBLE-SERVER

## Description

![Screenshot](docs/screenshot.png)

This is a 2-Player TCP Scrabble Judging Server using Websockets and Electron.

This project is made for the Fall 2018 Machine Intelligence Course (CMPN402/CMP402A) in Computer Engineering Program at Cairo University Faculty of Engineering.

The server uses Websockets protocol version 13 as defined by RFC6455 (https://tools.ietf.org/html/rfc6455)

Communication Details can found in [this document](https://docs.google.com/document/d/1xaKcgdv9gw6xSQahsckgkU7JAzRd757Ci6RZgYTfRhc/edit?usp=sharing).

## How to run and build

In the root directory, run: `npm install` to install dependencies

To build renderer, run: `npm run production` (or `npm run watch` during development to automatically build after saving file changes)

To run server, run: `npm run start`

To test scrabble game code only, run: `node ./examples/console-scrabble.js [seed]`

To run a sample client, run: `node ./examples/client.js [name] [port=8080] [host=127.0.0.1]`

To run tests, run: `npm run test`

To package server, run: `npm run dist`

## How to use server

After running the server, run 2 clients then press *Play*. If there is a saved checkpoint, you can press *Pause* to start from checkpoint or *Restart* to start from seed. If you press *Stop*, you can continue the game later.

The client can play their turn using on of the following commands:
- `PASS`
- `EXCHANGE [Tiles]` where:
  - `Tiles` must contain at least one tile and each tile is written in Uppercase and blanks is written as an underscore.
- `PLAY [Column] [Row] [Direction] [Tiles] [Score]` where:
  - `Column` and `Row` is where to put the first tile. `Column` can be a letter from **A** to **O** and `Row` can be a number from **1** to **15**
  - `Direction` defines where the remaining tiles will be placed relative to the first tile and it can **R** for Right or **D** for Down
  - `Tiles` are the placed tile and can be a letter from **A-Z** (or **a-z** if the tile is originally a blank).
  - `Score` is the number of points gathered by this move

The client must also reply to the opponent's play with one of the following commands:
- `OK` to approve his move.
- `CHALLENGE` to challenge his move
- If the challenge period ends before you send a reply, it will be considered an approval.