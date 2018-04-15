import {ChpSimulator} from "src/sim/ChpSimulator.js";


class XY {
    /**
     * @param {!int} x
     * @param {!int} y
     * @param {!boolean=} must_be_active
     */
    constructor(x, y, must_be_active=false) {
        this.x = x;
        this.y = y;
        this.must_be_active = must_be_active;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `(${this.x}, ${this.y})` + (this.must_be_active ? ' [must be active]' : '');
    }

    /**
     * @param {!XY|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof XY &&
            this.x === other.x &&
            this.y === other.y &&
            this.must_be_active === other.must_be_active;
    }
}



class Measurement {
    /**
     * @param {!boolean} result
     * @param {!boolean} random
     */
    constructor(result, random) {
        this.result = result;
        this.random = random;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `${this.result} (${this.random ? 'random' : 'determined'})`;
    }

    /**
     * @param {!Measurement|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Measurement && this.result === other.result && this.random === other.random;
    }
}


class Surface {
    /**
     * @param {!int} width
     * @param {!int} height
     */
    constructor(width, height) {
        this.width = width;
        this.height = height;
        let n = width * height;
        this.state = new ChpSimulator(n);
        for (let i = 0; i < n; i++) {
            this.state.qalloc();
        }
        /** @type {!Array.<!Measurement>} */
        this.last_measures = [];
        /** @type {!Array.<!boolean>} */
        this.disabled_qubits = [];
        for (let i = 0; i < n; i++) {
            this.last_measures.push(new Measurement(false, false));
            this.disabled_qubits.push(false);
        }
    }

    destruct() {
        this.state.destruct();
    }

    /**
     * @param {!XY} xy
     * @returns {undefined|!int}
     */
    _qubit_at(xy) {
        let x = xy.x;
        let y = xy.y;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return undefined;
        }
        let q = y * this.width + x;
        if (xy.must_be_active && this.disabled_qubits[q]) {
            return undefined;
        }

        return q;
    }

    /**
     * @returns {!Surface}
     */
    clone() {
        let result = new Surface(this.width, this.height);
        result.state.destruct();
        result.state = this.state.clone();
        result.last_measures = this.last_measures.slice();
        result.disabled_qubits = this.disabled_qubits.slice();
        return result;
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        let q1 = this._qubit_at(control);
        let q2 = this._qubit_at(target);
        if (q1 !== undefined && q2 !== undefined) {
            this.state.cnot(q1, q2);
        }
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        let q = this._qubit_at(target);
        if (q !== undefined) {
            this.state.hadamard(q);
        }
    }

    /**
     * @param {!XY} target
     */
    phase(target) {
        let q = this._qubit_at(target);
        if (q !== undefined) {
            this.state.phase(q);
        }
    }

    /**
     * @param {!XY} target
     * @returns {!Measurement}
     */
    measure(target) {
        let q = this._qubit_at(target);
        if (q === undefined) {
            return new Measurement(false, false);
        }
        let r = this.state.measure_peek(q);
        let result = (r & 1) !== 0;
        let random = (r & 2) !== 0;
        return new Measurement(result, random);
    }

    /**
     * @param {!XY} target
     */
    phase_toggle(target) {
        let q = this._qubit_at(target);
        if (q !== undefined) {
            this.state.z(q);
        }
    }

    /**
     * @param {!XY} target
     */
    toggle(target) {
        let q = this._qubit_at(target);
        if (q !== undefined) {
            this.state.x(q);
        }
    }

    /**
     * @param {!XY} target
     * @returns {!Measurement}
     */
    measure_and_reset(target) {
        let m = this.measure(target);
        if (m.result) {
            this.toggle(target);
        }
        return m;
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_data(xy) {
        return this.is_x_col(xy.x) !== this.is_x_row(xy.y) && this._qubit_at(xy) !== undefined;
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_x(xy) {
        return this.is_x_col(xy.x) && this.is_x_row(xy.y) && this._qubit_at(xy) !== undefined;
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_z(xy) {
        return this.is_z_col(xy.x) && this.is_z_row(xy.y) && this._qubit_at(xy) !== undefined;
    }

    /**
     * @param {!int} col
     * @returns {!boolean}
     */
    is_z_col(col) {
        return (col & 1) === 0;
    }

    /**
     * @param {!int} col
     * @returns {!boolean}
     */
    is_x_col(col) {
        return !this.is_z_col(col);
    }

    /**
     * @param {!int} row
     * @returns {!boolean}
     */
    is_z_row(row) {
        return (row & 1) === 0;
    }

    /**
     * @param {!int} row
     * @returns {!boolean}
     */
    is_x_row(row) {
        return !this.is_z_row(row);
    }

    /**
     * @param {!XY} xy
     * @returns {![!XY, !XY, !XY, !XY]}
     */
    neighbors(xy) {
        let x = xy.x;
        let y = xy.y;
        let n1 = new XY(x + 1, y, xy.must_be_active);
        let n2 = new XY(x - 1, y, xy.must_be_active);
        let n3 = new XY(x, y + 1, xy.must_be_active);
        let n4 = new XY(x, y - 1, xy.must_be_active);
        return [n1, n2, n3, n4];
    }


    /**
     * @param {!XY} measurement_qubit
     * @returns {!Measurement}
     */
    measure_local_stabilizer(measurement_qubit) {
        let m = this._qubit_at(measurement_qubit);
        if (m === undefined || this.is_data(measurement_qubit)) {
            return new Measurement(false, false);
        }
        let x_type = this.is_x(measurement_qubit);
        let x = measurement_qubit.x;
        let y = measurement_qubit.y;
        let n = this.neighbors(new XY(x, y, true));
        this.measure_and_reset(measurement_qubit);
        if (x_type) {
            for (let e of n) {
                this.hadamard(e);
            }
        }
        for (let e of n) {
            this.cnot(e, measurement_qubit);
        }
        if (x_type) {
            for (let e of n) {
                this.hadamard(e);
            }
        }
        let result = this.measure_and_reset(measurement_qubit);
        this.last_measures[m] = result;
        return result;
    }


    /**
     * @param {!XY} xy
     * @returns {!Measurement}
     */
    last_measure(xy) {
        let m = this._qubit_at(xy);
        if (m === undefined) {
            return new Measurement(false, false);
        }
        return this.last_measures[m];
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_disabled(xy) {
        let m = this._qubit_at(xy);
        if (m === undefined) {
            return false;
        }
        return this.disabled_qubits[m];
    }

    /**
     * @param {!XY} xy
     * @param {!boolean} disabled
     * @returns {!boolean} previous value
     */
    set_disabled(xy, disabled) {
        let m = this._qubit_at(xy);
        if (m === undefined) {
            return false;
        }
        let prev = this.disabled_qubits[m];
        this.disabled_qubits[m] = disabled;
        return prev;
    }

    /**
     * @param xy
     * @returns {!{x: !number, y: !number, z: !number}}
     */
    peek_bloch_vector(xy) {
        let m = this._qubit_at(xy);
        if (m === undefined) {
            return {x: 0, y: 0, z: 1};
        }
        return this.state.blochVector(m);
    }
}

export {XY, Measurement, Surface}
