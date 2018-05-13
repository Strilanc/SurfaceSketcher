import {equate} from "src/base/Equate.js";

class PlumbingPiece {
    /**
     * @param {!string} name
     * @param {!UnitCellSocket} socket
     * @param {![!number, !number, !number, !number]} color
     * @param {undefined|!Rect} textureRect
     * @param {undefined|!function(
     *      !LocalizedPlumbingPiece, !SimulationResults) : !Array.<!RenderData>} customToRenderData
     * @param {undefined|!function(
     *      !LocalizedPlumbingPiece, codeDistance: !int) : !UnitCellSocketFootprint} customFootprint
     * @param {undefined|!function(
     *      tileStack: !TileStack, !LocalizedPlumbingPiece, codeDistance: !int)} customPropagateSignal
     */
    constructor(name,
                socket,
                color,
                textureRect=undefined,
                customToRenderData=undefined,
                customFootprint=undefined,
                customPropagateSignal=undefined) {
        this.name = name;
        this.socket = socket;
        this.color = color;
        this.textureRect = textureRect;
        this.customToRenderData = customToRenderData;
        this.customFootprint = customFootprint;
        this.customPropagateSignal = customPropagateSignal;
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
            this.customToRenderData === other.customToRenderData &&
            this.customFootprint === other.customFootprint &&
            this.customPropagateSignal === other.customPropagateSignal;
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
     * @param {!LocalizedPlumbingPiece} localizedPiece
     * @param {!int} codeDistance
     * @returns {!UnitCellSocketFootprint}
     */
    toLocalizedFootprint(localizedPiece, codeDistance) {
        if (this.customFootprint !== undefined) {
            return this.customFootprint(localizedPiece, codeDistance);
        } else {
            return localizedPiece.toFootprint(codeDistance);
        }
    }

    /**
     * @param {!TileStack} tileStack
     * @param {!LocalizedPlumbingPiece} localizedPiece
     * @param {!int} codeDistance
     */
    propagateSignal(tileStack, localizedPiece, codeDistance) {
        if (this.customPropagateSignal !== undefined) {
            this.customPropagateSignal(tileStack, localizedPiece, codeDistance);
        }
    }

    /**
     * @returns {!PlumbingPiece}
     */
    clone() {
        return new PlumbingPiece(
            this.name,
            this.socket,
            this.color,
            this.textureRect,
            this.customToRenderData,
            this.customFootprint,
            this.customPropagateSignal);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `PlumbingPiece(${this.name}, ${this.socket})`;
    }
}

export {PlumbingPiece}
