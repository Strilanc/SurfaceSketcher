import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";

const EXTENDER_SCALE_FACTOR = 0.3;

class LocalizedPlumbingPiece {
    /**
     * @param {!PlumbingPiece} plumbingPiece
     * @param {!Point} cell
     * @param {undefined|!Vector} extenderOffset
     */
    constructor(plumbingPiece, cell, extenderOffset=undefined) {
        this.plumbingPiece = plumbingPiece;
        this.cell = cell;
        this.extenderOffset = extenderOffset;
    }

    /**
     * @returns {!Box}
     */
    toBox(reduceExtenderSize=false) {
        let box = this.plumbingPiece.boxAt(this.cell);
        if (reduceExtenderSize && this.extenderOffset !== undefined) {
            let ux = approximate_sign(this.extenderOffset.x);
            let uy = approximate_sign(this.extenderOffset.y);
            let uz = approximate_sign(this.extenderOffset.z);
            let v1 = new Vector(ux === -1 ? 1 : 0, uy === -1 ? 1 : 0, uz === -1 ? 1 : 0);
            let v2 = new Vector(ux === 0 ? 1 : EXTENDER_SCALE_FACTOR,
                uy === 0 ? 1 : EXTENDER_SCALE_FACTOR,
                uz === 0 ? 1 : EXTENDER_SCALE_FACTOR);
            box.baseCorner = box.baseCorner.plus(
                box.diagonal.pointwiseMultiply(v1.scaledBy(1 - EXTENDER_SCALE_FACTOR)));
            box.diagonal = box.diagonal.pointwiseMultiply(v2);
        }
        return box;
    }

    /**
     * @returns {!string}
     */
    key() {
        return `${this.cell}:${this.plumbingPiece.name}`;
    }

    /**
     * @param {![!number, !number, !number, !number]} colorOverride
     * @returns {!RenderData}
     */
    toRenderData(colorOverride = undefined) {
        if (this.extenderOffset !== undefined) {
            colorOverride = [0, 1, 0, 1];
        }
        if (colorOverride === undefined) {
            colorOverride = this.plumbingPiece.color;
        }
        return this.toBox().toRenderData(colorOverride);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `${this.plumbingPiece} @ ${this.cell}${this.extenderOffset === undefined ? '' : ' (extended)'}`;
    }
}

/**
 * @param {!number} v
 * @param {!number} epsilon
 * @returns {!int}
 */
function approximate_sign(v, epsilon=0.001) {
    if (Math.abs(v) < epsilon) {
        return 0;
    }
    return Math.sign(v);
}

export {LocalizedPlumbingPiece}
