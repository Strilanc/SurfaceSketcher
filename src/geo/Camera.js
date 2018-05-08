import {Mat4} from "src/base/Mat4.js";
import {Point} from "src/geo/Point.js";
import {Vector} from "src/geo/Vector.js";
import {Ray} from "src/geo/Ray.js";
import {float32ToBytes, bytesToFloat32} from "src/base/Util.js";

class Camera {
    /**
     * @param {!Point} focus_point
     * @param {!number} distance
     * @param {!number} yaw
     * @param {!number} pitch
     */
    constructor(focus_point, distance, yaw, pitch) {
        this.focus_point = focus_point;
        this.distance = distance;
        this.yaw = yaw;
        this.pitch = pitch;
    }

    /**
     * @returns {!Camera}
     */
    clone() {
        return new Camera(this.focus_point.clone(), this.distance, this.yaw, this.pitch);
    }

    /**
     * @returns {!Point}
     */
    cameraPosition() {
        return this.focus_point.plus(this.direction().scaledBy(-this.distance));
    }

    /**
     * @returns {!Vector}
     */
    direction() {
        return this._yawMatrix().times(this._pitchMatrix()).transformVector(new Vector(0, 0, -1));
    }

    /**
     * @returns {!Mat4}
     * @private
     */
    _pitchMatrix() {
        return Mat4.rotation(this.pitch, [1, 0, 0]);
    }

    /**
     * @returns {!Mat4}
     * @private
     */
    _yawMatrix() {
        return Mat4.rotation(this.yaw, [0, 1, 0]);
    }

    /**
     * @returns {!Mat4}
     */
    rotationMatrix() {
        return this._yawMatrix().times(this._pitchMatrix());
    }

    /**
     * @param {!HTMLCanvasElement} canvas
     * @returns {!Mat4}
     */
    worldToScreenMatrix(canvas) {
        let perspective = Mat4.perspective(Math.PI/4, canvas.clientWidth/canvas.clientHeight, 0.1, 1000).transpose();
        let pitch = this._pitchMatrix().transpose();
        let yaw = this._yawMatrix().transpose();
        let {x, y, z} = this.cameraPosition();
        let shift = Mat4.translation(-x, -y, -z);
        return perspective.times(pitch).times(yaw).times(shift);
    }

    /**
     * @param {!HTMLCanvasElement} canvas
     * @returns {!Mat4}
     */
    screenToWorldMatrix(canvas) {
        let perspective = Mat4.inverse_perspective(
            Math.PI / 4, canvas.clientWidth / canvas.clientHeight, 0.1, 100).transpose();
        let pitch = this._pitchMatrix();
        let yaw = this._yawMatrix();
        let {x, y, z} = this.cameraPosition();
        let shift = Mat4.translation(x, y, z);
        return shift.times(yaw).times(pitch).times(perspective);
    }

    /**
     * @param {!HTMLCanvasElement} canvas
     * @param screen_x
     * @param screen_y
     * @returns {{yaw: !number, pitch: !number, ray: !Ray}}
     */
    screenPosToWorldRay(canvas, screen_x, screen_y) {
        let x = 2 * screen_x / canvas.clientWidth - 1;
        let y = 1 - 2 * screen_y / canvas.clientHeight;
        let q = this.screenToWorldMatrix(canvas).transformPoint(new Point(x, y, 1));
        let pos = this.cameraPosition();
        let d = q.minus(pos);
        let yaw = Math.atan2(d.x, d.z);
        let pitch = Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z));
        let ray = new Ray(pos, q.minus(pos));
        return {yaw, pitch, ray};
    }

    /**
     * @param {!Camera|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Camera &&
            this.focus_point.isEqualTo(other.focus_point) &&
            this.distance === other.distance &&
            this.yaw === other.yaw &&
            this.pitch === other.pitch;

    }

    /**
     * @param {!Writer} out
     */
    write(out) {
        this.focus_point.write(out);
        out.writeFloat64(this.distance);
        out.writeFloat64(this.yaw);
        out.writeFloat64(this.pitch);
    }

    /**
     * @param {!Reader} inp
     * @returns {!Camera}
     */
    static read(inp) {
        let focus = Point.read(inp);
        let distance = inp.readFloat64();
        let yaw = inp.readFloat64();
        let pitch = inp.readFloat64();
        return new Camera(focus, distance, yaw, pitch);
    }
}

export {Camera}
