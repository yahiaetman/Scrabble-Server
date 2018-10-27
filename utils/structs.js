const stfu = require('struct-fu');

const TypeStruct = stfu.struct([
    stfu.uint8("type")
]);

const TilesStruct = stfu.struct([
    stfu.uint8("tiles", 7)
])

const TimeStruct = stfu.struct([
    stfu.int32("time"),
    stfu.int32("total")
]);

const ScoreStruct = stfu.struct([
    stfu.int32("score"),
    stfu.int32("opponent")
]);


const TypeWithTimeStruct = stfu.struct([
    TypeStruct,
    TimeStruct
]);

const TypeWithTilesStruct = stfu.struct([
    TypeStruct,
    TilesStruct
]);

const TypeWithCountAndTimeStruct = stfu.struct([
    TypeStruct,
    stfu.uint8("count"),
    TimeStruct
]);

const TypeWithTilesAndTimeStruct = stfu.struct([
    TypeStruct,
    TilesStruct,
    TimeStruct
]);

const StartStruct = stfu.struct([
    TypeStruct,
    stfu.uint8("order"),
    TilesStruct,
    stfu.uint8("board", 15*15),
    ScoreStruct,
    TimeStruct
]);

const EndStruct = stfu.struct([
    TypeStruct,
    stfu.uint8("reason"),
    ScoreStruct
]);

const PlayStruct = stfu.struct([
    TypeStruct,
    stfu.uint8("col"),
    stfu.uint8("row"),
    stfu.uint8("dir"),
    stfu.uint8("tiles", 7),
    stfu.uint32("score")
]);

const PlayWithTimeStruct = stfu.struct([
    PlayStruct,
    TimeStruct
]);

module.exports = {
    TypeStruct: TypeStruct,
    TypeWithTimeStruct: TypeWithTimeStruct,
    TypeWithTilesStruct: TypeWithTilesStruct,
    TypeWithCountAndTimeStruct: TypeWithCountAndTimeStruct,
    TypeWithTilesAndTimeStruct: TypeWithTilesAndTimeStruct,
    StartStruct: StartStruct,
    EndStruct: EndStruct,
    PlayStruct: PlayStruct,
    PlayWithTimeStruct: PlayWithTimeStruct
}