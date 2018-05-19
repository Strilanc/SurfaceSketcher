/**
 * @param {!UnitCellSocket} pp
 * @returns {!UnitCellSocket}
 */
import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
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
import {UnitCellSocketNeighbor} from "src/braid/UnitCellSocketNeighbor.js";
import {Rect} from "src/geo/Rect.js";


function genericToPrimal(pp) {
    return new UnitCellSocket(
        pp.name + 'Primal',
        pp.box,
        pp.footprintRect);
}

/**
 * @param {!UnitCellSocket} pp
 * @returns {!UnitCellSocket}
 */
function genericToDual(pp) {
    return new UnitCellSocket(
        pp.name + 'Dual',
        new Box(pp.box.baseCorner.plus(new Vector(0.5, 0.5, 0.5)), pp.box.diagonal),
        codeDistance => {
            let unitSize = codeDistanceUnitCellSize(codeDistance);
            let dw = Math.floor((unitSize.w - 1) / 4) * 2 + 1;
            let dh = Math.floor((unitSize.h - 1) / 4) * 2 + 1;
            return pp.footprintRect(codeDistance).offsetBy(dw, dh);
        });
}

let centerConnector = new UnitCellSocket(
    'Center',
    new Box(
        new Point(0, 0, 0),
        new Vector(SMALL_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        return new Rect(0, 0, w, h);
    });

let xConnector = new UnitCellSocket(
    'X',
    new Box(
        new Point(SMALL_DIAMETER, 0, 0),
        new Vector(LONG_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        w *= 2;
        w += codeDistanceToPipeSeparation(codeDistance);
        return new Rect(0, 0, w, h);
    });

let yConnector = new UnitCellSocket(
    'Y',
    new Box(
        new Point(0, SMALL_DIAMETER, 0),
        new Vector(SMALL_DIAMETER, LONG_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        return new Rect(0, 0, w, h);
    });

let zConnector = new UnitCellSocket(
    'Z',
    new Box(
        new Point(0, 0, SMALL_DIAMETER),
        new Vector(SMALL_DIAMETER, SMALL_DIAMETER, LONG_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        h *= 2;
        h += codeDistanceToPipeSeparation(codeDistance);
        return new Rect(0, 0, w, h);
    });

let genericPieces = [centerConnector, xConnector, yConnector, zConnector];
let primalPieces = genericPieces.map(genericToPrimal);
let dualPieces = genericPieces.map(genericToDual);

class Sockets {
}
Sockets.All = [...primalPieces, ...dualPieces];
Sockets.ByName = seq(Sockets.All).keyedBy(e => e.name);
Sockets.XPrimal = Sockets.ByName.get('XPrimal');
Sockets.YPrimal = Sockets.ByName.get('YPrimal');
Sockets.ZPrimal = Sockets.ByName.get('ZPrimal');
Sockets.CPrimal = Sockets.ByName.get('CenterPrimal');
Sockets.XDual = Sockets.ByName.get('XDual');
Sockets.YDual = Sockets.ByName.get('YDual');
Sockets.ZDual = Sockets.ByName.get('ZDual');
Sockets.CDual = Sockets.ByName.get('CenterDual');

/**
 * @param {!UnitCellSocket} socket1
 * @param {!UnitCellSocket} socket2
 * @param {!Vector} dir
 * @param {!boolean} nextCell
 * @param {!boolean} is1To2Implied
 */
function addNeighbors(socket1, socket2, dir, nextCell, is1To2Implied=true) {
    let neg = dir.scaledBy(-1);
    let n1to2 = new UnitCellSocketNeighbor(socket2, dir, nextCell);
    socket1.neighbors.set(dir, n1to2);
    socket2.neighbors.set(neg, new UnitCellSocketNeighbor(socket1, neg, nextCell));
    if (is1To2Implied) {
        socket1.impliedNeighbors.push(n1to2);
    }
}

addNeighbors(Sockets.XPrimal, Sockets.CPrimal, new Vector(1, 0, 0), true);
addNeighbors(Sockets.YPrimal, Sockets.CPrimal, new Vector(0, 1, 0), true);
addNeighbors(Sockets.ZPrimal, Sockets.CPrimal, new Vector(0, 0, 1), true);

addNeighbors(Sockets.XPrimal, Sockets.CPrimal, new Vector(-1, 0, 0), false);
addNeighbors(Sockets.YPrimal, Sockets.CPrimal, new Vector(0, -1, 0), false);
addNeighbors(Sockets.ZPrimal, Sockets.CPrimal, new Vector(0, 0, -1), false);

addNeighbors(Sockets.XDual, Sockets.CDual, new Vector(1, 0, 0), true);
addNeighbors(Sockets.YDual, Sockets.CDual, new Vector(0, 1, 0), true);
addNeighbors(Sockets.ZDual, Sockets.CDual, new Vector(0, 0, 1), true);

addNeighbors(Sockets.XDual, Sockets.CDual, new Vector(-1, 0, 0), false);
addNeighbors(Sockets.YDual, Sockets.CDual, new Vector(0, -1, 0), false);
addNeighbors(Sockets.ZDual, Sockets.CDual, new Vector(0, 0, -1), false);

Sockets.forceGetByName = name => {
    let result = Sockets.ByName.get(name);
    if (result === undefined) {
        throw new DetailedError('Unknown socket.', {name});
    }
    return result;
};

const importantPrimalTimes = [
    0, // Transition out of vertical and into flat primal pieces.
    SMALL_DIAMETER / 2, // Steady state for flat primal pieces.
    SMALL_DIAMETER, // // Transition out of flat and into vertical primal pieces.
    (SMALL_DIAMETER + 0.5) / 2, // Steady state for vertical primal pieces.
];
const importantDualTimes = importantPrimalTimes.map(e => e + 0.5);
// const IMPORTANT_UNIT_CELL_TIMES = [...importantPrimalTimes, ...importantDualTimes];
const IMPORTANT_UNIT_CELL_TIMES = [0.5, 0.5 + SMALL_DIAMETER];

export {
    Sockets,
    IMPORTANT_UNIT_CELL_TIMES,
}
