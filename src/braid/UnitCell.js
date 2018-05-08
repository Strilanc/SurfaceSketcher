import {GeneralMap} from "src/base/GeneralMap.js";


class UnitCell {
    /**
     * @param {!GeneralMap.<!UnitCellSocket, !PlumbingPiece>} pieces
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

export {UnitCell}
