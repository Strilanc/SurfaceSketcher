import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";


class UnitCellSocket {
    /**
     * @param {!string} name
     * @param {!Box} box
     * @param {!function(codeDistance: !int) : !UnitCellSocketFootprint} footprint
     * @param {!function(codeDistance: !int, fixupLayer: !FixupLayer, dx: !int, dy: !int)} propagateSignals
     * @param {![!number, !number, !number, !number]} color
     * @param {Array.<!{name: !string, offset: !Vector}>} implies
     * @param {!boolean} onlyImplied
     * @param {!Array.<!PlumbingPiece>} variants
     */
    constructor(name, box, footprint, propagateSignals, color, implies, onlyImplied, variants) {
        this.name = name;
        this.box = box;
        this.footprint = footprint;
        this.propagateSignals = propagateSignals;
        this.color = color;
        this.implies = implies;
        this.onlyImplied = onlyImplied;
        this.variants = variants;
    }

    /**
     * @param {!Point} offset
     * @returns {!Box}
     */
    boxAt(offset) {
        return new Box(this.box.baseCorner.plus(offset.asVector()), this.box.diagonal);
    }

    toString() {
        return `PlumbingPiece(${this.name})`;
    }
}

export {UnitCellSocket}
