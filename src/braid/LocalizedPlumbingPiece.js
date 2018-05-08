import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {codeDistanceUnitCellSize} from "src/braid/CodeDistance.js";
import {DetailedError} from "src/base/DetailedError.js";
import {UnitCellSocket} from "src/braid/UnitCellSocket.js";
import {PlumbingPiece} from "src/braid/PlumbingPiece.js";

const EXTENDER_SCALE_FACTOR = 0.3;

class LocalizedPlumbingPiece {
    /**
     * @param {!Point} loc Which unit cell is it in?
     * @param {!UnitCellSocket} socket Which socket is it in?
     * @param {!PlumbingPiece} piece What's in the socket?
     * @param {undefined|!Vector} extenderOffset If this piece is an extension of another piece (e.g. used when
     *     hinting where pieces can be added) this vector is the displacement from the root piece to this
     *     extender piece.
     */
    constructor(loc, socket, piece, extenderOffset=undefined) {
        if (!(loc instanceof Point)) {
            throw new DetailedError("Not a Point.", {loc});
        }
        if (!(socket instanceof UnitCellSocket)) {
            throw new DetailedError("Not a UnitCellSocket.", {socket});
        }
        if (!(piece instanceof PlumbingPiece)) {
            throw new DetailedError("Not a PlumbingPiece.", {piece});
        }
        this.loc= loc;
        this.socket = socket;
        this.piece = piece;
        this.extenderOffset = extenderOffset;
    }

    /**
     * @returns {!Box}
     */
    toBox(reduceExtenderSize=false) {
        let box = this.socket.boxAt(this.loc);
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
     * @param {!int} codeDistance
     * @returns {!UnitCellSocketFootprint}
     */
    toFootprint(codeDistance) {
        let {w, h} = codeDistanceUnitCellSize(codeDistance);
        return this.socket.footprint(codeDistance).offsetBy(w * this.loc.x, h * this.loc.z);
    }

    /**
     * @param {!int} codeDistance
     * @param {!FixupLayer} fixupLayer
     */
    doSignalPropagation(codeDistance, fixupLayer) {
        let {w, h} = codeDistanceUnitCellSize(codeDistance);
        this.socket.propagateSignals(codeDistance, fixupLayer, w * this.loc.x, h * this.loc.z);
    }

    /**
     * @returns {!string}
     */
    key() {
        return `${this.loc}:${this.socket.name}:${this.piece.name}`;
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
            colorOverride = this.piece.color;
        }
        return this.toBox().toRenderData(colorOverride);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `${this.loc}, ${this.socket.name}, ${this.piece.name}`;
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
