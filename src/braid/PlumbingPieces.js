import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {seq} from "src/base/Seq.js";
import {makeArrayGrid} from "src/sim/util/Util.js";

const SMALL_DIAMETER = 0.2;
const LONG_DIAMETER = 0.8;

const GENERIC_COLOR = [0.5, 0.5, 0.5, 1.0];
const PRIMAL_COLOR = [0.95, 0.95, 0.95, 1.0];
const DUAL_COLOR = [0.3, 0.3, 0.3, 1.0];


class PlumbingPieceVariant {
    /**
     * @param {!string} name
     * @param {![!number, !number, !number, !number]} color
     */
    constructor(name, color) {
        this.name = name;
        this.color = color;
    }
}


class PlumbingPieceFootprint {
    /**
     * @param {!int} offsetX
     * @param {!int} offsetY
     * @param {!Array.<!Array.<!boolean>>} mask
     */
    constructor(offsetX, offsetY, mask) {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.mask = mask;
    }

    /**
     * @param {!int} x
     * @param {!int} y
     * @returns {!PlumbingPieceFootprint}
     */
    offsetBy(x, y) {
        return new PlumbingPieceFootprint(this.offsetX + x, this.offsetY + y, this.mask);
    }

    toString() {
        let content = this.mask.map(row => row.map(cell => cell ? '#' : ' ').join('')).join('\n    ');
        return `PlumbingPieceFootprint(offsetX=${this.offsetX}, offsetY=${this.offsetY}, mask=\n    ${content}\n)`;
    }
}

class PlumbingPiece {
    /**
     * @param {!string} name
     * @param {!Box} box
     * @param {!function(codeDistance: !int) : !PlumbingPieceFootprint} footprint
     * @param {![!number, !number, !number, !number]} color
     * @param {Array.<!{name: !string, offset: !Vector}>} implies
     * @param {!boolean} onlyImplied
     * @param {!Array.<!PlumbingPieceVariant>} variants
     */
    constructor(name, box, footprint, color, implies, onlyImplied, variants) {
        this.name = name;
        this.box = box;
        this.footprint = footprint;
        this.color = color;
        this.implies = implies;
        this.onlyImplied = onlyImplied;
        this.variants = variants;
    }

    /**
     * @param {!Point} offset
     * @returns {!Box}
     */
    boxAt(offset) {
        return new Box(this.box.baseCorner.plus(offset.asVector()), this.box.diagonal);
    }

    toString() {
        return `PlumbingPiece(${this.name})`;
    }
}

/**
 * @param {!int} codeDistance
 * @returns {{w: !int, h: !int}}
 */
function codeDistanceToPipeSize(codeDistance) {
    let w = Math.ceil(codeDistance / 4);
    let h = Math.ceil((codeDistance - 2) / 4);
    w = Math.max(w, 1);
    h = Math.max(h, 1);
    return {w, h};
}

/**
 * @param {!int} codeDistance
 * @returns {!int}
 */
function codeDistanceToPipeSeparation(codeDistance) {
    return codeDistance * 2;
}

/**
 * @param {!int} codeDistance
 * @returns {{w: !int, h: !int}}
 */
function codeDistanceUnitCellSize(codeDistance) {
    let {w, h} = codeDistanceToPipeSize(codeDistance);
    let s = codeDistanceToPipeSeparation(codeDistance);
    w += s;
    h += s;
    return {w, h};
}

/**
 * @param {!PlumbingPiece} pp
 * @returns {!PlumbingPiece}
 */
function genericToPrimal(pp) {
    return new PlumbingPiece(
        pp.name + 'Primal',
        pp.box,
        codeDistance => pp.footprint(codeDistance),
        PRIMAL_COLOR,
        pp.implies.map(({name, offset}) => ({name: name + 'Primal', offset})),
        pp.onlyImplied,
        pp.variants);
}

/**
 * @param {!PlumbingPiece} pp
 * @returns {!PlumbingPiece}
 */
function genericToDual(pp) {
    return new PlumbingPiece(
        pp.name + 'Dual',
        new Box(pp.box.baseCorner.plus(new Vector(0.5, 0.5, 0.5)), pp.box.diagonal),
        codeDistance => pp.footprint(codeDistance).offsetBy(codeDistance, codeDistance),
        DUAL_COLOR,
        pp.implies.map(({name, offset}) => ({name: name + 'Dual', offset})),
        pp.onlyImplied,
        pp.variants);
}

let movePositiveWard = new PlumbingPieceVariant('+', [0, 0, 1, 1]);
let moveNegativeWard = new PlumbingPieceVariant('-', [0, 1, 1, 1]);
let injectS = new PlumbingPieceVariant('S', [1, 0, 1, 1]);

let centerConnector = new PlumbingPiece(
    'Center',
    new Box(
        new Point(0, 0, 0),
        new Vector(SMALL_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        return new PlumbingPieceFootprint(0, 0, makeArrayGrid(w, h, () => true));
    },
    GENERIC_COLOR,
    [],
    true,
    []);

let xConnector = new PlumbingPiece(
    'X',
    new Box(
        new Point(SMALL_DIAMETER, 0, 0),
        new Vector(LONG_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        w *= 2;
        w += codeDistanceToPipeSeparation(codeDistance);
        return new PlumbingPieceFootprint(0, 0, makeArrayGrid(w, h, () => true));
    },
    GENERIC_COLOR,
    [
        {name: 'Center', offset: new Vector(0, 0, 0)},
        {name: 'Center', offset: new Vector(1, 0, 0)},
    ],
    false,
    [movePositiveWard, moveNegativeWard, injectS]);

let yConnector = new PlumbingPiece(
    'Y',
    new Box(
        new Point(0, SMALL_DIAMETER, 0),
        new Vector(SMALL_DIAMETER, LONG_DIAMETER, SMALL_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        return new PlumbingPieceFootprint(0, 0, makeArrayGrid(w, h, () => true));
    },
    GENERIC_COLOR,
    [
        {name: 'Center', offset: new Vector(0, 0, 0)},
        {name: 'Center', offset: new Vector(0, 1, 0)},
    ],
    false,
    [movePositiveWard, moveNegativeWard, injectS]);

let zConnector = new PlumbingPiece(
    'Z',
    new Box(
        new Point(0, 0, SMALL_DIAMETER),
        new Vector(SMALL_DIAMETER, SMALL_DIAMETER, LONG_DIAMETER)),
    codeDistance => {
        let {w, h} = codeDistanceToPipeSize(codeDistance);
        h *= 2;
        h += codeDistanceToPipeSeparation(codeDistance);
        return new PlumbingPieceFootprint(0, 0, makeArrayGrid(w, h, () => true));
    },
    GENERIC_COLOR,
    [
        {name: 'Center', offset: new Vector(0, 0, 0)},
        {name: 'Center', offset: new Vector(0, 0, 1)},
    ],
    false,
    []);

let genericPieces = [centerConnector, xConnector, yConnector, zConnector];
let primalPieces = genericPieces.map(genericToPrimal);
let dualPieces = genericPieces.map(genericToDual);
/** @type {!Array.<!PlumbingPiece>} */
const ALL_PLUMBING_PIECES = [...primalPieces, ...dualPieces];
/** @type {!Map.<!string, !PlumbingPiece>} */
const PLUMBING_PIECE_MAP = seq(ALL_PLUMBING_PIECES).keyedBy(e => e.name);

export {
    PlumbingPiece,
    ALL_PLUMBING_PIECES,
    PLUMBING_PIECE_MAP,
    codeDistanceToPipeSize,
    codeDistanceUnitCellSize,
    PlumbingPieceFootprint,
}
