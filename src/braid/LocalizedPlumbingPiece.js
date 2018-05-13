import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {codeDistanceUnitCellSize} from "src/braid/CodeDistance.js";
import {DetailedError} from "src/base/DetailedError.js";
import {UnitCellSocket} from "src/braid/UnitCellSocket.js";
import {PlumbingPiece} from "src/braid/PlumbingPiece.js";
import {Rect} from "src/geo/Rect.js";

const EXTENSION_LENGTH = 0.2;

class LocalizedPlumbingPiece {
    /**
     * @param {!Point} loc Which unit cell is it in?
     * @param {!UnitCellSocket} socket Which socket is it in?
     * @param {!PlumbingPiece} piece What's in the socket?
     */
    constructor(loc, socket, piece) {
        if (!(loc instanceof Point)) {
            throw new DetailedError("Not a Point.", {loc});
        }
        if (!(socket instanceof UnitCellSocket)) {
            throw new DetailedError("Not a UnitCellSocket.", {socket});
        }
        if (!(piece instanceof PlumbingPiece)) {
            throw new DetailedError("Not a PlumbingPiece.", {piece});
        }
        this.loc = loc;
        this.socket = socket;
        this.piece = piece;
    }

    /**
     * @returns {!Box}
     */
    toBox() {
        return this.socket.boxAt(this.loc);
    }

    /**
     * @param {!Vector} dirFrom The direction from the other piece to this neighbor piece.
     * @returns {!Box}
     */
    toNeighborExtensionBox(dirFrom) {
        return clampBox(this.socket.boxAt(this.loc), dirFrom.scaledBy(-1), EXTENSION_LENGTH);
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
     * @returns {!string}
     */
    key() {
        return `${this.loc}:${this.socket.name}:${this.piece.name}`;
    }

    /**
     * @param {![!number, !number, !number, !number]} highlight
     * @returns {!RenderData}
     */
    toRenderData(highlight = undefined) {
        let c = [...this.piece.color];
        if (highlight !== undefined) {
            for (let i = 0; i < 4; i++) {
                c[i] = 0.7 * c[i] + highlight[i] * 0.3;
            }
        }
        return this.toBox().toRenderData(c, this.piece.textureRect);
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

/**
 * @param {!Box} box The box to clamp.
 * @param {!Vector} shrinkAlong An axis-aligned unit vector indicating which axis to affect and which side to move.
 * @param {!number} maxDiameter
 * @returns {!Box}
 */
function clampBox(box, shrinkAlong, maxDiameter) {
    let delta = box.diagonal.zip(shrinkAlong, (e, s)  => Math.abs(s) * (e - Math.min(maxDiameter, e)));
    return shrinkBox(box, shrinkAlong, delta.x + delta.y + delta.z);
}

/**
 * @param {!Box} box The box to clamp.
 * @param {!Vector} shrinkAlong An axis-aligned unit vector indicating which axis to affect and which side to move.
 * @param {!number} delta The amount to shrink the box by.
 * @returns {!Box}
 */
function shrinkBox(box, shrinkAlong, delta) {
    let shift = shrinkAlong.pointwise(e => Math.abs(e) * delta);
    let baseMask = shrinkAlong.pointwise(e => e === 1 ? 1 : 0);
    let baseShift = baseMask.pointwiseMultiply(shift);
    return new Box(
        box.baseCorner.plus(baseShift),
        box.diagonal.minus(shift));
}

export {LocalizedPlumbingPiece, shrinkBox, clampBox}
