import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"
import {Vector} from "src/geo/Vector.js"
import {lineSegmentPathWireframeRenderData} from "src/draw/Shapes.js"

/**
 * A flat quadrilateral in 3d space.
 */
class Quad {
    /**
     * @param {!Point} origin
     * @param {!Vector} horizontal
     * @param {!Vector} vertical
     */
    constructor(origin, horizontal, vertical) {
        this.origin = origin;
        this.horizontal = horizontal;
        this.vertical = vertical;
    }

    /**
     * @returns {!Quad}
     */
    swapLegs() {
        return new Quad(this.origin, this.vertical, this.horizontal);
    }

    /**
     * @returns {!Quad}
     */
    flipHorizontal() {
        return new Quad(this.origin.plus(this.horizontal), this.horizontal.scaledBy(-1), this.vertical);
    }

    /**
     * @param {!Vector} delta
     * @returns {!Quad}
     */
    offsetBy(delta) {
        return new Quad(this.origin.plus(delta), this.horizontal, this.vertical);
    }

    /**
     * @param {undefined|![!number, !number, !number, !number]} color
     * @param {undefined|!Rect} textureCoords
     * @param {undefined|![!number, !number, !number, !number]} lineColor
     * @returns {!RenderData}
     */
    toRenderData(color, textureCoords=undefined, lineColor=undefined) {
        let positions = this.corners();
        let colors = [];
        for (let i = 0; i < 4; i++) {
            colors.push(color);
        }
        let textureCoordData = undefined;
        if (textureCoords !== undefined) {
            let {x, y, w, h} = textureCoords;
            textureCoordData = [
                [x, y],
                [x+w, y],
                [x+w, y+h],
                [x, y+h],
            ]
        }
        let indices = QUAD_TRIANGLE_INDICES;
        let lineData = lineSegmentPathWireframeRenderData(positions, lineColor, true);

        if (color === undefined) {
            positions = [];
            colors = [];
            textureCoordData = [];
            indices = [];
        }
        return new RenderData(
            positions,
            colors,
            indices,
            lineData,
            textureCoordData);
    }

    /**
     * @returns {!Array.<!Point>}
     */
    corners() {
        return [
            this.origin.clone(),
            this.origin.plus(this.horizontal),
            this.origin.plus(this.vertical).plus(this.horizontal),
            this.origin.plus(this.vertical),
        ];
    }

    /**
     * @param {*|!Box} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Quad &&
            this.origin.isEqualTo(other.origin) &&
            this.horizontal.isEqualTo(other.horizontal) &&
            this.vertical.isEqualTo(other.vertical);
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Quad &&
            this.origin.isApproximatelyEqualTo(other.origin, epsilon) &&
            this.horizontal.isApproximatelyEqualTo(other.horizontal, epsilon) &&
            this.vertical.isApproximatelyEqualTo(other.vertical, epsilon);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `Quad(${this.origin}, ${this.horizontal}, ${this.vertical})`;
    }
}

const QUAD_TRIANGLE_INDICES = [0, 1, 2, 0, 2, 3];
export {Quad}
