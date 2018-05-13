import {equate} from "src/base/Equate.js";

class PlumbingPiece {
    /**
     * @param {!string} name
     * @param {!UnitCellSocket} socket
     * @param {![!number, !number, !number, !number]} color
     * @param {undefined|!Rect} textureRect
     * @param {undefined|!function(
     *      !LocalizedPlumbingPiece, !SimulationResults) : !Array.<!RenderData>} customToRenderData
     */
    constructor(name, socket, color, textureRect=undefined, customToRenderData=undefined) {
        this.name = name;
        this.socket = socket;
        this.color = color;
        this.textureRect = textureRect;
        this.customToRenderData = customToRenderData;
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
            equate(this.textureRect, other.textureRect) &&
            this.customToRenderData === other.customToRenderData;
    }

    /**
     *
     * @param {!LocalizedPlumbingPiece} localizedPiece
     * @param {!SimulationResults} simulationResults
     * @returns {!Array.<!RenderData>}
     */
    toLocalizedRenderData(localizedPiece, simulationResults) {
        if (this.customToRenderData !== undefined) {
            return this.customToRenderData(localizedPiece, simulationResults);
        } else {
            return [localizedPiece.toRenderData(undefined)];
        }
    }

    /**
     * @returns {!PlumbingPiece}
     */
    clone() {
        return new PlumbingPiece(this.name, this.socket, this.color, this.textureRect, this.customToRenderData);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `PlumbingPiece(${this.name}, ${this.socket})`;
    }
}

export {PlumbingPiece}
