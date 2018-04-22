import {equate} from "src/base/Equate.js";
import {seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {FixupOperation} from "src/sim/util/FixupOperation.js";
import {Axis} from "src/sim/util/Axis.js";
import {DetailedError} from "src/base/DetailedError.js";
import {setMembershipInOfTo, xorSetInto, makeArrayGrid} from "src/sim/util/Util.js";


class FixupLayer {
    /**
     * @param {!int} width
     * @param {!int} height
     * @param {!Array.<!FixupOperation>=} ops
     * @param {!int=} time
     */
    constructor(width, height, ops=[], time=0) {
        this.width = width;
        this.height = height;
        this._ops = ops;
        this._time = time;
        this._eventMap = this._regeneratedEventMap();
        this._involvedIds = this._regeneratedInvolvedIds();
    }

    /**
     * @param {!FixupOperation} op
     */
    pushFixup(op) {
        let i = this._ops.length;
        this._ops.push(op);

        let c = op.condition;
        if (c !== undefined) {
            this._eventMap.set(c.toString(), i + this._time);
        }

        for (let targets of [op.x_targets, op.z_targets]) {
            for (let k of targets) {
                let q = XY.parseFrom(k);
                this._involvedIds[q.y][q.x].add(i + this._time);
            }
        }
    }

    /**
     * @returns {!FixupLayer}
     */
    clone() {
        return new FixupLayer(this.width, this.height, this._ops.map(e => e.clone()), this._time);
    }

    /**
     * @returns {!Map.<!XYT, !int>}
     * @private
     */
    _regeneratedEventMap() {
        let result = new Map();
        for (let i = 0; i < this._ops.length; i++) {
            let c = this._ops[i].condition;
            if (c !== undefined) {
                result.set(c.toString(), i + this._time);
            }
        }
        return result;
    }

    /**
     * @returns {!Array.<!Array.<!Set.<!int>>>}
     * @private
     */
    _regeneratedInvolvedIds() {
        let result = makeArrayGrid(this.width, this.height, () => new Set());
        for (let i = 0; i < this._ops.length; i++) {
            for (let targets of [this._ops[i].x_targets, this._ops[i].z_targets]) {
                for (let k of targets) {
                    let q = XY.parseFrom(k);
                    result[q.y][q.x].add(i + this._time);
                }
            }
        }
        return result;
    }

    /**
     * @param {!XY} xy
     * @param {!int} index
     * @private
     */
    _syncInvolvedIds(xy, index) {
        let k = xy.toString();
        let op = this._ops[index - this._time];
        setMembershipInOfTo(this._involvedIds[xy.y][xy.x], index, op.x_targets.has(k) || op.z_targets.has(k));
    }

    /**
     * @param {...!XY} xy
     * @returns {!Array.<!int>}
     */
    _relevantIds(...xy) {
        return seq(xy).flatMap(({x, y}) => this._involvedIds[y][x]).distinct().sortedBy(e => -e).toArray();
    }

    /**
     * @param {!XY} xy
     */
    hadamard(xy) {
        for (let i of this._relevantIds(xy)) {
            let op = this._ops[i - this._time];
            op.hadamard(xy);
            this._syncInvolvedIds(xy, i);
        }
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        for (let i of this._relevantIds(control, target)) {
            let op = this._ops[i - this._time];
            op.cnot(control, target);
            this._syncInvolvedIds(control, i);
            this._syncInvolvedIds(target, i);
        }
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     * @returns {!Array.<undefined|!XYT>}
     */
    measure(target, axis=Axis.Z) {
        let result = [];
        for (let i of this._relevantIds(target)) {
            let op = this._ops[i - this._time];
            op.measure(target, axis);
            this._syncInvolvedIds(target, i);
            if (op.has(target, axis.opposite())) {
                result.push(op.condition);
            }
        }
        return result;
    }

    /**
     * @param {!int} i
     * @private
     */
    _syncClearInvolvedIdLayer(i) {
        let op = this._ops[i - this._time];
        for (let targets of [op.x_targets, op.z_targets]) {
            for (let kt of targets) {
                let xy = XY.parseFrom(kt);
                this._involvedIds[xy.y][xy.x].delete(i);
            }
        }
    }

    /**
     * @param {!XYT} event
     * @param {!boolean} result
     */
    updateWithMeasurementResult(event, result) {
        let k = event.toString();
        if (!this._eventMap.has(k)) {
            return;
        }
        let i = this._eventMap.get(k);
        this._eventMap.delete(k);
        let op = this._ops[i - this._time];
        op.condition = undefined;
        if (!result) {
            this._syncClearInvolvedIdLayer(i);
            op.z_targets.clear();
            op.x_targets.clear();
        }
    }

    /**
     * @returns {!FixupOperation}
     */
    shiftUnconditionalUpdates() {
        let result = new FixupOperation();
        while (this._ops.length > 0 && this._ops[0].condition === undefined) {
            this._syncClearInvolvedIdLayer(this._time);
            let delta = this._ops.shift();
            this._time += 1;
            xorSetInto(delta.z_targets, result.z_targets);
            xorSetInto(delta.x_targets, result.x_targets);
        }
        return result;
    }

    /**
     * @param {!FixupLayer|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof FixupLayer &&
            this.width === other.width &&
            this.height === other.height &&
            this._time === other._time &&
            equate(this._ops, other._ops);
    }

    /**
     * @returns {!string}
     */
    toString() {
        let ops = this._ops.map(e => '        ' + e.toString() + '\n').join('');
        return `FixupLayer(size=${this.width}x${this.height}, t=${this._time}, ops=[\n${ops}])`
    }
}

export {FixupLayer}
