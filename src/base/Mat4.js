import {DetailedError} from "src/base/DetailedError.js"

class Mat4 {
    /**
     * @param {!Float32Array} buf
     */
    constructor(buf) {
        this.raw = buf;
    }

    static zero() {
        return new Mat4(new Float32Array(16));
    }

    static identity() {
        let result = Mat4.zero();
        result.raw[0] = 1;
        result.raw[5] = 1;
        result.raw[10] = 1;
        result.raw[15] = 1;
        return result;
    }

    clone() {
        return new Mat4(this.raw);
    }

    /**
     * @param {!number} x
     * @param {!number} y
     * @param {!number} z
     * @returns {!Mat4}
     */
    inline_translate(x, y, z) {
        let b = this.raw;
        b[12] += b[0] * x + b[4] * y + b[8] * z;
        b[13] += b[1] * x + b[5] * y + b[9] * z + b[13];
        b[14] += b[2] * x + b[6] * y + b[10] * z;
        b[15] += b[3] * x + b[7] * y + b[11] * z;
        return this;
    }

    /**
     * @param {!float} x
     * @param {!float} y
     * @param {!float} z
     * @returns {!Mat4}
     */
    translate(x, y, z) {
        return this.clone().inline_translate(x, y, z);
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
        return new Mat4(new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) * nf, -1,
            0, 0, 2 * far * near * nf, 0]));
    }

    static generate(cellValueFunc) {
        let result = Mat4.zero();
        for (let row = 0; row < 4; row++) {
            for (let col = 0; col < 4; col++) {
                result.raw[col + row * 4] = cellValueFunc(col, row);
            }
        }
        return result;
    }

    getCell(col, row) {
        return this.raw[col + row * 4];
    }

    /**
     * @param {!Mat4} other
     * @returns {!Mat4} out
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
     * @param {!Mat4} other
     * @returns {!Mat4}
     */
    inline_times(other) {
        this.raw = this.times(other).raw;
        return this;
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
     * @param {!number} angle rotation angle in radians
     * @param {![!number, !number, !number]} axis rotation axis
     * @returns {!Mat4}
     */
    inline_rotate(angle, axis) {
        this.inline_times(Mat4.rotation(angle, axis));
        return this;
    }
}

export {Mat4}
