/**
 * Exposes a promise and methods to manually resolve or reject it.
 */
class PromiseSource {
    /**
     * @constructor
     * @template T
     */
    constructor() {
        /**
         * @type {!function(result: *) : void}
         * @private
         */
        this._resolve = undefined;
        /**
         * @type {!function(error: *) : void}
         * @private
         */
        this._reject = undefined;

        this.promise = new Promise((resolve, reject) => {
            this._resolve = resolve;
            this._reject = reject;
        });
    }

    /**
     * @param {*} result
     */
    setResult(result) {
        this._resolve(result);
    }

    /**
     * @param {*} error
     */
    setError(error) {
        this._reject(error);
    }
}

export {PromiseSource}
