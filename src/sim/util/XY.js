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
     * @param {!int} dx
     * @param {!int} dy
     * @returns {!XY}
     */
    offsetBy(dx, dy) {
        return new XY(this.x + dx, this.y + dy, this.must_be_active);
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
     * @returns {!XY}
     */
    rightNeighbor() {
        return new XY(this.x + 1, this.y, this.must_be_active);
    }

    /**
     * @returns {!XY}
     */
    leftNeighbor() {
        return new XY(this.x - 1, this.y, this.must_be_active);
    }

    /**
     * @returns {!XY}
     */
    aboveNeighbor() {
        return new XY(this.x, this.y - 1, this.must_be_active);
    }

    /**
     * @returns {!XY}
     */
    belowNeighbor() {
        return new XY(this.x, this.y + 1, this.must_be_active);
    }

    /**
     * @returns {![!XY, !XY, !XY, !XY]}
     */
    neighbors() {
        return [this.rightNeighbor(), this.leftNeighbor(), this.belowNeighbor(), this.aboveNeighbor()];
    }
}

export {XY}
