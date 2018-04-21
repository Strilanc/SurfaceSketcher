import {PromiseSource} from "src/sim/util/PromiseSource.js";

/**
 * A manually incremented counter that can return promises that resolve when the counter reaches particular values.
 */
class AsyncStepper {
    constructor() {
        this._step = 0;
        this._promiseSteps = /** @type {!Map.<!int, !PromiseSource>} */ new Map();
    }

    /**
     * @param {!int} step
     * @returns {!Promise.<!int>}
     */
    awaitStep(step) {
        if (step <= this._step) {
            return new Promise(resolve => resolve(step));
        }
        if (!this._promiseSteps.has(step)) {
            this._promiseSteps.set(step, new PromiseSource());
        }
        return this._promiseSteps.get(step).promise;
    }

    /**
     * @param {!int} stepDelta
     * @returns {!Promise.<!int>}
     */
    awaitDelay(stepDelta) {
        return this.awaitStep(this._step + stepDelta);
    }

    advanceStep() {
        this._step += 1;
        if (this._promiseSteps.has(this._step)) {
            let source = this._promiseSteps.get(this._step);
            source.setResult(this._step);
            this._promiseSteps.delete(this._step);
        }
    }
}

export {AsyncStepper}
