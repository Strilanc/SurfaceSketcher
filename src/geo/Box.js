import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"
import {Vector} from "src/geo/Vector.js"

/**
 * @param {!int} v
 * @param {!int} amount
 * @returns {!int}
 */
function rot3(v, amount) {
    let inverse_amount = (3 - amount) % 3;
    let m = (1 << inverse_amount) - 1;
    let low = v & m;
    let high = v & ~m;
    let new_high = low << amount;
    let new_low = high >> inverse_amount;
    return new_low | new_high;
}

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
     * @param {![!number, !number, !number, !number]} color
     * @returns {!RenderData}
     */
    toRenderData(color) {
        let positions = this.corners();
        let colors = [];
        for (let i = 0; i < 8; i++) {
            colors.push(color);
        }
        return new RenderData(positions, colors, BOX_TRIANGLE_INDICES, this._wireframeRenderData());
    }

    /**
     * @returns {!RenderData}
     */
    _wireframeRenderData() {
        let positions = [];
        for (let segment of this.lineSegments()) {
            for (let e of segment) {
                positions.push(e);
            }
        }

        let colors = [];
        while (colors.length < positions.length) {
            colors.push([0, 0, 0, 1]);
        }

        let indexData = [];
        while (indexData.length < positions.length) {
            indexData.push(indexData.length);
        }

        return new RenderData(positions, colors, indexData, undefined);
    }

    /**
     * @returns {!Array.<![!Point, !Point]>}
     */
    lineSegments() {
        let corners = this.corners();
        // 0-----1
        // |\    |\
        // | 4-----5
        // 2-|---3 |
        //  \|    \|
        //   6-----7

        let segments = [];
        for (let j = 0; j < 3; j++) {
            for (let i = 0; i < 4; i++) {
                segments.push([corners[rot3(2*i, j)], corners[rot3(2*i + 1, j)]]);
            }
        }
        return segments;
    }

    /**
     * @returns {!Point}
     */
    center() {
        return this.baseCorner.plus(this.diagonal.scaledBy(0.5));
    }

    /**
     * @param {!Point} pt
     * @returns {undefined|!Vector}
     */
    facePointToDirection(pt) {
        if (Math.abs(pt.x - this.baseCorner.x) < 0.001) {
            return new Vector(-1, 0, 0);
        }
        if (Math.abs(pt.x - this.baseCorner.x - this.diagonal.x) < 0.001) {
            return new Vector(+1, 0, 0);
        }
        if (Math.abs(pt.y - this.baseCorner.y) < 0.001) {
            return new Vector(0, -1, 0);
        }
        if (Math.abs(pt.y - this.baseCorner.y - this.diagonal.y) < 0.001) {
            return new Vector(0, +1, 0);
        }
        if (Math.abs(pt.z - this.baseCorner.z) < 0.001) {
            return new Vector(0, 0, -1);
        }
        if (Math.abs(pt.z - this.baseCorner.z - this.diagonal.z) < 0.001) {
            return new Vector(0, 0, +1);
        }
        return undefined;
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


export {Box, BOX_TRIANGLE_INDICES, rot3}
