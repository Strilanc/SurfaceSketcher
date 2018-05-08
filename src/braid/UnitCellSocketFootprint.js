import {seq} from "src/base/Seq.js";
import {gridRangeToString} from "src/sim/util/Util.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {XY} from "src/sim/util/XY.js";

class UnitCellSocketFootprint {
    /**
     * @param {!GeneralSet.<!XY>} mask
     */
    constructor(mask) {
        this.mask = mask;
    }

    /**
     * @param {!int} x
     * @param {!int} y
     * @param {!int} w
     * @param {!int} h
     * @returns {!UnitCellSocketFootprint}
     */
    static grid(x, y, w, h) {
        let mask = new GeneralSet();
        for (let i = 0; i < w; i++) {
            for (let j = 0; j < h; j++) {
                mask.add(new XY(x + i, y + j));
            }
        }
        return new UnitCellSocketFootprint(mask);
    }

    /**
     * @param {!int} dx
     * @param {!int} dy
     * @returns {!UnitCellSocketFootprint}
     */
    offsetBy(dx, dy) {
        return new UnitCellSocketFootprint(new GeneralSet(
            ...seq(this.mask).map(({x, y}) => new XY(x + dx, y + dy))));
    }

    toString() {
        let minX = seq(this.mask).map(e => e.x).min(0);
        let maxX = seq(this.mask).map(e => e.x).max(0);
        let minY = seq(this.mask).map(e => e.y).min(0);
        let maxY = seq(this.mask).map(e => e.y).max(0);
        let func = (row, col) => this.mask.has(new XY(col, row)) ? '#' : ' ';
        let content = gridRangeToString(minY, maxY, minX, maxX, func);
        return `PlumbingPieceFootprint(offsetX=${minX}, offsetY=${minY}, mask=\n    ${content}\n)`;
    }
}

export {UnitCellSocketFootprint}
