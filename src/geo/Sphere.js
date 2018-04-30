import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"
import {Vector} from "src/geo/Vector.js"

/**
 * An axis-aligned box.
 */
class Sphere {
    /**
     * @param {!Point} center
     * @param {!number} radius
     */
    constructor(center, radius) {
        this.center = center;
        this.radius = radius;
    }

    /**
     * @param {![!number, !number, !number, !number]} color
     * @returns {!RenderData}
     */
    toRenderData(color) {
        let positions = IcosahedronVertices.map(e => this.center.plus(e.scaledBy(this.radius)));
        let colors = IcosahedronVertices.map(e => color);
        return new RenderData(positions, colors, IcosahedronIndices,
            new RenderData([], [], [], undefined));
    }

    /**
     * @param {*|!Sphere} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Sphere &&
            this.center.isEqualTo(other.center) &&
            this.radius === other.radius;
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Sphere &&
            this.center.isApproximatelyEqualTo(other.center, epsilon) &&
            Math.abs(this.radius - other.radius) <= epsilon;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `Sphere(${this.center}, ${this.radius})`;
    }
}

const IcosahedronVertices = [
    new Vector(-0.525731, 0, 0.850651), new Vector(0.525731, 0, 0.850651),
    new Vector(-0.525731, 0, -0.850651), new Vector(0.525731, 0, -0.850651),
    new Vector(0, 0.850651, 0.525731), new Vector(0, 0.850651, -0.525731),
    new Vector(0, -0.850651, 0.525731), new Vector(0, -0.850651, -0.525731),
    new Vector(0.850651, 0.525731, 0), new Vector(-0.850651, 0.525731, 0),
    new Vector(0.850651, -0.525731, 0), new Vector(-0.850651, -0.525731, 0)
];

const IcosahedronIndices = [
    1,4,0,  4,9,0,  4,5,9,  8,5,4,  1,8,4,
    1,10,8, 10,3,8, 8,3,5,  3,2,5,  3,7,2,
    3,10,7, 10,6,7, 6,11,7, 6,0,11, 6,1,0,
    10,1,6, 11,0,9, 2,11,9, 5,2,9,  11,2,7,
];

export {Sphere}
