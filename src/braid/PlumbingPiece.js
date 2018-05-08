class PlumbingPiece {
    /**
     * @param {!string} name
     * @param {!UnitCellSocket} socket
     * @param {![!number, !number, !number, !number]} color
     */
    constructor(name, socket, color) {
        this.name = name;
        this.socket = socket;
        this.color = color;
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof PlumbingPiece &&
            this.name === other.name &&
            this.color === other.color &&
            this.socket === other.socket;
    }

    /**
     * @returns {!PlumbingPiece}
     */
    clone() {
        return new PlumbingPiece(this.name, this.socket, this.color);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `PlumbingPiece(${this.name}, ${this.socket})`;
    }
}

export {PlumbingPiece}
