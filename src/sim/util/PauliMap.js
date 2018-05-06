import {seq} from "src/base/Seq.js";
import {Axis} from "src/sim/util/Axis.js";
import {XY} from "src/sim/util/XY.js";
import {DetailedError} from "src/base/DetailedError.js";
import {GeneralMap} from "src/base/GeneralMap.js";


/**
 * A phase-insensitive set of Pauli operations to apply to various targets, along with utility methods for modifying
 * the Pauli operations being applied using Clifford operations.
 */
class PauliMap {
    /**
     * @param {!GeneralMap.<*, !int>} operations Maps targets to the Pauli operation being applied.
     */
    constructor(operations=new GeneralMap()) {
        this.operations = operations;
    }

    /**
     * @returns {!PauliMap}
     */
    clone() {
        return new PauliMap(new GeneralMap(...this.operations.entries()));
    }

    /**
     * @param {*} target
     * @param {undefined|!int} mask
     */
    set(target, mask) {
        if (mask === undefined || mask === 0) {
            this.operations.delete(target);
        } else {
            this.operations.set(target, mask);
        }
    }

    /**
     * @returns {!Iterable.<*>}
     */
    targets() {
        return this.operations.keys();
    }

    /**
     * @param {*} targetTransformer
     * @returns {!PauliMap}
     */
    mapTargets(targetTransformer) {
        let map = new GeneralMap();
        for (let [target, operation] of this.operations.entries()) {
            map.set(targetTransformer(target), operation);
        }
        if (map.size !== this.operations.size) {
            throw new DetailedError("Non-reversible key transformation.",
                {targetTransformer, n1: this.operations.size, n2: map.size})
        }
        return new PauliMap(map);
    }

    /**
     * @param {!PauliMap} other
     * @returns {!PauliMap}
     */
    inline_times(other) {
        for (let [k, v] of other.operations.entries()) {
            if ((v & PauliMap.ZMask) !== 0) {
                this.z(k);
            }
            if ((v & PauliMap.XMask) !== 0) {
                this.x(k);
            }
        }
        return this;
    }

    /**
     * @param {!PauliMap} other
     * @returns {!PauliMap}
     */
    times(other) {
        return this.clone().inline_times(other);
    }

    /**
     * @param {*} target
     * @returns {!int}
     */
    get(target) {
        let t = this.operations.get(target);
        return t === undefined ? 0 : t;
    }

    /**
     * @param {*} target
     */
    x(target) {
        let t = this.get(target);
        this.set(target, t ^ PauliMap.XMask);
    }

    /**
     * @param {*} target
     */
    y(target) {
        let t = this.get(target);
        this.set(target, t ^ PauliMap.XMask ^ PauliMap.ZMask);
    }

    /**
     * @param {*} target
     */
    z(target) {
        let t = this.get(target);
        this.set(target, t ^ PauliMap.ZMask);
    }

    /**
     * @param {*} target
     */
    hadamard(target) {
        let t = this.operations.get(target);
        if (t === 1 || t === 2) {
            this.set(target, 3 - t);
        }
    }

    /**
     * @param {*} control
     * @param {*} target
     */
    cnot(control, target) {
        if ((this.get(control) & PauliMap.XMask) !== 0) {
            this.x(target);
        }
        if ((this.get(target) & PauliMap.ZMask) !== 0) {
            this.z(control);
        }
    }

    /**
     * @param {*} target
     * @param {!Axis} axis
     */
    measure(target, axis=Axis.Z) {
        let t = this.get(target);
        if (axis.is_x()) {
            t &= ~PauliMap.XMask;
        } else {
            t &= ~PauliMap.ZMask;
        }
        this.set(target, t);
    }

    /**
     * @param {*|!FixupOperation} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof PauliMap &&
            this.operations.isEqualTo(other.operations);
    }

    /**
     * @returns {!string}
     */
    toString() {
        let effect = seq(this.operations.keys()).sorted().map(k => {
            let v = this.operations.get(k);
            let prefix;
            if (v === PauliMap.XMask) {
                prefix = 'X';
            } else if (v === PauliMap.ZMask) {
                prefix = 'Z';
            } else {
                prefix = 'Y';
            }
            return `${prefix}_${k}`
        }).join(' * ');
        return effect === '' ? 'I' : effect;
    }
}

PauliMap.XMask = 0b01;
PauliMap.ZMask = 0b10;

export {PauliMap}
