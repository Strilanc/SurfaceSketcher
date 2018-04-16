import {DetailedError} from 'src/base/DetailedError.js'
import {Point} from "src/geo/Point.js";
import {Ray} from "src/geo/Ray.js";
import {PLUMBING_PIECE_MAP, ALL_PLUMBING_PIECES} from "src/PlumbingPieces.js";
import {LocalizedPlumbingPiece} from "src/LocalizedPlumbingPiece.js";

class UnitCell {
    /**
     * @param {!Set.<!string>} piece_names
     */
    constructor(piece_names = new Set()) {
        this.piece_names = piece_names;
    }
}

class UnitCellMap {
    /**
     * @param {!Map.<!string, !UnitCell>} cells
     */
    constructor(cells = new Map()) {
        this.cells = cells;
    }

    /**
     * @param {!Point} pt
     * @returns {!UnitCell}
     */
    cell(pt) {
        let key = UnitCellMap._cellKey(pt);
        if (!this.cells.has(key)) {
            this.cells.set(key, new UnitCell());
        }
        return this.cells.get(key);
    }

    /**
     * @param {!Point} pt
     * @returns {!string}
     * @private
     */
    static _cellKey(pt) {
        return `${pt.x},${pt.y},${pt.z}`;
    }

    /**
     * @param {!string} key
     * @returns {!Point}
     * @private
     */
    static _keyToCell(key) {
        let [x, y, z] = key.split(",");
        x = parseInt(x);
        y = parseInt(y);
        z = parseInt(z);
        return new Point(x, y, z);
    }

    /**
     * @returns {!Array.<!LocalizedPlumbingPiece>}
     */
    _piecesAndImpliedPiecesWithPotentialRepeats() {
        let pieces = [];
        for (let key of this.cells.keys()) {
            let offset = UnitCellMap._keyToCell(key);

            let val = this.cells.get(key);
            for (let pp of ALL_PLUMBING_PIECES) {
                if (val.piece_names.has(pp.name)) {
                    pieces.push(new LocalizedPlumbingPiece(pp, offset));
                    for (let imp of pp.implies) {
                        pieces.push(new LocalizedPlumbingPiece(
                            PLUMBING_PIECE_MAP.get(imp.name),
                            offset.plus(imp.offset)));
                    }
                }
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
        for (let piece of pieces) {
            if (!piece.plumbingPiece.onlyImplied) {
                continue;
            }
            for (let ex of ALL_PLUMBING_PIECES) {
                for (let imp of ex.implies) {
                    if (imp.name === piece.plumbingPiece.name) {
                        let newCell = piece.cell.plus(imp.offset.scaledBy(-1));
                        let impliedPos = piece.plumbingPiece.boxAt(piece.cell).center();
                        let extendedPos = ex.boxAt(newCell).center();
                        extras.push(new LocalizedPlumbingPiece(
                            ex,
                            newCell,
                            extendedPos.minus(impliedPos)));
                    }
                }
            }
        }
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
}

export {UnitCell, UnitCellMap}
