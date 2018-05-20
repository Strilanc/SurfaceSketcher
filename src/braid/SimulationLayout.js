import {XY} from "src/sim/util/XY.js";


class SimulationLayout {
    /**
     * @param {!int} minX
     * @param {!int} maxX
     * @param {!int} minY
     * @param {!int} maxY
     * @param {!int} minT
     * @param {!int} maxT
     */
    constructor(minX, maxX, minY, maxY, minT, maxT) {
        this.minX = minX;
        this.maxX = maxX;
        this.minY = minY;
        this.maxY = maxY;
        this.minT = minT;
        this.maxT = maxT;
    }

    /**
     * @param {!XY} xy
     * @returns {!XY}
     */
    locToQubit(xy) {
        return xy.offsetBy(-this.minX, -this.minY);
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_data(xy) {
        return this.is_x_col(xy.x) !== this.is_x_row(xy.y);
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_x(xy) {
        return this.is_x_col(xy.x) && this.is_x_row(xy.y);
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    is_z(xy) {
        return this.is_z_col(xy.x) && this.is_z_row(xy.y);
    }

    /**
     * @param {!int} col
     * @returns {!boolean}
     */
    is_z_col(col) {
        return (col & 1) === 0;
    }

    /**
     * @param {!int} col
     * @returns {!boolean}
     */
    is_x_col(col) {
        return !this.is_z_col(col);
    }

    /**
     * @param {!int} row
     * @returns {!boolean}
     */
    is_z_row(row) {
        return (row & 1) === 0;
    }

    /**
     * @param {!int} row
     * @returns {!boolean}
     */
    is_x_row(row) {
        return !this.is_z_row(row);
    }

    /**
     * @param {!XY} xy
     * @returns {![!XY, !XY, !XY, !XY]}
     */
    neighbors(xy) {
        return xy.neighbors();
    }
}

export {SimulationLayout}
