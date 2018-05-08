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

const GENERIC_COLOR = [0.5, 0.5, 0.5, 1.0];
const PRIMAL_COLOR = [0.9, 0.9, 0.9, 1.0];
const DUAL_COLOR = [0.4, 0.4, 0.4, 1.0];


function genericToPrimal(pp) {
    return new UnitCellSocket(
        pp.name + 'Primal',
        pp.box,
        codeDistance => pp.footprint(codeDistance),
        pp.propagateSignals.bind(pp),
        PRIMAL_COLOR,
        pp.implies.map(({name, offset}) => ({name: name + 'Primal', offset})),
        pp.onlyImplied);
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
            return pp.footprint(codeDistance).offsetBy(dw, dh);
        },
        () => {},
        DUAL_COLOR,
        pp.implies.map(({name, offset}) => ({name: name + 'Dual', offset})),
        pp.onlyImplied);
}

let centerConnector = new UnitCellSocket(
    'Center',
    new Box(
        new Point(0, 0, 0),
        new Vector(SMALL_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        return UnitCellSocketFootprint.grid(0, 0, w, h);
    },
    () => {},
    GENERIC_COLOR,
    [],
    true);

let xConnector = new UnitCellSocket(
    'X',
    new Box(
        new Point(SMALL_DIAMETER, 0, 0),
        new Vector(LONG_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        w *= 2;
        w += codeDistanceToPipeSeparation(codeDistance);
        return UnitCellSocketFootprint.grid(0, 0, w, h);
    },
    (codeDistance, fixupLayer, dx, dy) => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        let s = codeDistanceToPipeSeparation(codeDistance);
        for (let j = 0; j < h; j += 2) {
            for (let i = 1; i < s; i += 2) {
                let x = i + w + dx;
                let y = j + dy;
                fixupLayer.pushFixup(new FixupOperation(
                    new XYT(x, y, 0),
                    new GeneralSet(new XY(x + 2, y))));
            }
        }
    },
    GENERIC_COLOR,
    [
        {name: 'Center', offset: new Vector(0, 0, 0)},
        {name: 'Center', offset: new Vector(1, 0, 0)},
    ],
    false);

let yConnector = new UnitCellSocket(
    'Y',
    new Box(
        new Point(0, SMALL_DIAMETER, 0),
        new Vector(SMALL_DIAMETER, LONG_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        return UnitCellSocketFootprint.grid(0, 0, w, h);
    },
    () => {},
    GENERIC_COLOR,
    [
        {name: 'Center', offset: new Vector(0, 0, 0)},
        {name: 'Center', offset: new Vector(0, 1, 0)},
    ],
    false);

let zConnector = new UnitCellSocket(
    'Z',
    new Box(
        new Point(0, 0, SMALL_DIAMETER),
        new Vector(SMALL_DIAMETER, SMALL_DIAMETER, LONG_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        h *= 2;
        h += codeDistanceToPipeSeparation(codeDistance);
        return UnitCellSocketFootprint.grid(0, 0, w, h);
    },
    () => {},
    GENERIC_COLOR,
    [
        {name: 'Center', offset: new Vector(0, 0, 0)},
        {name: 'Center', offset: new Vector(0, 0, 1)},
    ],
    false);

let genericPieces = [centerConnector, xConnector, yConnector, zConnector];
let primalPieces = genericPieces.map(genericToPrimal);
let dualPieces = genericPieces.map(genericToDual);
/** @type {!Array.<!UnitCellSocket>} */
const ALL_PLUMBING_PIECES = [...primalPieces, ...dualPieces];
/** @type {!Map.<!string, !UnitCellSocket>} */
const PLUMBING_PIECE_MAP = seq(ALL_PLUMBING_PIECES).keyedBy(e => e.name);

class Sockets {
}
Sockets.XPrimal = PLUMBING_PIECE_MAP.get('XPrimal');
Sockets.YPrimal = PLUMBING_PIECE_MAP.get('YPrimal');
Sockets.ZPrimal = PLUMBING_PIECE_MAP.get('ZPrimal');
Sockets.CPrimal = PLUMBING_PIECE_MAP.get('CenterPrimal');
Sockets.XDual = PLUMBING_PIECE_MAP.get('XDual');
Sockets.YDual = PLUMBING_PIECE_MAP.get('YDual');
Sockets.ZDual = PLUMBING_PIECE_MAP.get('ZDual');
Sockets.CDual = PLUMBING_PIECE_MAP.get('CenterDual');


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

Sockets.All = [
    Sockets.XPrimal,
    Sockets.YPrimal,
    Sockets.ZPrimal,
    Sockets.XDual,
    Sockets.YDual,
    Sockets.ZDual,
];
Sockets.ByName = seq(Sockets.All).keyedBy(e => e.name);

export {
    ALL_PLUMBING_PIECES,
    PLUMBING_PIECE_MAP,
    Sockets,
}
