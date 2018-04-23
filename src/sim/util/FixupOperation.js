import {GeneralSet} from "src/base/GeneralSet.js";
import {seq} from "src/base/Seq.js";
import {Axis} from "src/sim/util/Axis.js";
import {XY} from "src/sim/util/XY.js";
import {DetailedError} from "src/base/DetailedError.js";
import {setMembershipInOfTo, toggleMembership} from "src/sim/util/Util.js";


/**
 * A set of classically-controlled Pauli operations to perform.
 */
class FixupOperation {
    /**
     * @param {undefined|!XYT} condition The measurement event that determines if the fixup is applied or not.
     * @param {!GeneralSet.<!XY>|Iterable.<!XY>} x_targets Locations of qubits to hit with X operations during fixup.
     * @param {!GeneralSet.<!XY>|Iterable.<!XY>} z_targets Locations of qubits to hit with Z operations during fixup.
     */
    constructor(condition=undefined, x_targets=[], z_targets=[]) {
        this.condition = condition;
        this.x_targets = new GeneralSet(...x_targets);
        this.z_targets = new GeneralSet(...z_targets);
    }

    /**
     * @returns {!FixupOperation}
     */
    clone() {
        return new FixupOperation(this.condition, this.x_targets, this.z_targets);
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        let hasX = this.x_targets.has(target);
        let hasZ = this.z_targets.has(target);
        if (hasX !== hasZ) {
            setMembershipInOfTo(this.x_targets, target, hasZ);
            setMembershipInOfTo(this.z_targets, target, hasX);
        }
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        if (this.x_targets.has(control)) {
            toggleMembership(this.x_targets, target);
        }
        if (this.z_targets.has(target)) {
            toggleMembership(this.z_targets, control);
        }
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    measure(target, axis=Axis.Z) {
        if (axis.is_x()) {
            this.x_targets.delete(target);
        } else {
            this.z_targets.delete(target);
        }
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     * @returns {!boolean}
     */
    has(target, axis) {
        if (axis.is_x()) {
            return this.x_targets.has(target);
        } else {
            return this.z_targets.has(target);
        }
    }

    /**
     * @param {*|!FixupOperation} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof FixupOperation &&
            this.x_targets.isEqualTo(other.x_targets) &&
            this.z_targets.isEqualTo(other.z_targets) &&
            (this.condition === undefined ? other.condition === undefined : this.condition.isEqualTo(other.condition));
    }

    /**
     * @returns {!string}
     */
    toString() {
        let xs = seq(this.x_targets).map(e => 'X_' + e.toString());
        let zs = seq(this.z_targets).map(e => 'Z_' + e.toString());
        let effect = xs.concat(zs).sorted().join(' * ');
        if (effect === '') {
            effect = 'I';
        }
        if (this.condition === undefined) {
            return effect;
        } else {
            return `if measurement ${this.condition} then ${effect}`;
        }
    }
}

export {FixupOperation}
