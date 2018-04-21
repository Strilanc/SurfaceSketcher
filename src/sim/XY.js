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

export {XY}
