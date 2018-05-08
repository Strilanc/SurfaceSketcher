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
     * @returns {!Point}
     */
    clone() {
        return new Point(this.x, this.y, this.z);
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
     * Linear interpolation between two points.
     *
     * @param {!Point} other
     * @param {!number} p interpolation coefficient
     * @returns {!Point}
     */
    lerp(other, p) {
        return this.plus(other.minus(this).scaledBy(p));
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

    /**
     * @param {!Writer} out
     */
    write(out) {
        out.writeFloat64(this.x);
        out.writeFloat64(this.y);
        out.writeFloat64(this.z);
    }

    /**
     * @param {!Reader} inp
     * @returns {!Point}
     */
    static read(inp) {
        let x = inp.readFloat64();
        let y = inp.readFloat64();
        let z = inp.readFloat64();
        return new Point(x, y, z);
    }
}

export {Point}
