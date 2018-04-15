import {DetailedError} from "src/base/DetailedError.js"
import {Format, UNICODE_FRACTIONS} from "src/base/Format.js"
import {Util} from "src/base/Util.js"
import {Matrix} from "src/sim/Matrix.js"
import {Complex} from "src/sim/Complex.js"
import {Controls} from "src/sim/Controls.js";
import {SimulatorSpec} from "src/sim/SimulatorSpec.js";

class PauliFrame extends SimulatorSpec {
    constructor(sub) {
        super();
        this._sub = sub;
        this._x = new Set();
        this._z = new Set();
    }

    qalloc() {
        return this._sub.qalloc();
    }

    free(q) {
        this._sub.free(q);
        this._x.delete(q);
        this._z.delete(q);
    }

    phase(q) {
        this._sub.phase(q);

        if (this._x.has(q)) {
            toggle_membership(this._z, q);
        }
    }

    hadamard(q) {
        this._sub.hadamard(q);
        let new_z = this._x.has(q);
        let new_x = this._z.has(q);
        set_membership(this._x, q, new_x);
        set_membership(this._z, q, new_z);
    }

    cnot(control, target) {
        this._sub.cnot(control, target);

        if (this._x.has(control)) {
            toggle_membership(this._x, target);
        }

        if (this._z.has(target)) {
            toggle_membership(this._z, control);
        }
    }

    x(target) {
        toggle_membership(this._x, target);
    }

    z(target) {
        toggle_membership(this._z, target);
    }

    probability(q) {
        let p = this._sub.probability(q);
        return this._x.has(q) ? 1 - p : p;
    }

    measure(target) {
        let result = this._sub.measure(target);
        if (this._x.has(target)) {
            result = !result;
        }
        this._z.delete(target);
        return result;
    }

    collapse(q, outcome) {
        if (this._x.has(q)) {
            outcome = !outcome;
        }
        this._sub.collapse(q, outcome);
        this._z.delete(q);
    }

    toString() {
        return `PauliFrame(${this.sub})`;
    }
}

/**
 * @param {!Set.<T>} set
 * @param {T} item
 * @param {!boolean} membership
 * @template T
 */
function set_membership(set, item, membership) {
    if (membership) {
        set.add(item);
    } else {
        set.delete(item);
    }
}

/**
 * @param {!Set.<T>} set
 * @param {T} item
 * @template T
 */
function toggle_membership(set, item) {
    set_membership(set, item, !set.has(item));
}

export {PauliFrame}
