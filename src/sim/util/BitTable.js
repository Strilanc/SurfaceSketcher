import {Seq} from "src/base/Seq.js";
import {SimulatorSpec} from "src/sim/SimulatorSpec.js";

class BitTable extends SimulatorSpec {
    constructor(width, height) {
        super();
        this.width = width;
        this.height = height;
        this._state = new Uint8Array(width * height);
    }

    /**
     * @param {!int} width
     * @param {!int} height
     * @returns {!BitTable}
     */
    resized(width, height) {
        let result = new BitTable(width, height);
        let w = Math.min(this.width, width);
        let h = Math.min(this.height, height);
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                result.set(i, j, this.get(i, j));
            }
        }
        return result;
    }

    /**
     *
     * @param {!int} x
     * @param {!int} y
     * @returns {!int}
     */
    get(x, y) {
        return this._state[x + y*this.width] !== 0 ? 1 : 0;
    }

    /**
     * @param {!int} y
     * @returns {!BitTable}
     */
    getRow(y) {
        let result = new BitTable(this.width, 1);
        for (let i = 0; i < this.width; i++) {
            result.set(i, 0, this.get(i, y));
        }
        return result;
    }

    /**
     * @param {!int} y
     * @param {!BitTable} newRow
     */
    setRow(y, newRow) {
        for (let i = 0; i < this.width; i++) {
            this.set(i, y, newRow.get(i, 0));
        }
    }

    /**
     * @param {!int} y
     * @param {!BitTable} maskRow
     */
    xorRow(y, maskRow) {
        for (let i = 0; i < this.width; i++) {
            this.set(i, y, this.get(i, y) ^ maskRow.get(i, 0));
        }
    }

    /**
     * @param {!int} x
     * @param {!int} y
     * @param {!number} v
     */
    set(x, y, v) {
        this._state[x + y*this.width] = v ? 1 : 0;
    }

    /**
     * @param {!int} x
     * @param {!int} y
     * @param {!number} v
     */
    xor(x, y, v) {
        this._state[x + y*this.width] ^= v ? 1 : 0;
    }

    /**
     * @param {!int} srcRowIndex
     * @param {!int} dstRowIndex
     */
    rowXorFromInto(srcRowIndex, dstRowIndex) {
        let src = srcRowIndex*this.width;
        let dst = dstRowIndex*this.width;
        for (let x = 0; x < this.width; x++) {
            this._state[dst + x] ^= this._state[src + x];
        }
    }

    /**
     * @param {*|!BitTable} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (!(other instanceof BitTable)) {
            return false;
        }
        for (let i = 0; i < this._state.length; i++) {
            if (this._state[i] !== other._state[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return Seq.range(this.height).map(
            y => Seq.range(this.width).map(
                x => this.get(x, y) ? '1' : '0'
            ).join('')
        ).join('\n');
    }
}

export {BitTable}
