/**
 * @param {!string} c
 * @returns {undefined|!XY}
 */
import {seq, Seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {Axis} from "src/sim/util/Axis.js";
import {DetailedError} from "src/base/DetailedError.js";
import {FixupLayer} from "src/sim/FixupLayer.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {RenderData} from "src/geo/RenderData.js";
import {Point} from "src/geo/Point.js";
import {Sphere} from "src/geo/Sphere.js";
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {codeDistanceUnitCellSize, codeDistanceToPipeSize} from "src/braid/PlumbingPieces.js";
import {DirectedGraph} from "src/sim/util/DirectedGraph.js";
import {indent} from "src/base/Util.js";

let HADAMARD = 'H';
let CONTROL = 'C';
let X_RIGHT = '<';
let X_LEFT = '>';
let X_UP = 'v';
let X_DOWN = '^';

class TileColumn {
    /**
     * @param {!Array.<undefined|!string>} entries
     */
    constructor(entries = []) {
        this.entries = entries;
    }

    /**
     * @param {!TileColumn} other
     * @param {undefined|!string} thisValue
     * @param {undefined|!string} otherValue
     */
    padPush(other, thisValue, otherValue) {
        padPush(this.entries, other.entries, thisValue, otherValue);
    }
}

/**
 * A tile is a set of parallel commands to actually send to the quantum computer, starting with a layer of
 * initializations and ending with a layer of measurements.
 */
class Tile {
    /**
     * @param {!GeneralMap.<!XY, !Axis>} initializations
     * @param {!GeneralMap.<!XY, !TileColumn>} operations
     * @param {!GeneralMap.<!XY, !Axis>} measurements
     */
    constructor(initializations=new GeneralMap(), operations=new GeneralMap(), measurements=new GeneralMap()) {
        this.initializations = initializations;
        this.operations = operations;
        this.measurements = measurements
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        let x_type;
        if (target.isEqualTo(control.rightNeighbor())) {
            x_type = X_LEFT
        } else if (target.isEqualTo(control.leftNeighbor())) {
            x_type = X_RIGHT
        } else if (target.isEqualTo(control.aboveNeighbor())) {
            x_type = X_DOWN
        } else if (target.isEqualTo(control.belowNeighbor())) {
            x_type = X_UP
        } else {
            throw new DetailedError('Long-distance cnot.', {control, target});
        }

        let c = this.operations.getOrInsert(control, () => new TileColumn());
        let t = this.operations.getOrInsert(target, () => new TileColumn());
        c.padPush(t, CONTROL, x_type);
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        let t = this.operations.getOrInsert(target, () => new TileColumn());
        t.entries.push(HADAMARD);
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    measure(target, axis=Axis.Z) {
        if (this.measurements.has(target)) {
            throw new DetailedError('Already measured.', {target, axis});
        }
        this.measurements.set(target, axis);
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    init(target, axis=Axis.Z) {
        if (this.initializations.has(target)) {
            throw new DetailedError('Already initialized.', {target, axis});
        }
        let ops = this.operations.get(target);
        if (ops !== undefined && ops.entries.length > 0) {
            throw new DetailedError('Initialization must come before operations.', {target, axis});
        }
        if (this.measurements.has(target)) {
            throw new DetailedError('Initialization must come before measurement.', {target, axis});
        }
        this.initializations.set(target, axis);
    }

    /**
     * @param {!Array.<!XY>} targets
     */
    hadamardAll(targets) {
        for (let target of targets) {
            this.hadamard(target);
        }
    }

    /**
     * @param {!Array.<!XY>} targets
     * @param {!Axis} axis
     */
    measureAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.measure(target, axis);
        }
    }

    /**
     * @param {!Array.<!XY>} targets
     * @param {!Axis} axis
     */
    initAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.init(target, axis);
        }
    }

    /**
     * @param {!Surface} surface
     * @param {!Array.<!Array.<!boolean>>} disables
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureEnabledStabilizers(surface, disables) {
        let xTargets = [];
        let zTargets = [];
        for (let row = 0; row < disables.length; row++) {
            for (let col = 0; col < disables[row].length; col++) {
                let xy = new XY(col, row);
                if (!disables[row][col]) {
                    if (surface.is_x(xy)) {
                        xTargets.push(xy);
                    }
                    if (surface.is_z(xy)) {
                        zTargets.push(xy);
                    }
                }
            }
        }
        return this.measureStabilizers(xTargets, zTargets, xy => !disables[xy.y][xy.x]);
    }

    /**
     * @param {!Array.<!XY>} xTargets
     * @param {!Array.<!XY>} zTargets
     * @param {!function(!XY): !boolean} isEnabled
     */
    measureStabilizers(xTargets, zTargets, isEnabled=() => true) {
        this.initAll(xTargets, Axis.X);
        this.initAll(zTargets, Axis.Z);

        for (let i = 0; i < 4; i++) {
            for (let xTarget of xTargets) {
                let n = xTarget.neighbors()[i];
                if (isEnabled(n)) {
                    this.cnot(xTarget, n);
                }
            }
            if (i < 2) {
                this.padAllToDepth();
            }
        }
        for (let i = 0; i < 4; i++) {
            for (let zTarget of zTargets) {
                let n = zTarget.neighbors()[i ^ 2];
                if (isEnabled(n)) {
                    this.cnot(n, zTarget);
                }
            }
            if (i >= 2) {
                this.padAllToDepth();
            }
        }

        this.measureAll(xTargets, Axis.X);
        this.measureAll(zTargets, Axis.Z);
    }

    padAllToDepth() {
        let d = this.depth();
        for (let c of this.operations.values()) {
            while (c.entries.length < d) {
                c.entries.push(undefined);
            }
        }
    }

    /**
     * @returns {!int}
     */
    depth() {
        return seq(this.operations.values()).map(e => e.entries.length).max();
    }

    /**
     * @returns {!string}
     */
    toString() {
        let minX = Math.min(0, seq(this.operations.keys()).map(xy => xy.x).min(0));
        let maxX = seq(this.operations.keys()).map(xy => xy.x).max(0);
        let minY = Math.min(0, seq(this.operations.keys()).map(xy => xy.y).min(0));
        let maxY = seq(this.operations.keys()).map(xy => xy.y).max(0);
        let d = this.depth();
        let planes = [];
        planes.push(planeToString(minY, maxY, minX, maxX, (row, col) => {
            let init = this.initializations.get(new XY(col, row));
            if (init === undefined) {
                return ' ';
            } else if (init.is_z()) {
                return '0';
            } else {
                return '+';
            }
        }));
        for (let z = 0; z < d; z++) {
            planes.push(planeToString(minY, maxY, minX, maxX, (row, col) => {
                let r = this.operations.get(new XY(col, row));
                if (r === undefined) {
                    return ' ';
                }
                let result = r.entries[z];
                return result === undefined ? ' ' : result;
            }));
        }
        planes.push(planeToString(minY, maxY, minX, maxX, (row, col) => {
            let init = this.measurements.get(new XY(col, row));
            if (init === undefined) {
                return ' ';
            } else if (init.is_z()) {
                return 'M';
            } else {
                return 'E';
            }
        }));

        return `Tile(entries=[${indent(planes.join('\n\n'))}\n])`;
    }
}

/**
 * @param {!int} minRow
 * @param {!int} maxRow
 * @param {!int} minCol
 * @param {!int} maxCol
 * @param {!function(row: !int, col: !int): !string} func
 * @returns {string}
 */
function planeToString(minRow, maxRow, minCol, maxCol, func) {
    let w = maxCol - minCol + 1;
    let rail = Seq.repeat('#', w + 2).join('');
    let rows = [rail];
    for (let row = minRow; row <= maxRow; row++) {
        let cells = [];
        for (let col = minCol; col <= maxCol; col++) {
            cells.push(func(row, col));
        }
        rows.push('#' + cells.join('') + '#');
    }
    rows.push(rail);
    return rows.join('\n');
}

/**
 * @param {!Array.<T>} array1
 * @param {!Array.<T>} array2
 * @param {T} item1
 * @param {T} item2
 * @param {T} pad
 * @template T
 */
function padPush(array1, array2, item1, item2, pad=undefined) {
    while (array1.length < array2.length) {
        array1.push(pad);
    }
    while (array2.length < array1.length) {
        array2.push(pad);
    }
    array1.push(item1);
    array2.push(item2);
}

export {Tile}
