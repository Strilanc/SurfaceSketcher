import {Vector} from "src/geo/Vector.js";

class Point {
    /**
     * @param {!number} x
     * @param {!number} y
     * @param {!number} z
     */
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    /**
     * @param {!Point} other
     * @returns {!Vector}
     */
    minus(other) {
        return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    /**
     * @param {!Vector} delta
     * @returns {!Point}
     */
    plus(delta) {
        return new Point(this.x + delta.x, this.y + delta.y, this.z + delta.z);
    }

    /**
     * @returns {!Vector}
     */
    asVector() {
        return new Vector(this.x, this.y, this.z);
    }

    /**
     * Determines if this point is "between" the two given points, in a certain loose sense.
     *
     * Let L be the line segment between a and b. Let C be the point on L that is closest to this point. This method
     * returns true if C != a and C != b.
     *
     * @param {!Point} a
     * @param {!Point} b
     * @returns {!boolean}
     */
    isBetweenBeside(a, b) {
        let d = b.minus(a);
        let c = this.minus(a).projectOnto(d);
        return c.norm2() < d.norm2() && c.dot(d) > 0;
    }

    /**
     * @param {*|!Plane} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Point &&
            this.x === other.x &&
            this.y === other.y &&
            this.z === other.z;
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Point &&
            Math.abs(this.x - other.x) <= epsilon &&
            Math.abs(this.y - other.y) <= epsilon &&
            Math.abs(this.z - other.z) <= epsilon;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `(${this.x}, ${this.y}, ${this.z})`;
    }
}

export {Point}
