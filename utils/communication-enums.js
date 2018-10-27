const MessageTypes = {
    NAME: 0,
    START: 1,
    PASS: 2,
    EXCHANGE: 3,
    PLAY: 4,
    NO_CHALLENGE: 5,
    CHALLENGE: 6,
    CHALLENGE_ACCEPTED: 7,
    CHALLENGE_REJECTED: 8,
    INVALID: 9,
    END: 10
};

const EndReasons = {
    ALL_TILES_USED: 0,
    TIME_ENDED: 1,
    CONNECTION_ERROR: 2,
    STOP_BUTTON_PRESSED: 3
};

module.exports = {
    MessageTypes,
    EndReasons
}