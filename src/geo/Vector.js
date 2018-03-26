class Vector {
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
     * @param {!Vector} other
     * @returns {!Vector}
     */
    cross(other) {
        return new Vector(
            this.y * other.z - this.z * other.y,
            this.z * other.x - this.x * other.z,
            this.x * other.y - this.y * other.x);
    }

    /**
     * @returns {!number}
     */
    length() {
        return Math.sqrt(this.norm2());
    }

    /**
     * @returns {!Vector}
     */
    unit() {
        return this.scaledBy(1 / this.length());
    }

    /**
     * @param {!number} scalar
     * @returns {!Vector}
     */
    scaledBy(scalar) {
        return new Vector(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    /**
     * @param {!Vector} other
     * @returns {!Vector}
     */
    pointwiseMultiply(other) {
        return new Vector(this.x * other.x, this.y * other.y, this.z * other.z);
    }

    /**
     * @param {!Vector} other
     * @returns {!number}
     */
    dot(other) {
        return this.x * other.x + this.y * other.y + this.z * other.z;
    }

    /**
     * @returns {!number}
     */
    norm2() {
        return this.dot(this);
    }

    /**
     * @param {!Vector} other
     * @returns {!Vector}
     */
    projectOnto(other) {
        return other.scaledBy(this.dot(other) / other.norm2())
    }

    /**
     * @param {!Vector} other
     * @returns {!Vector}
     */
    perpOnto(other) {
        return this.minus(this.projectOnto(other));
    }

    /**
     * @param {!Vector} other
     * @returns {!Vector}
     */
    minus(other) {
        return new Vector(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    /**
     * @param {!Vector} other
     * @returns {!Vector}
     */
    plus(other) {
        return new Vector(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    /**
     * @param {*|!Plane} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Vector &&
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
        return other instanceof Vector &&
            Math.abs(this.x - other.x) <= epsilon &&
            Math.abs(this.y - other.y) <= epsilon &&
            Math.abs(this.z - other.z) <= epsilon;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `<${this.x}, ${this.y}, ${this.z}>`;
    }
}

export {Vector}
