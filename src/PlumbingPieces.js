import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {seq} from "src/base/Seq.js";

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


class PlumbingPiece {
    /**
     * @param {!string} name
     * @param {!Box} box
     * @param {![!number, !number, !number, !number]} color
     * @param {Array.<!{name: !string, offset: !Vector}>} implies
     * @param {!boolean} onlyImplied
     * @param {!Array.<!PlumbingPieceVariant>} variants
     */
    constructor(name, box, color, implies, onlyImplied, variants) {
        this.name = name;
        this.box = box;
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
 * @param {!PlumbingPiece} pp
 * @returns {!PlumbingPiece}
 */
function genericToPrimal(pp) {
    return new PlumbingPiece(
        pp.name + 'Primal',
        pp.box,
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
    GENERIC_COLOR,
    [],
    true,
    []);

let xConnector = new PlumbingPiece(
    'X',
    new Box(
        new Point(SMALL_DIAMETER, 0, 0),
        new Vector(LONG_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER)),
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

export {PlumbingPiece, ALL_PLUMBING_PIECES, PLUMBING_PIECE_MAP}
