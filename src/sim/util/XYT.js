import {XY} from "src/sim/util/XY.js";

/**
 * The location of a spacetime event.
 */
class XYT {
    /**
     * @param {!int} x
     * @param {!int} y
     * @param {!int} t
     */
    constructor(x, y, t) {
        this.x = x;
        this.y = y;
        this.t = t;
    }

    /**
     * @returns {!XY}
     */
    get xy() {
        return new XY(this.x, this.y);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `(${this.x}, ${this.y}) @ ${this.t}`
    }

    /**
     * @param {!XYT|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof XYT && this.x === other.x && this.y === other.y && this.t === other.t;
    }
}

export {XYT}
