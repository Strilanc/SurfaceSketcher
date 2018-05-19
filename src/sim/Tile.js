/**
 * A parallel set of operations to perform.
 */

import {seq, Seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {Axis} from "src/sim/util/Axis.js";
import {DetailedError} from "src/base/DetailedError.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {RenderData} from "src/geo/RenderData.js";
import {Point} from "src/geo/Point.js";
import {Sphere} from "src/geo/Sphere.js";
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {codeDistanceUnitCellSize, codeDistanceToPipeSize} from "src/braid/CodeDistance.js";
import {DirectedGraph} from "src/sim/util/DirectedGraph.js";
import {indent} from "src/base/Util.js";
import {gridRangeToString, mergeGridRangeStrings} from "src/sim/util/Util.js";
import {XYT} from "src/sim/util/XYT.js";
import {equate_Iterables} from "src/base/Equate.js";

let HADAMARD = 'H';
let CONTROL = 'C';
let X_RIGHT = '<';
let PAULI_X = 'X';
let PAULI_Z = 'Z';
let X_LEFT = '>';
let X_UP = 'v';
let X_DOWN = '^';

let SIM_ACTIONS = new Map();
SIM_ACTIONS.set(undefined, () => {});
SIM_ACTIONS.set(CONTROL, () => {});
SIM_ACTIONS.set(X_RIGHT, (surface, xy) => surface.cnot(xy.offsetBy(1, 0), xy));
SIM_ACTIONS.set(X_LEFT, (surface, xy) => surface.cnot(xy.offsetBy(-1, 0), xy));
SIM_ACTIONS.set(X_UP, (surface, xy) => surface.cnot(xy.offsetBy(0, -1), xy));
SIM_ACTIONS.set(X_DOWN, (surface, xy) => surface.cnot(xy.offsetBy(0, +1), xy));
SIM_ACTIONS.set(PAULI_X, (surface, xy) => {
    surface.hadamard(xy);
    surface.phase(xy);
    surface.phase(xy);
    surface.hadamard(xy);
});
SIM_ACTIONS.set(PAULI_Z, (surface, xy) => {
    surface.phase(xy);
    surface.phase(xy);
});


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

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof TileColumn && equate_Iterables(this.entries, other.entries);
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
     * @returns {!{minX: !int, minY: !int, maxX: !int, maxY: !int}}
     */
    bounds() {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let update = xy => {
            minX = Math.min(xy.x, minX);
            minY = Math.min(xy.x, minY);
            maxX = Math.max(xy.x, maxX);
            maxY = Math.max(xy.x, maxY);
        };

        for (let xy of this.initializations.keys()) {
            update(xy);
        }
        for (let xy of this.measurements.keys()) {
            update(xy);
        }
        for (let xy of this.operations.keys()) {
            update(xy);
        }

        return {minX, minY, maxX, maxY};
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
     * @param {!Surface} surface
     * @param {!int} tileIndex
     * @param {!GeneralMap.<!XYT, !Measurement>} measurementResultsOut
     */
    simulateOn(surface, tileIndex, measurementResultsOut) {
        this._simulateInit(surface);
        this._simulateOps(surface);
        this._simulateMeasurements(surface, tileIndex, measurementResultsOut);
    }

    /**
     * @param {!Surface} surface
     */
    _simulateInit(surface) {
        for (let [xy, axis] of this.initializations.entries()) {
            if (surface.measure(xy).result) {
                surface.hadamard(xy);
                surface.phase(xy);
                surface.phase(xy);
                surface.hadamard(xy);
            }
            if (axis.is_x()) {
                surface.hadamard(xy);
            }
        }
    }

    /**
     * @param {!Surface} surface
     */
    _simulateOps(surface) {
        let d = this.depth();
        for (let i = 0; i < d; i++) {
            for (let [xy, col] of this.operations.entries()) {
                let op = col.entries[i];
                let action = SIM_ACTIONS.get(op);
                if (action === undefined) {
                    throw new DetailedError('Unrecognized', {op});
                }
                action(surface, xy);
            }
        }
    }

    /**
     * @param {!Surface} surface
     * @param {!int} tileIndex
     * @param {!GeneralMap.<!XYT, !Measurement>} measurementResultsOut
     */
    _simulateMeasurements(surface, tileIndex, measurementResultsOut) {
        for (let [xy, axis] of this.measurements.entries()) {
            if (axis.is_x()) {
                surface.hadamard(xy);
            }
            let result = surface.measure(xy);
            measurementResultsOut.set(new XYT(xy.x, xy.y, tileIndex), result);
            if (result.result) {
                surface.hadamard(xy);
                surface.phase(xy);
                surface.phase(xy);
                surface.hadamard(xy);
            }
        }
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
     */
    pauli_x(target) {
        let t = this.operations.getOrInsert(target, () => new TileColumn());
        t.entries.push(PAULI_X);
    }

    /**
     * @param {!XY} target
     */
    pauli_z(target) {
        let t = this.operations.getOrInsert(target, () => new TileColumn());
        t.entries.push(PAULI_Z);
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
        // if (this.measurements.has(target)) {
        //     throw new DetailedError('Initialization must come before measurement.', {target, axis});
        // }
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
        return seq(this.operations.values()).map(e => e.entries.length).max(0);
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
        let isInactive = xy => !this.initializations.has(xy) && !this.measurements.has(xy) && !this.operations.has(xy);
        planes.push(gridRangeToString(minY, maxY, minX, maxX, (row, col) => {
            let xy = new XY(col, row);
            let init = this.initializations.get(xy);
            if (isInactive(xy)) {
                return '#';
            } else if (init === undefined) {
                return ' ';
            } else if (init.is_z()) {
                return '0';
            } else {
                return '+';
            }
        }));
        for (let z = 0; z < d; z++) {
            planes.push(gridRangeToString(minY, maxY, minX, maxX, (row, col) => {
                let xy = new XY(col, row);
                let r = this.operations.get(xy);
                if (isInactive(xy)) {
                    return '#';
                } else if (r === undefined) {
                    return ' ';
                }
                let result = r.entries[z];
                return result === undefined ? ' ' : result;
            }));
        }
        planes.push(gridRangeToString(minY, maxY, minX, maxX, (row, col) => {
            let xy = new XY(col, row);
            let init = this.measurements.get(xy);
            if (isInactive(xy)) {
                return '#';
            } else if (init === undefined) {
                return ' ';
            } else if (init.is_z()) {
                return 'M';
            } else {
                return 'E';
            }
        }));

        return `Tile(entries=[\n${indent(mergeGridRangeStrings(planes, 200))}\n])`;
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Tile &&
            this.initializations.isEqualTo(other.initializations) &&
            this.operations.isEqualTo(other.operations) &&
            this.measurements.isEqualTo(other.measurements);
    }
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

export {Tile, TileColumn, CONTROL, X_RIGHT, X_LEFT, X_UP, X_DOWN, PAULI_X, PAULI_Z}
