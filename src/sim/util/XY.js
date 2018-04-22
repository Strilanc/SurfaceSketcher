import {DetailedError} from "src/base/DetailedError.js"

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

    /**
     * @param {!string} text
     * @returns {!XY}
     */
    static parseFrom(text) {
        if (!text.match(/\(\d+,\s*\d+\)/)) {
            throw new DetailedError('Invalid.', {text});
        }
        let [x, y] = text.substring(1, text.length - 1).split(',');
        return new XY(Number.parseInt(x.trim()), Number.parseInt(y.trim()));
    }

    /**
     * @returns {![!XY, !XY, !XY, !XY]}
     */
    neighbors() {
        let {x, y, must_be_active: b} = this;
        let n1 = new XY(x + 1, y, b);
        let n2 = new XY(x - 1, y, b);
        let n3 = new XY(x, y + 1, b);
        let n4 = new XY(x, y - 1, b);
        return [n1, n2, n3, n4];
    }
}

export {XY}
