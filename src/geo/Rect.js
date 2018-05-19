/**
 * A 2d rectangle.
 */
class Rect {
    /**
     * @param {!number} x
     * @param {!number} y
     * @param {!number} w
     * @param {!number} h
     */
    constructor(x, y, w, h) {
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
    }

    /**
     * @returns {!Rect}
     */
    flip() {
        return new Rect(this.x + this.w, this.y + this.h, -this.w, -this.h);
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    contains(xy) {
        let {x, y} = xy;
        return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.y;
    }

    /**
     * @param {!int} dx
     * @param {!int} dy
     * @returns {!Rect}
     */
    offsetBy(dx, dy) {
        return new Rect(this.x + dx, this.y + dy, this.w, this.h);
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Rect &&
            other.x === this.x &&
            other.y === this.y &&
            other.w === this.w &&
            other.h === this.h;
    }

    /**
     * @param {!number} s
     * @returns {!Rect}
     */
    scaledBy(s) {
        return new Rect(this.x * s, this.y * s, this.w * s, this.h * s);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `Rect(${this.x}, ${this.y}, ${this.w}, ${this.h})`;
    }
}

export {Rect}
