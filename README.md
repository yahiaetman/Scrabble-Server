# SCRABBLE-SERVER

## Description

This is a 2-Player TCP Scrabble Judging Server using Websockets and Electron.

This project is made for the Fall 2018 Machine Intelligence Course (CMPN402/CMP402A) in Computer Engineering Program at Cairo University Faculty of Engineering.

The server uses Websockets protocol version 13 as defined by RFC6455 (https://tools.ietf.org/html/rfc6455)

## How to run and build

In the root directory, run: `npm install` to install dependencies

To build renderer, run: `npm run production` (or `npm run watch` during development)

To run server, run: `npm run start`

To test scrabble game code only, run: `node ./test/test-scrabble.js`

To run a client, run: `node client.js [name] [port] [host]`

To package server, run: `npm run dist`

## How to use server

After running the server, run 2 clients then press play. If there is a saved checkpoint, you can press pause to start from checkpoint or renew to start from seed.

The client can play their turn using on of the following commands:
- `PLAY column row direction tiles score`
- `EXCHANGE tiles`
- `PASS`

where column is a letter from A to O and row is a number from 1 to 15 and direction is either "R" for Right or "D" for Down. 

The client must also reply to the opponent's play with one of the following commands:
- `OK`
- `CHALLENGE`

**NOTE:** In `EXCHANGE`, use underscore "_" to denote blank tile and In `PLAY`, use lower-case letters to denote blank tiles.