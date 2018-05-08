import {DetailedError} from 'src/base/DetailedError.js'
import {GeneralMap} from 'src/base/GeneralMap.js'
import {GeneralSet} from 'src/base/GeneralSet.js'
import {UnitCell} from 'src/braid/UnitCell.js'
import {Point} from "src/geo/Point.js";
import {Ray} from "src/geo/Ray.js";
import {Sockets} from "src/braid/Sockets.js";
import {LocalizedPlumbingPiece} from "src/braid/LocalizedPlumbingPiece.js";

class UnitCellMap {
    /**
     * @param {!GeneralMap.<!Point, !UnitCell>} cells
     */
    constructor(cells = new GeneralMap()) {
        this.cells = cells;
    }

    /**
     * @param {!Point} pt
     * @param {!boolean} do_not_modify
     * @returns {!UnitCell}
     */
    cell(pt, do_not_modify=false) {
        let result = this.cells.get(pt);
        if (result === undefined) {
            result = new UnitCell();
            if (!do_not_modify) {
                this.cells.set(pt, result);
            }
        }
        return result;
    }

    /**
     * @returns {!Array.<!LocalizedPlumbingPiece>}
     */
    _piecesAndImpliedPiecesWithPotentialRepeats() {
        let pieces = [];
        for (let [offset, val] of this.cells.entries()) {
            for (let socket of Sockets.All) {
                let pp = val.pieces.get(socket);
                if (pp === undefined) {
                    continue;
                }
                pieces.push(new LocalizedPlumbingPiece(offset, socket, pp));
                // for (let imp of socket.implies) {
                //     pieces.push(new LocalizedPlumbingPiece(
                //         Sockets.ByName.get(imp.name),
                //         offset.plus(imp.offset)));
                // }
            }
        }
        return pieces;
    }

    /**
     * @param {!Set.<!string>} seen
     * @param {!Array.<!LocalizedPlumbingPiece>} pieces
     * @returns {!Array.<!LocalizedPlumbingPiece>}
     */
    static _removeDuplicatePieces(pieces, seen = new Set()) {
        let result = [];
        for (let piece of pieces) {
            let key = piece.key();
            if (seen.has(key)) {
                continue;
            }
            if (piece.extenderOffset !== undefined) {
                key += ':' + piece.extenderOffset.toString();
            }
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            result.push(piece);
        }
        return result;
    }

    /**
     * @returns {!Array.<!LocalizedPlumbingPiece>}
     */
    piecesAndImpliedPieces() {
        return UnitCellMap._removeDuplicatePieces(this._piecesAndImpliedPiecesWithPotentialRepeats());
    }

    /**
     * @returns {!Array.<!LocalizedPlumbingPiece>}
     */
    piecesAndImpliedPiecesAndExtenderPieces() {
        let pieces = this.piecesAndImpliedPieces();
        let extras = [];
        // for (let piece of pieces) {
        //     if (!piece.socket.onlyImplied) {
        //         continue;
        //     }
        //     for (let ex of Sockets.all) {
        //         for (let imp of ex.implies) {
        //             if (imp.name === piece.plumbingPiece.name) {
        //                 let newCell = piece.cell.plus(imp.offset.scaledBy(-1));
        //                 let impliedPos = piece.plumbingPiece.boxAt(piece.cell).center();
        //                 let extendedPos = ex.boxAt(newCell).center();
        //                 extras.push(new LocalizedPlumbingPiece(
        //                     ex,
        //                     newCell,
        //                     extendedPos.minus(impliedPos)));
        //             }
        //         }
        //     }
        // }
        pieces.push(...extras);
        return UnitCellMap._removeDuplicatePieces(pieces);
    }

    /**
     * @returns {!Array.<!RenderData>}
     */
    renderData() {
        return this.piecesAndImpliedPieces().map(e => e.toRenderData());
    }

    /**
     * @param {!Ray} ray
     * @returns {!{collisionPoint: !Point, piece: !LocalizedPlumbingPiece}}
     */
    intersect(ray) {
        let bestPiece = undefined;
        let bestPt = undefined;
        for (let piece of this.piecesAndImpliedPiecesAndExtenderPieces()) {
            let pt = ray.intersectBox(piece.toBox(true), 0.001);
            if (pt !== undefined) {
                if (bestPt === undefined || ray.firstPoint([bestPt, pt]) === pt) {
                    bestPiece = piece;
                    bestPt = pt;
                }
            }
        }
        if (bestPiece === undefined) {
            return undefined;
        }
        return {
            piece: bestPiece,
            collisionPoint: bestPt
        };
    }

    /**
     * @returns {!UnitCellMap}
     */
    clone() {
        let cells = new GeneralMap();
        for (let [key, val] of this.cells.entries()) {
            cells.set(key, val.clone());
        }
        return new UnitCellMap(cells);
    }

    /**
     * @param {!UnitCellMap|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (!(other instanceof UnitCellMap)) {
            return false;
        }
        for (let k of [...this.cells.keys(), ...other.cells.keys()]) {
            if (!this.cell(k, true).isEqualTo(other.cell(k, true))) {
                return false;
            }
        }
        return true;
    }
}

export {UnitCellMap}
