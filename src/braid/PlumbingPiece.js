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
     *      tileStack: !TileStack, !LocalizedPlumbingPiece, codeDistance: !int)} customPropagateSignalEnter
     * @param {undefined|!function(
     *      tileStack: !TileStack, !LocalizedPlumbingPiece, codeDistance: !int)} customPropagateSignalExit
     */
    constructor(name,
                socket,
                color,
                textureRect=undefined,
                customToRenderData=undefined,
                customFootprint=undefined,
                customPropagateSignalEnter=undefined,
                customPropagateSignalExit=undefined) {
        this.name = name;
        this.socket = socket;
        this.color = color;
        this.textureRect = textureRect;
        this.customToRenderData = customToRenderData;
        this.customFootprint = customFootprint;
        this.customPropagateSignalEnter = customPropagateSignalEnter;
        this.customPropagateSignalExit = customPropagateSignalExit;
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
            this.customPropagateSignalEnter === other.customPropagateSignalEnter &&
            this.customPropagateSignalExit === other.customPropagateSignalExit;
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
    propagateSignalEnter(tileStack, localizedPiece, codeDistance) {
        if (this.customPropagateSignalEnter !== undefined) {
            this.customPropagateSignalEnter(tileStack, localizedPiece, codeDistance);
        }
    }

    /**
     * @param {!TileStack} tileStack
     * @param {!LocalizedPlumbingPiece} localizedPiece
     * @param {!int} codeDistance
     */
    propagateSignalExit(tileStack, localizedPiece, codeDistance) {
        if (this.customPropagateSignalExit !== undefined) {
            this.customPropagateSignalExit(tileStack, localizedPiece, codeDistance);
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
            this.customPropagateSignalEnter,
            this.customPropagateSignalExit);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `PlumbingPiece(${this.name}, ${this.socket})`;
    }
}

export {PlumbingPiece}
