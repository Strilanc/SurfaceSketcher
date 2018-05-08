import {DetailedError} from 'src/base/DetailedError.js'
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {seq} from "src/base/Seq.js";
import {FixupOperation} from "src/sim/util/FixupOperation.js";
import {XYT} from "src/sim/util/XYT.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {XY} from "src/sim/util/XY.js";
import {
    codeDistanceToPipeSeparation,
    codeDistanceToPipeSize,
    codeDistanceUnitCellSize,
    SMALL_DIAMETER,
    LONG_DIAMETER,
} from "src/braid/CodeDistance.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {UnitCellSocket} from "src/braid/UnitCellSocket.js";
import {PlumbingPiece} from "src/braid/PlumbingPiece.js";
import {Sockets} from "src/braid/Sockets.js";
import {GeneralMap} from "src/base/GeneralMap.js";

const PRIMAL_COLOR = [0.9, 0.9, 0.9, 1.0];
const SHIFTED_PRIMAL_COLOR = [0.8, 0.8, 1.0, 1.0];
const DUAL_COLOR = [0.4, 0.4, 0.4, 1.0];
const SHIFTED_DUAL_COLOR = [0.4, 0.4, 0.6, 1.0];


class PlumbingPieces {
}

PlumbingPieces.PRIMAL_RIGHTWARD = new PlumbingPiece(
    'PRIMAL_RIGHTWARD',
    Sockets.XPrimal,
    PRIMAL_COLOR);
PlumbingPieces.PRIMAL_LEFTWARD = new PlumbingPiece(
    'PRIMAL_LEFTWARD',
    Sockets.XPrimal,
    SHIFTED_PRIMAL_COLOR);

PlumbingPieces.PRIMAL_BACKWARD = new PlumbingPiece(
    'PRIMAL_BACKWARD',
    Sockets.ZPrimal,
    PRIMAL_COLOR);
PlumbingPieces.PRIMAL_FOREWARD = new PlumbingPiece(
    'PRIMAL_FOREWARD',
    Sockets.ZPrimal,
    SHIFTED_PRIMAL_COLOR);

PlumbingPieces.PRIMAL_UPWARD = new PlumbingPiece(
    'PRIMAL_UPWARD',
    Sockets.YPrimal,
    PRIMAL_COLOR);
PlumbingPieces.PRIMAL_DOWNARD = new PlumbingPiece(
    'PRIMAL_DOWNWARD',
    Sockets.YPrimal,
    SHIFTED_PRIMAL_COLOR);

PlumbingPieces.DUAL_RIGHTWARD = new PlumbingPiece(
    'DUAL_RIGHTWARD',
    Sockets.XDual,
    DUAL_COLOR);
PlumbingPieces.DUAL_LEFTWARD = new PlumbingPiece(
    'DUAL_LETWARD',
    Sockets.XDual,
    SHIFTED_DUAL_COLOR);

PlumbingPieces.DUAL_BACKWARD = new PlumbingPiece(
    'DUAL_BACKWARD',
    Sockets.ZDual,
    SHIFTED_DUAL_COLOR);
PlumbingPieces.DUAL_FOREWARD = new PlumbingPiece(
    'DUAL_FOREWARD',
    Sockets.ZDual,
    DUAL_COLOR);

PlumbingPieces.DUAL_UPWARD = new PlumbingPiece(
    'DUAL_UPWARD',
    Sockets.YDual,
    DUAL_COLOR);
PlumbingPieces.DUAL_DOWNARD = new PlumbingPiece(
    'DUAL_DOWNWARD',
    Sockets.YDual,
    SHIFTED_DUAL_COLOR);

PlumbingPieces.PRIMAL_CENTER = new PlumbingPiece(
    'PRIMAL_CENTER',
    Sockets.CPrimal,
    PRIMAL_COLOR);

PlumbingPieces.DUAL_CENTER = new PlumbingPiece(
    'DUAL_CENTER',
    Sockets.CDual,
    DUAL_COLOR);

PlumbingPieces.All = [
    PlumbingPieces.PRIMAL_RIGHTWARD,
    PlumbingPieces.PRIMAL_BACKWARD,
    PlumbingPieces.PRIMAL_UPWARD,
    PlumbingPieces.PRIMAL_LEFTWARD,
    PlumbingPieces.PRIMAL_FOREWARD,
    PlumbingPieces.PRIMAL_DOWNARD,
    PlumbingPieces.DUAL_RIGHTWARD,
    PlumbingPieces.DUAL_BACKWARD,
    PlumbingPieces.DUAL_UPWARD,
    PlumbingPieces.DUAL_LEFTWARD,
    PlumbingPieces.DUAL_FOREWARD,
    PlumbingPieces.DUAL_DOWNARD,
    PlumbingPieces.DUAL_CENTER,
    PlumbingPieces.PRIMAL_CENTER,
];

PlumbingPieces.BySocket = new GeneralMap();
for (let pp of PlumbingPieces.All) {
    PlumbingPieces.BySocket.getOrInsert(pp.socket, () => []).push(pp);
}

PlumbingPieces.ByName = seq(PlumbingPieces.All).keyedBy(e => e.name);
PlumbingPieces.forceGetByName = name => {
    let result = PlumbingPieces.ByName.get(name);
    if (result === undefined) {
        throw new DetailedError('Unknown plumbing piece.', {name});
    }
    return result;
};

PlumbingPieces.Defaults = new GeneralMap(
    [Sockets.XPrimal, PlumbingPieces.PRIMAL_RIGHTWARD],
    [Sockets.YPrimal, PlumbingPieces.PRIMAL_UPWARD],
    [Sockets.ZPrimal, PlumbingPieces.PRIMAL_BACKWARD],
    [Sockets.XDual, PlumbingPieces.DUAL_RIGHTWARD],
    [Sockets.YDual, PlumbingPieces.DUAL_UPWARD],
    [Sockets.ZDual, PlumbingPieces.DUAL_FOREWARD],
    [Sockets.CPrimal, PlumbingPieces.PRIMAL_CENTER],
    [Sockets.CDual, PlumbingPieces.DUAL_CENTER],
);

export {PlumbingPieces}
