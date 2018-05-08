import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {GeneralMap} from "src/base/GeneralMap.js";


class UnitCellSocket {
    /**
     * @param {!string} name
     * @param {!Box} box
     * @param {!function(codeDistance: !int) : !UnitCellSocketFootprint} footprint
     * @param {!function(codeDistance: !int, fixupLayer: !FixupLayer, dx: !int, dy: !int)} propagateSignals
     */
    constructor(name, box, footprint, propagateSignals) {
        this.name = name;
        this.box = box;
        this.footprint = footprint;
        this.propagateSignals = propagateSignals;
        /** @type {!GeneralMap.<!Vector, !UnitCellSocketNeighbor>} */
        this.neighbors = new GeneralMap();
        /** @type {!Array.<UnitCellSocketNeighbor>} */
        this.impliedNeighbors = [];
    }

    /**
     * @param {!Point} offset
     * @returns {!Box}
     */
    boxAt(offset) {
        return new Box(this.box.baseCorner.plus(offset.asVector()), this.box.diagonal);
    }

    toString() {
        return `UnitCellSocket(${this.name})`;
    }
}

export {UnitCellSocket}