import {ChpSimulator} from "src/sim/ChpSimulator.js";
import {Measurement} from "src/sim/Measurement.js";
import {XY} from "src/sim/util/XY.js";


class Surface {
    /**
     * @param {!int} width
     * @param {!int} height
     * @param {!SimulatorSpec} simulator
     */
    constructor(width, height, simulator=undefined) {
        this.width = width;
        this.height = height;
        let n = width * height;
        this.state = simulator !== undefined ? simulator : new ChpSimulator(n);
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

    measureAllStabilizers() {
        for (let i = 0; i < this.width; i++) {
            for (let j = i & 1; j < this.height; j += 2) {
                this.measure_local_stabilizer(new XY(i, j, true));
            }
        }
    }

    clearXStabilizers() {
        this.measureAllStabilizers();
        for (let j = 1; j < this.height; j += 2) {
            let parity = false;
            for (let i = (this.width | 1) - 2; i >= 0; i -= 2) {
                parity ^= this.last_measure(new XY(i, j)).result;
                if (parity) {
                    this.phase_toggle(new XY(i - 1, j));
                }
            }
        }
        this.measureAllStabilizers();
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
        return xy.neighbors();
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

export {Surface}
