import {BOX_TRIANGLE_INDICES} from "src/geo/Box.js";
import {seq} from "src/base/Seq.js";
import {Triangle} from "src/geo/Triangle.js";

class Ray {
    /**
     * @param {!Point} start
     * @param {!Vector} direction
     */
    constructor(start, direction) {
        this.start = start;
        this.direction = direction.unit();
    }

    /**
     * @param {!Plane} plane
     * @param {!number} epsilon
     * @returns {undefined|!Point}
     */
    intersectPlane(plane, epsilon) {
        let scalarDistance = plane.center.minus(this.start).dot(plane.normal);
        let scalarDirection = this.direction.dot(plane.normal);
        if (scalarDirection < epsilon) {
            return undefined;
        }
        let t = scalarDistance / scalarDirection;
        if (t < 0) {
            return undefined;
        }

        return this.start.plus(this.direction.scaledBy(t));
    }

    /**
     * @param {!Triangle} triangle
     * @param {!number} epsilon
     * @returns {undefined|!Point}
     */
    intersectTriangle(triangle, epsilon) {
        let pt = this.intersectPlane(triangle.plane(), epsilon);
        if (pt === undefined || !triangle.containsPoint(pt, epsilon)) {
            return undefined;
        }
        return pt;
    }

    /**
     * @param {!Array.<!Point>} pts
     * @returns {!Point}
     */
    firstPoint(pts) {
        return seq(pts).minBy(pt => pt.minus(this.start).dot(this.direction));
    }

    /**
     * @param {!Box} box
     * @param {!number} epsilon
     * @returns {undefined|!Point}
     */
    intersectBox(box, epsilon) {
        let corners = box.corners();
        let pts = [];
        for (let i = 0; i < BOX_TRIANGLE_INDICES.length; i += 3) {
            let t = new Triangle(
                corners[BOX_TRIANGLE_INDICES[i]],
                corners[BOX_TRIANGLE_INDICES[i + 1]],
                corners[BOX_TRIANGLE_INDICES[i + 2]]);
            let pt = this.intersectTriangle(t, epsilon);
            if (pt !== undefined) {
                pts.push(pt);
            }
        }
        if (pts.length === 0) {
            return undefined;
        }
        return this.firstPoint(pts);
    }

    /**
     * @param {*|!Plane} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Ray &&
            this.start.isEqualTo(other.start) &&
            this.direction.isEqualTo(other.direction);
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Ray &&
            this.start.isApproximatelyEqualTo(other.start, epsilon) &&
            this.direction.isApproximatelyEqualTo(other.direction, epsilon);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `${this.start} + t*${this.direction}`;
    }
}

export {Ray}
