class Plane {
    /**
     * @param {!Point} center
     * @param {!Vector} normal
     */
    constructor(center, normal) {
        this.center = center;
        this.normal = normal.unit();
    }

    /**
     * @param {!Point} pt
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    containsPoint(pt, epsilon) {
        return Math.abs(pt.minus(this.center).dot(this.normal)) < epsilon;
    }

    /**
     * @param {!Point} pt
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isPointInNormalDirection(pt, epsilon) {
        return pt.minus(this.center).dot(this.normal) >= -epsilon;
    }

    /**
     * @param {*|!Plane} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Plane &&
            this.center.isEqualTo(other.center) &&
            this.normal.isEqualTo(other.normal);
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Plane &&
            this.center.isApproximatelyEqualTo(other.center, epsilon) &&
            this.normal.isApproximatelyEqualTo(other.normal, epsilon);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `Plane(${this.center}, ${this.normal})`;
    }
}

export {Plane}
