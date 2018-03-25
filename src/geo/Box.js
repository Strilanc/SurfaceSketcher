import {Point} from "src/geo/Point.js"

/**
 * An axis-aligned box.
 */
class Box {
    /**
     * @param {!Point} baseCorner
     * @param {!Vector} diagonal
     */
    constructor(baseCorner, diagonal) {
        this.baseCorner = baseCorner;
        this.diagonal = diagonal;
    }

    /**
     * @returns {!Array.<!number>}
     */
    cornerCoords() {
        let result = [];
        for (let corner of this.corners()) {
            result.push(corner.x, corner.y, corner.z);
        }
        return result;
    }

    /**
     * @returns {!Array.<!Point>}
     */
    corners() {
        let corners = [];
        for (let x of [this.baseCorner.x, this.baseCorner.x + this.diagonal.x]) {
            for (let y of [this.baseCorner.y, this.baseCorner.y + this.diagonal.y]) {
                for (let z of [this.baseCorner.z, this.baseCorner.z + this.diagonal.z]) {
                    corners.push(new Point(x, y, z));
                }
            }
        }
        return corners;
    }

    /**
     * @param {*|!Box} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Box &&
            this.baseCorner.isEqualTo(other.baseCorner) &&
            this.diagonal.isEqualTo(other.diagonal);
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Box &&
            this.baseCorner.isApproximatelyEqualTo(other.baseCorner, epsilon) &&
            this.diagonal.isApproximatelyEqualTo(other.diagonal, epsilon);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `Box(${this.baseCorner}, ${this.diagonal})`;
    }
}

const SQUARE_TRIANGLE_INDICES = [0, 1, 2, 1, 2, 3];
const BOX_TRIANGLE_INDICES = [];
for (let r = 0; r < 3; r++) {
    for (let m of [0, 7]) {
        for (let e of SQUARE_TRIANGLE_INDICES) {
            e = ((e << r) | (e >> (3 - r))) & 7;
            e ^= m;
            BOX_TRIANGLE_INDICES.push(e);
        }
    }
}

export {Box, BOX_TRIANGLE_INDICES}
