import {equate_Sets} from "src/base/Equate.js";
import {seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {DetailedError} from "src/base/DetailedError.js";
import {setMembershipInOfTo, toggleMembership} from "src/sim/util/Util.js";


/**
 * A set of classically-controlled Pauli operations to perform.
 */
class FixupOperation {
    /**
     * @param {!Iterable.<!XY>} x_targets Locations of qubits to hit with X operations when applying the fixup.
     * @param {!Iterable.<!XY>} z_targets Locations of qubits to hit with Z operations when applying the fixup.
     * @param {undefined|!XYT} condition The measurement event that determines if the fixup is applied or not.
     */
    constructor(condition=undefined, x_targets=[], z_targets=[]) {
        this.condition = condition;
        this.x_targets = seq(x_targets).map(e => e instanceof XY ? e.toString() : e).toSet();
        this.z_targets = seq(z_targets).map(e => e instanceof XY ? e.toString() : e).toSet();
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
        let k = target.toString();
        let hasX = this.x_targets.has(k);
        let hasZ = this.z_targets.has(k);
        if (hasX !== hasZ) {
            setMembershipInOfTo(this.x_targets, k, hasZ);
            setMembershipInOfTo(this.z_targets, k, hasX);
        }
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        let control_key = control.toString();
        let target_key = target.toString();
        if (this.x_targets.has(control_key)) {
            toggleMembership(this.x_targets, target_key);
        }
        if (this.z_targets.has(target_key)) {
            toggleMembership(this.z_targets, control_key);
        }
    }

    /**
     * @param {*|!FixupOperation} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof FixupOperation &&
            equate_Sets(this.x_targets, other.x_targets) &&
            equate_Sets(this.z_targets, other.z_targets) &&
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
