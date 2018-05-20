/**
 * Helper types and methods for making plumbing pieces that have Horizontal-vs-Vertical and Primal-vs-Dual symmetry.
 */

import {Sockets} from "src/braid/Sockets.js";
import {Config} from "src/Config.js";
import {Vector} from "src/geo/Vector.js";
import {PlumbingPiece} from "src/braid/PlumbingPiece.js";

/**
 * A helper class used when making plumbing pieces that have Horizontal-vs-Vertical and Primal-vs-Dual symmetry.
 */
class FlatPieceType {
    /**
     * @param {!boolean} dual
     * @param {!boolean} horizontal
     */
    constructor(dual, horizontal) {
        this.dual = dual;
        this.horizontal = horizontal;
    }

    /**
     * @returns {!Array.<!FlatPieceType>}
     */
    static all() {
        return [
            new FlatPieceType(false, false),
            new FlatPieceType(false, true),
            new FlatPieceType(true, false),
            new FlatPieceType(true, true),
        ];
    }

    /**
     * @returns {!Vector}
     */
    dir() {
        return this.horizontal ? new Vector(1, 0, 0) : new Vector(0, 0, 1);
    }

    /**
     * @returns {!string}
     */
    namePrefix() {
        return (this.horizontal ? 'X' : 'Z') + (this.dual ? 'Dual' : 'Primal');

    }

    /**
     * @returns {!UnitCellSocket}
     */
    socket() {
        if (this.horizontal) {
            return this.dual ? Sockets.XDual : Sockets.XPrimal
        }
        return this.dual ? Sockets.ZDual : Sockets.ZPrimal;
    }

    /**
     * @returns {![!number, !number, !number, !number]}
     */
    braidColor() {
        return this.dual ? Config.BRAIDING_DUAL_COLOR : Config.BRAIDING_PRIMAL_COLOR;
    }
}

/**
 * Creates a group of four plumbing pieces, one for each choice of H-vs-V and Primal-vs-Dual.
 *
 * @param {!string} nameSuffix
 * @param {undefined|!function(!FlatPieceType) : undefined|!function(
 *      !LocalizedPlumbingPiece, !SimulationResults) : !Array.<!RenderData>} customRenderMaker
 * @param {undefined | !function(!FlatPieceType) : undefined|!function(!LocalizedPlumbingPiece,
 *                             !SimulationLayout,
 *                             codeDistance: !int,
 *                             id: !int) : !function(
 *      !Surface,
 *      !GeneralMap.<!Point, !GeneralMap.<!UnitCellSocket, !string>>)} customSimulationWorkMaker
 * @returns {!{
 *      ZPrimal: !PlumbingPiece,
 *      XPrimal: !PlumbingPiece,
 *      ZDual: !PlumbingPiece,
 *      XDual: !PlumbingPiece,
 *      All: !Array.<!PlumbingPiece>
 * }}
 */
function makeFlatGroup(nameSuffix, customRenderMaker, customSimulationWorkMaker) {
    if (customRenderMaker === undefined) {
        customRenderMaker = () => undefined;
    }
    if (customSimulationWorkMaker === undefined) {
        customSimulationWorkMaker = () => undefined;
    }

    let result = [];
    for (let type of FlatPieceType.all()) {
        let texRect = undefined;
        let customPropagate = undefined;

        result.push(new PlumbingPiece(
            type.namePrefix() + nameSuffix,
            type.socket(),
            type.braidColor(),
            texRect,
            customRenderMaker(type),
            undefined,
            customPropagate,
            customSimulationWorkMaker(type)));
    }
    return {
        ZPrimal: result[0],
        XPrimal: result[1],
        ZDual: result[2],
        XDual: result[3],
        All: result
    };
}

export {FlatPieceType, makeFlatGroup}
