import {seq, Seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {Axis} from "src/sim/util/Axis.js";
import {DetailedError} from "src/base/DetailedError.js";
import {FixupLayer} from "src/sim/FixupLayer.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {makeArrayGrid} from "src/sim/util/Util.js";


let INIT_0 = '0';
let INIT_PLUS = '+';
let MEASURE_Z = 'M';
let MEASURE_X = 'E';
let HADAMARD = 'H';
let CONTROL = 'C';
let X_RIGHT = '<';
let X_LEFT = '>';
let X_UP = 'v';
let X_DOWN = '^';


class LockstepSurfaceLayer {
    /**
     * @param {!FixupLayer} fixup
     */
    constructor(fixup) {
        this.fixup = fixup;
        this.grid = /** @type {!Array.<!Array.<!Array.<undefined|!string>>>} */ makeArrayGrid(
            fixup.width, fixup.height, () => []);
    }

    get width() {
        return this.fixup.width;
    }

    get height() {
        return this.fixup.height;
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        this.fixup.cnot(control, target);
        let c = this.grid[control.y][control.x];
        let t = this.grid[target.y][target.x];
        if (target.isEqualTo(control.rightNeighbor())) {
            padPush(c, t, CONTROL, X_LEFT);
        } else if (target.isEqualTo(control.leftNeighbor())) {
            padPush(c, t, CONTROL, X_RIGHT);
        } else if (target.isEqualTo(control.aboveNeighbor())) {
            padPush(c, t, CONTROL, X_DOWN);
        } else if (target.isEqualTo(control.belowNeighbor())) {
            padPush(c, t, CONTROL, X_UP);
        } else {
            throw new DetailedError('Long-distance cnot.', {control, target});
        }
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        this.fixup.hadamard(target);
        let t = this.grid[target.y][target.x];
        t.push(HADAMARD);
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     * @returns {!MeasurementAdjustment}
     */
    measure(target, axis=Axis.Z) {
        let result = this.fixup.measure(target, axis);
        let t = this.grid[target.y][target.x];
        t.push(axis.is_x() ? MEASURE_X : MEASURE_Z);
        return result;
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     * @private
     */
    _inRange(xy) {
        let {x, y} = xy;
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
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
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureAll(targets, axis=Axis.Z) {
        let result = new GeneralMap();
        for (let target of targets) {
            result.set(target, this.measure(target, axis));
        }
        return result;
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    reset(target, axis=Axis.Z) {
        let t = this.grid[target.y][target.x];
        t.push(axis.is_x() ? INIT_PLUS : INIT_0);
    }

    /**
     * @param {!Array.<!XY>} targets
     * @param {!Axis} axis
     */
    resetAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.reset(target, axis);
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
                if (surface.is_x(xy)) {
                    xTargets.push(xy);
                }
                if (surface.is_z(xy)) {
                    zTargets.push(xy);
                }
            }
        }
        return this.measureStabilizers(xTargets, zTargets, xy => !disables[xy.y][xy.x]);
    }

    /**
     * @param {!Array.<!XY>} xTargets
     * @param {!Array.<!XY>} zTargets
     * @param {!function(!XY): !boolean} isEnabled
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureStabilizers(xTargets, zTargets, isEnabled=() => true) {
        this.resetAll(xTargets, Axis.X);
        this.resetAll(zTargets, Axis.Z);

        for (let i = 0; i < 4; i++) {
            for (let xTarget of xTargets) {
                if (!isEnabled(xTarget)) {
                    continue;
                }
                let n = xTarget.neighbors()[i];
                if (this._inRange(n) && isEnabled(n)) {
                    this.cnot(xTarget, n);
                }
            }
            if (i < 2) {
                this.padAllToDepth();
            }
        }
        for (let i = 0; i < 4; i++) {
            for (let zTarget of zTargets) {
                if (!isEnabled(zTarget)) {
                    continue;
                }
                let n = zTarget.neighbors()[i ^ 2];
                if (this._inRange(n) && isEnabled(n)) {
                    this.cnot(n, zTarget);
                }
            }
            if (i >= 2) {
                this.padAllToDepth();
            }
        }

        let map1 = this.measureAll(xTargets, Axis.X);
        let map2 = this.measureAll(zTargets, Axis.Z);
        return new GeneralMap(...map1.entries(), ...map2.entries());
    }

    padAllToDepth() {
        let d = this.depth();
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let m = this.grid[y][x];
                while (m.length < d) {
                    m.push(undefined);
                }
            }
        }
    }

    /**
     * @returns {!int}
     */
    depth() {
        return seq(this.grid).flatten().map(e => e.length).max();
    }

    toString() {
        let m = seq(this.grid).flatten().map(e => e.length).max();
        let rail = Seq.repeat('#', this.width + 2).join('');
        let planes = [];
        for (let z = 0; z < m; z++) {
            let rows = [rail];
            for (let row = 0; row < this.height; row++) {
                let cells = [];
                for (let col = 0; col < this.width; col++) {
                    let v = this.grid[row][col][z];
                    if (v === undefined) {
                        v = ' ';
                    }
                    cells.push(v === undefined ? ' ' : v);
                }
                rows.push('#' + cells.join('') + '#');
            }
            rows.push(rail);
            planes.push(rows.join('\n'));
        }

        let r = planes.join('\n\n').split('\n').join('\n    ');
        return `LockstepSurfaceLayer(grid=\n    ${r},\n\n    fixup=${this.fixup.toString()})`;
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

export {LockstepSurfaceLayer}