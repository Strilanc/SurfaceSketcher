import {DetailedError} from "src/base/DetailedError.js"
import {Point} from "src/geo/Point.js";
import {Vector} from "src/geo/Vector.js";
import {indent} from "src/base/Util.js";

class Mat4 {
    /**
     * @param {!Float32Array} buf An array containing the elements of the matrix, column by column.
     */
    constructor(buf) {
        this.raw = buf;
    }

    /**
     * @returns {!Mat4}
     */
    static zero() {
        return new Mat4(new Float32Array(16));
    }

    /**
     * @returns {!Mat4}
     */
    static identity() {
        let result = Mat4.zero();
        result.raw[0] = 1;
        result.raw[5] = 1;
        result.raw[10] = 1;
        result.raw[15] = 1;
        return result;
    }

    /**
     * @returns {!Mat4}
     */
    clone() {
        return new Mat4(this.raw);
    }

    /**
     * @param {!number} x
     * @param {!number} y
     * @param {!number} z
     * @returns {!Mat4}
     */
    static translation(x, y, z) {
        let r = Mat4.identity();
        r.raw[3] = x;
        r.raw[7] = y;
        r.raw[11] = z;
        return r;
    }


    /**
     * @param {!number} sx
     * @param {!number} sy
     * @param {!number} sz
     * @returns {!Mat4}
     */
    static scaling(sx, sy, sz) {
        let r = Mat4.identity();
        r.raw[0] = sx;
        r.raw[5] = sy;
        r.raw[10] = sz;
        return r;
    }

    /**
     * @param {!number} fovy Vertical field of view in radians
     * @param {!number} aspect Aspect ratio. typically viewport width/height
     * @param {!number} near Near bound of the frustum
     * @param {!number} far Far bound of the frustum
     * @returns {!Mat4}
     */
    static perspective(fovy, aspect, near, far) {
        let f = 1.0 / Math.tan(fovy / 2);
        let nf = 1 / (near - far);
        let a = far * nf;
        let b = far * near * nf;
        return new Mat4(new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, a, -1,
            0, 0, b, 0]));
    }

    /**
     * @returns {!Mat4}
     */
    transpose() {
        return Mat4.generate((row, col) => this.getCell(col, row));
    }

    /**
     * @param {!number} fovy Vertical field of view in radians
     * @param {!number} aspect Aspect ratio. typically viewport width/height
     * @param {!number} near Near bound of the frustum
     * @param {!number} far Far bound of the frustum
     * @returns {!Mat4}
     */
    static inverse_perspective(fovy, aspect, near, far) {
        let f = 1.0 / Math.tan(fovy / 2);
        let nf = 1 / (near - far);
        let a = far * nf;
        let b = far * near * nf;
        return new Mat4(new Float32Array([
            aspect / f, 0, 0, 0,
            0, 1 / f, 0, 0,
            0, 0, 0, 1/b,
            0, 0, -1, a/b]));
    }

    /**
     * @param {!function(!int, !int) : !number} cellValueFunc
     * @returns {!Mat4}
     */
    static generate(cellValueFunc) {
        let result = Mat4.zero();
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                result.raw[col + row * 4] = cellValueFunc(row, col);
            }
        }
        return result;
    }

    /**
     * @param {!int} row
     * @param {!int} col
     * @returns {!number}
     */
    getCell(row, col) {
        return this.raw[col + row * 4];
    }

    /**
     * @param {!Mat4} other
     * @returns {!Mat4}
     */
    times(other) {
        return Mat4.generate((row, col) => {
            let t = 0;
            for (let k = 0; k < 4; k++) {
                t += this.getCell(row, k) * other.getCell(k, col);
            }
            return t;
        });
    }

    /**
     * @param {!Vector} vec
     * @returns {!Vector}
     */
    transformVector(vec) {
        let m = Mat4.zero();
        m.raw[0] = vec.x;
        m.raw[4] = vec.y;
        m.raw[8] = vec.z;
        let r = this.times(m);
        return new Vector(r.raw[0], r.raw[4], r.raw[8]);
    }

    /**
     * @param {!Point} pt
     * @returns {!Point}
     */
    transformPoint(pt) {
        let m = Mat4.zero();
        m.raw[0] = pt.x;
        m.raw[4] = pt.y;
        m.raw[8] = pt.z;
        m.raw[12] = 1;
        let r = this.times(m);
        let w = r.raw[12];
        return new Point(r.raw[0] / w, r.raw[4] / w, r.raw[8] / w);
    }

    /**
     * @param {!number} angle rotation angle in radians
     * @param {![!number, !number, !number]} axis rotation axis
     * @returns {!Mat4}
     */
    static rotation(angle, axis) {
        let [x, y, z] = axis;
        let n = Math.sqrt(x * x + y * y + z * z);
        if (n < 0.000001) {
            throw new DetailedError('Bad rotation axis.', {angle, axis});
        }

        x /= n;
        y /= n;
        z /= n;

        let s = Math.sin(angle);
        let c = Math.cos(angle);
        let t = 1 - c;

        let x0 = x * x * t + c;
        let x1 = y * x * t + z * s;
        let x2 = z * x * t - y * s;

        let y0 = x * y * t - z * s;
        let y1 = y * y * t + c;
        let y2 = z * y * t + x * s;

        let z0 = x * z * t + y * s;
        let z1 = y * z * t - x * s;
        let z2 = z * z * t + c;

        return new Mat4(new Float32Array([
            x0, x1, x2, 0,
            y0, y1, y2, 0,
            z0, z1, z2, 0,
            0, 0, 0, 1
        ]));
    }

    /**
     * @param {*|!Mat4} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (!(other instanceof Mat4)) {
            return false;
        }
        for (let i = 0; i < 16; i++) {
            if (this.raw[i] !== other.raw[i]) {
                return false;
            }
        }
        return true;
    }

    /**
     * @param {*|!Mat4} other
     * @param {!number} epsilon
     * @returns {!boolean}
     */
    isApproximatelyEqualTo(other, epsilon) {
        if (!(other instanceof Mat4)) {
            return false;
        }
        for (let i = 0; i < 16; i++) {
            if (Math.abs(this.raw[i] - other.raw[i]) > epsilon) {
                return false;
            }
        }
        return true;
    }

    /**
     * @returns {!string}
     */
    toString() {
        let rows = [];
        for (let row = 0; row < 4; row++) {
            let rowEntries = [];
            for (let col = 0; col < 4; col++) {
                rowEntries.push(this.getCell(row, col));
            }
            rows.push('{' + rowEntries.join(', ') + '}')
        }
        return `{\n${indent(rows.join('\n'))}\n}`;
    }
}

export {Mat4}
