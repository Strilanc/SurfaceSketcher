import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {Ray} from "src/geo/Ray.js";

const SMALL_DIAMETER = 0.2;
const LONG_DIAMETER = 0.8;

class UnitCell {
    constructor() {
        this.x_piece = false;
        this.y_piece = false;
        this.z_piece = false;
    }

    /**
     * @param {!int} xyz
     * @returns {!boolean}
     */
    xyz_piece(xyz) {
        switch (xyz) {
            case 0:
                return this.x_piece;
            case 1:
                return this.y_piece;
            case 2:
                return this.z_piece;
            default:
                throw new DetailedError("Bad xyz_piece", {xyz});
        }
    }

    /**
     * @param {!Point} cell_origin
     * @returns {!Box}
     */
    static x_box(cell_origin) {
        return new Box(
            cell_origin.plus(new Vector(SMALL_DIAMETER, 0, 0)),
            new Vector(LONG_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER));
    }

    /**
     * @param {!Point} cell_origin
     * @returns {!Box}
     */
    static y_box(cell_origin) {
        return new Box(
            cell_origin.plus(new Vector(0, SMALL_DIAMETER, 0)),
            new Vector(SMALL_DIAMETER, LONG_DIAMETER, SMALL_DIAMETER));
    }

    /**
     * @param {!Point} cell_origin
     * @returns {!Box}
     */
    static z_box(cell_origin) {
        return new Box(
            cell_origin.plus(new Vector(0, 0, SMALL_DIAMETER)),
            new Vector(SMALL_DIAMETER, SMALL_DIAMETER, LONG_DIAMETER));
    }

    /**
     * @param {!Point} cell_origin
     * @returns {!Box}
     */
    static center_box(cell_origin) {
        return new Box(cell_origin, new Vector(SMALL_DIAMETER, SMALL_DIAMETER, SMALL_DIAMETER));
    }

    /**
     * @param {!Point} cell_origin
     * @param {!int} xyz
     * @returns {!Box}
     */
    static xyz_box(cell_origin, xyz) {
        switch (xyz) {
            case 0:
                return this.x_box(cell_origin);
            case 1:
                return this.y_box(cell_origin);
            case 2:
                return this.z_box(cell_origin);
            default:
                throw new DetailedError("Bad xyz_box", {cell_origin, xyz});
        }
    }

    /**
     * @param {!int} xyz
     * @returns {!Vector}
     */
    static xyz_unit(xyz) {
        switch (xyz) {
            case 0:
                return new Vector(1, 0, 0);
            case 1:
                return new Vector(0, 1, 0);
            case 2:
                return new Vector(0, 0, 1);
            default:
                throw new DetailedError("Bad xyz_unit", {xyz});
        }
    }
}

class UnitCellMap {
    /**
     * @param {!Map.<!string, !UnitCell>} cells
     */
    constructor(cells = new Map()) {
        this.cells = cells;
    }

    /**
     * @param {!Point} pt
     * @returns {!UnitCell}
     */
    cell(pt) {
        let key = UnitCellMap._cellKey(pt);
        if (!this.cells.has(key)) {
            this.cells.set(key, new UnitCell());
        }
        return this.cells.get(key);
    }

    /**
     * @param {!Point} pt
     * @returns {!string}
     * @private
     */
    static _cellKey(pt) {
        return `${pt.x},${pt.y},${pt.z}`;
    }

    /**
     * @param {!string} key
     * @returns {!Point}
     * @private
     */
    static _keyToCell(key) {
        let [x, y, z] = key.split(",");
        x = parseInt(x);
        y = parseInt(y);
        z = parseInt(z);
        return new Point(x, y, z);
    }

    /**
     * @returns {!Array.<!Box>}
     */
    boxes() {
        let result = [];
        let centers = new Set();
        for (let key of this.cells.keys()) {
            let offset = UnitCellMap._keyToCell(key);

            let val = this.cells.get(key);
            for (let d = 0; d < 3; d++) {
                if (val.xyz_piece(d)) {
                    result.push(UnitCell.xyz_box(offset, d));
                    centers.add(key);
                    let u = offset.plus(UnitCell.xyz_unit(d));
                    centers.add(`${u.x},${u.y},${u.z}`);
                }
            }
        }

        for (let key of centers) {
            let pt = UnitCellMap._keyToCell(key);
            result.push(UnitCell.center_box(pt));
        }

        return result;
    }

    /**
     * @param {!Ray} ray
     * @returns {!{collisionBox: !Box, collisionPoint: !Point}}
     */
    intersect(ray) {
        let bestBox = undefined;
        let bestPt = undefined;
        for (let box of this.boxes()) {
            let pt = ray.intersectBox(box, 0.001);
            if (pt !== undefined) {
                if (bestPt === undefined || ray.firstPoint([bestPt, pt]) === pt) {
                    bestBox = box;
                    bestPt = pt;
                }
            }
        }
        if (bestBox === undefined) {
            return undefined;
        }
        return {collisionBox: bestBox, collisionPoint: bestPt};
    }
}

export {UnitCell, UnitCellMap}
