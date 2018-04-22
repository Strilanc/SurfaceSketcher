import {PromiseSource} from "src/sim/util/PromiseSource.js";

/**
 * A manually incremented counter that can return promises that resolve when the counter reaches particular values.
 */
class AsyncStepper {
    constructor() {
        this.step = 0;
        this._promiseSteps = /** @type {!Map.<!int, !PromiseSource>} */ new Map();
    }

    /**
     * @param {!int} step
     * @returns {!Promise.<!int>}
     */
    awaitStep(step) {
        if (step <= this.step) {
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
        return this.awaitStep(this.step + stepDelta);
    }

    advanceStep() {
        this.step += 1;
        if (this._promiseSteps.has(this.step)) {
            let source = this._promiseSteps.get(this.step);
            source.setResult(this.step);
            this._promiseSteps.delete(this.step);
        }
    }
}

export {AsyncStepper}
