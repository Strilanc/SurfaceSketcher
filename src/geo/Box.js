/**
 * @param {!int} v
 * @param {!int} amount
 * @returns {!int}
 */
import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"
import {Vector} from "src/geo/Vector.js"
import {Quad} from "src/geo/Quad.js";

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
     * @param {![!number, !number, !number, !number]} color
     * @param {undefined|!Rect} topTextureCoords
     * @returns {!RenderData}
     */
    toRenderData(color, topTextureCoords=undefined) {
        let positions = this.renderPoints();
        let colors = [];
        for (let i = 0; i < 24; i++) {
            colors.push(color);
        }
        let textureCoordData = undefined;
        if (topTextureCoords !== undefined) {
            let {x, y, w, h} = topTextureCoords;
            textureCoordData = [
                [x, y],
                [x+w, y],
                [x+w, y+h],
                [x, y+h],
            ];
            while (textureCoordData.length < 24) {
                textureCoordData.push([0, 0]);
            }
        }
        return new RenderData(positions, colors, BOX_TRIANGLE_INDICES, this._wireframeRenderData(), textureCoordData);
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
        for (let n = 0; n < positions.length; n += 2) {
            indexData.push(n, n + 1);
        }

        return new RenderData(positions, colors, indexData, undefined);
    }

    /**
     * @returns {!Array.<![!Point, !Point]>}
     */
    lineSegments() {
        let corners = this.corners();

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
     * @param {!int} dir
     * @param {!boolean} side
     * @returns {![!Point, !Point, !Point, !Point]}
     * @private
     */
    _facePoints(dir, side) {
        let corners = this.corners();
        let m = side ? 0b100 : 0;
        return [0, 1, 3, 2].map(i => corners[rot3((i | m), dir)]);
    }

    /**
     * @param {!Vector} dir
     * @returns {!Quad}
     */
    faceQuad(dir) {
        let side = dir.x + dir.y + dir.z < 0;
        let d = Math.abs(dir.dot(new Vector(0, 2, 1)));
        let points = this._facePoints(d, side);
        return new Quad(points[0], points[1].minus(points[0]), points[3].minus(points[0]));
    }

    /**
     * @returns {!Array.<!Point>}
     */
    renderPoints() {
        return [
            ...this._facePoints(2, true),
            ...this._facePoints(1, true),
            ...this._facePoints(0, true),
            ...this._facePoints(2, false),
            ...this._facePoints(1, false),
            ...this._facePoints(0, false),
        ];
    }

    /**
     * Returns the locations of corners making up the cube, with the following index-to-position mapping:
     *
     *   Y
     *   |    0-----4
     *   |    |\    |\
     *   |    | 1-----5
     *   |    2-|---6 |
     *   |     \|    \|
     *   |      3-----7
     *   |
     *   +----------------X
     *    \
     *     \
     *      \
     *       Z
     *
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

const BOX_TRIANGLE_INDICES = [
    0,  1,  2,      0,  2,  3,
    4,  5,  6,      4,  6,  7,
    8,  9,  10,     8,  10, 11,
    12, 13, 14,     12, 14, 15,
    16, 17, 18,     16, 18, 19,
    20, 21, 22,     20, 22, 23,
];

export {Box, BOX_TRIANGLE_INDICES, rot3}
