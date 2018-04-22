class Axis {
    /**
     * @param {!boolean} x_instead_of_z
     */
    constructor(x_instead_of_z) {
        this._x_instead_of_z = x_instead_of_z;
    }

    /**
     * @returns {!Axis}
     */
    opposite() {
        return new Axis(!this._x_instead_of_z);
    }

    /**
     * @returns {!boolean}
     */
    is_x() {
        return this._x_instead_of_z;
    }

    /**
     * @returns {!boolean}
     */
    is_z() {
        return !this._x_instead_of_z;
    }

    /**
     * @param {!Axis|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Axis && this._x_instead_of_z === other._x_instead_of_z;
    }

    /**
     * @returns {!string}
     */
    toString() {
        return this._x_instead_of_z ? 'X axis' : 'Z axis';
    }
}

Axis.X = new Axis(true);
Axis.Z = new Axis(false);

export {Axis}
