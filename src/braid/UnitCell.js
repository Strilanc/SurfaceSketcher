import {equate_Sets} from "src/base/Equate.js"

class UnitCell {
    /**
     * @param {!Set.<!string>} piece_names
     */
    constructor(piece_names = new Set()) {
        this.piece_names = piece_names;
    }

    /**
     * @returns {!UnitCell}
     */
    clone() {
        return new UnitCell(new Set(this.piece_names));
    }

    /**
     * @param {!UnitCell|*} other
     * @returns {boolean}
     */
    isEqualTo(other) {
        return other instanceof UnitCell && equate_Sets(this.piece_names, other.piece_names);
    }
}

export {UnitCell}
