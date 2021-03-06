import {DetailedError} from "src/base/DetailedError.js"
import {SimulatorSpec} from "src/sim/SimulatorSpec.js";
import {QState, init_state, free_state, cnot, hadamard, phase, clone_state, measure} from "src/sim/chp_gen.js"

/**
 How to produce chp_gen.js

 0) Go to https://www.scottaaronson.com/chp/ and download "chp.c" as a starting point

 1) Rename chp.c to chp.cpp

 2) Delete unused functions and types that cause trouble.

        delete error
        delete main
        delete readprog
        delete runprog
        delete QProg struct
        delete unused gate macro defs
        delete preparestate
        delete printstate
        delete printbasisstate
        delete printket
        drop s parameter of initstae_ and delete the line that was using it

 3) Every line with a malloc needs a static_cast to the correct type.

 4) Emscripten is confused by pointer args. Use references instead of pointers.
        search-replace "struct QState *" with "struct QState &"
        search-replace "q->" with "q."

 5) Replace includes with:

        #include <cstring>
        #include <cstdlib>

 6) Append this code to the end of the file:

        void free_state(struct QState &q) {
            for (long i = 0; i < 2 * q.n + 1; i++) {
                free(q.x[i]);
                free(q.z[i]);
            }
            free(q.x);
            free(q.z);
            free(q.r);
        }

        QState clone_state(const struct QState &src) {
            QState q = {};
            q.n = src.n;
            q.over32 = src.over32;
            memcpy(q.pw, src.pw, sizeof(q.pw));

            int s = 2 * q.n + 1;
            q.r = static_cast<int *>(malloc(s * sizeof(int)));
            memcpy(q.r, src.r, s * sizeof(int));

            q.x = static_cast<unsigned long **>(malloc(s * sizeof(unsigned long *)));
            q.z = static_cast<unsigned long **>(malloc(s * sizeof(unsigned long *)));
            for (int i = 0; i < s; i++) {
                q.x[i] = static_cast<unsigned long *>(malloc(q.over32 * sizeof(unsigned long)));
                q.z[i] = static_cast<unsigned long *>(malloc(q.over32 * sizeof(unsigned long)));
                memcpy(q.x[i], src.x[i], q.over32 * sizeof(unsigned long));
                memcpy(q.z[i], src.z[i], q.over32 * sizeof(unsigned long));
            }
            return q;
        }


        #include <emscripten/bind.h>
        using namespace emscripten;
        EMSCRIPTEN_BINDINGS(my_module) {
            class_<QState>("QState").constructor<>();
            function("init_state", &initstae_);
            function("cnot", &cnot);
            function("hadamard", &hadamard);
            function("phase", &phase);
            function("measure", &measure);
            function("free_state", &free_state);
            function("clone_state", &clone_state);
        }

    7) Add bool random_result parameter to measure

        search-replace "rand()%2" with "random_result ? 1 : 0"

    8) Compile with Emscripten

        emcc -O1 --bind chp.cpp -std=c++11 -o chp_gen.js

        Note: using -O2 causes a "could not load memory initializer" error when running. Not sure why.

    9) Append export lines to generated code

         let QState = Module.QState;
         let init_state = Module.init_state;
         let free_state = Module.free_state;
         let cnot = Module.cnot;
         let hadamard = Module.hadamard;
         let phase = Module.phase;
         let measure = Module.measure;
         let clone_state = Module.clone_state;
         export {QState, init_state, free_state, cnot, hadamard, phase, clone_state, measure}
*/


class ChpSimulator extends SimulatorSpec {
    /**
     * @param {!int} maxQubitCount
     */
    constructor(maxQubitCount=10) {
        super();
        this._state = new QState();
        init_state(this._state, maxQubitCount);
        this._maxQubitCount = maxQubitCount;
        this._nextQubitId = 0;
        this._qubitToSlotMap = new Map();
        this._qubitSlots = [];
    }

    /**
     * @returns {!ChpSimulator}
     */
    clone() {
        let result = new ChpSimulator(this._maxQubitCount);
        result.destruct();
        result._state = clone_state(this._state);
        result._nextQubitId = this._nextQubitId;
        for (let [k, v] of this._qubitToSlotMap.entries()) {
            result._qubitToSlotMap.set(k, v);
        }
        result._qubitSlots = this._qubitSlots.slice();
        return result;
    }

    qalloc() {
        if (this._qubitSlots.length >= this._maxQubitCount) {
            throw new Error("Too many qubits");
        }
        let id = this._nextQubitId;
        this._nextQubitId += 1;
        this._qubitToSlotMap.set(id, this._qubitSlots.length);
        this._qubitSlots.push(id);
        return id;
    }

    free(q) {
        // Decohere the qubit.
        if (this.measure(q)) {
            this.x(q);
        }

        // Move qubit to deallocate to the end of the list, then pop it off.
        let k = this._slotFor(q);
        let q2 = this._qubitSlots[this._qubitSlots.length - 1];
        this.swap(q, q2);
        this._qubitToSlotMap.set(q2, k);
        this._qubitSlots[k] = q2;
        this._qubitSlots.pop();
        this._qubitToSlotMap.delete(q);
    }

    cnot(control, target) {
        let a = this._slotFor(control);
        let b = this._slotFor(target);
        if (a === b) {
            throw DetailedError('target and control are the same.', {target, control})
        }
        cnot(this._state, a, b);
    }

    hadamard(target) {
        let a = this._slotFor(target);
        hadamard(this._state, a);
    }

    phase(target) {
        let a = this._slotFor(target);
        phase(this._state, a);
    }

    /**
     * @param {!int} q
     * @returns {!int}
     * @private
     */
    _slotFor(q) {
        if (!this._qubitToSlotMap.has(q)) {
            throw new DetailedError('Invalid qubit handle.', {q});
        }
        return this._qubitToSlotMap.get(q);
    }

    probability(target) {
        let q = clone_state(this._state);
        let a = this._slotFor(target);
        let m = measure(q, a, 0, false);
        free_state(q);
        if ((m & 2) !== 0) {
            return 0.5;
        }
        return m;
    }

    measure(target) {
        return (this.measure_peek(target) & 1) !== 0;
    }

    /**
     * @param {!int} target
     * @returns {!int}
     *      0: deterministic off
     *      1: deterministic on
     *      2: random off
     *      3: random on
     */
    measure_peek(target) {
        let a = this._slotFor(target);
        return measure(this._state, a, 0, Math.random() < 0.5);
    }

    collapse(target, outcome) {
        let a = this._slotFor(target);
        let m = measure(this._state, a, 0, outcome);
        let result = (m & 1) !== 0;
        if (result !== outcome) {
            throw new DetailedError("Failed to post-select; result impossible.", {target, m, result, outcome});
        }
    }

    destruct() {
        free_state(this._state);
        this._state = undefined;
    }

    toString() {
        return `ChpSimulator(${this._qubitSlots.length} qubits)`;
    }
}

export {ChpSimulator}
