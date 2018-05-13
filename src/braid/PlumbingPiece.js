import {equate} from "src/base/Equate.js";

class PlumbingPiece {
    /**
     * @param {!string} name
     * @param {!UnitCellSocket} socket
     * @param {![!number, !number, !number, !number]} color
     * @param {undefined|!Rect} textureRect
     */
    constructor(name, socket, color, textureRect=undefined) {
        this.name = name;
        this.socket = socket;
        this.color = color;
        this.textureRect = textureRect;
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof PlumbingPiece &&
            this.name === other.name &&
            this.color === other.color &&
            this.socket === other.socket &&
            equate(this.textureRect, other.textureRect);
    }

    /**
     * @returns {!PlumbingPiece}
     */
    clone() {
        return new PlumbingPiece(this.name, this.socket, this.color, this.textureRect);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `PlumbingPiece(${this.name}, ${this.socket})`;
    }
}

export {PlumbingPiece}
