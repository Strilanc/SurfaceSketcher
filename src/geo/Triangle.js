import {Point} from "src/geo/Plane.js";
import {Plane} from "src/geo/Plane.js";

class Triangle {
    /**
     * @param {!Point} a
     * @param {!Point} b
     * @param {!Point} c
     */
    constructor(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
    }

    /**
     * @returns {!Vector}
     */
    normal() {
        let ab = this.b.minus(this.a);
        let ac = this.c.minus(this.a);
        return ac.cross(ab).unit();
    }

    /**
     * @returns {!Plane}
     */
    plane() {
        return new Plane(this.a, this.normal());
    }

    /**
     * @param {!Point} pt
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    containsPoint(pt, epsilon) {
        let ab = this.a.minus(this.b);
        let bc = this.b.minus(this.c);
        let ca = this.c.minus(this.a);
        let pa = new Plane(this.a, ca.perpOnto(ab));
        let pb = new Plane(this.b, ab.perpOnto(bc));
        let pc = new Plane(this.c, bc.perpOnto(ca));
        return this.plane().containsPoint(pt, epsilon) &&
            pa.isPointInNormalDirection(pt, epsilon) &&
            pb.isPointInNormalDirection(pt, epsilon) &&
            pc.isPointInNormalDirection(pt, epsilon);
    }

    /**
     * @param {*|!Plane} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Triangle &&
            this.a.isEqualTo(other.a) &&
            this.b.isEqualTo(other.b) &&
            this.c.isEqualTo(other.c);
    }

    /**
     * @param {*|!Plane} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        return other instanceof Triangle &&
            this.a.isApproximatelyEqualTo(other.a, epsilon) &&
            this.b.isApproximatelyEqualTo(other.b, epsilon) &&
            this.c.isApproximatelyEqualTo(other.c, epsilon);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `Triangle(${this.a}, ${this.b}, ${this.c})`;
    }
}

export {Triangle}
