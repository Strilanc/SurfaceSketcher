import {GeneralMap} from "src/base/GeneralMap.js";

class PlumbingPieceData {
    /**
     * @param {undefined|!string} variant
     */
    constructor(variant=undefined) {
        this.variant = variant;
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof PlumbingPieceData && this.variant === other.variant;
    }

    /**
     * @returns {!PlumbingPieceData}
     */
    clone() {
        return new PlumbingPieceData(this.variant);
    }
}


class UnitCell {
    /**
     * @param {!GeneralMap.<!PlumbingPiece, !PlumbingPieceData>} pieces
     */
    constructor(pieces = new GeneralMap()) {
        this.pieces = pieces;
    }

    /**
     * @returns {!UnitCell}
     */
    clone() {
        return new UnitCell(this.pieces.mapValues(e => e.clone()));
    }

    /**
     * @param {!UnitCell|*} other
     * @returns {boolean}
     */
    isEqualTo(other) {
        return other instanceof UnitCell && this.pieces.isEqualTo(other.pieces);
    }
}

export {UnitCell, PlumbingPieceData}
