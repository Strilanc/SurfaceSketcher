import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {Ray} from "src/geo/Ray.js";
import {PLUMBING_PIECE_MAP, ALL_PLUMBING_PIECES} from "src/PlumbingPieces.js";

const SMALL_DIAMETER = 0.2;
const LONG_DIAMETER = 0.8;

class UnitCell {
    /**
     * @param {!Set.<!string>} piece_names
     */
    constructor(piece_names = new Set()) {
        this.piece_names = new Set();
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
     * @returns {!Array.<![!Point, !PlumbingPiece]>}
     */
    piecesAndImpliedPiecesWithPotentialRepeats() {
        let pieces = [];
        for (let key of this.cells.keys()) {
            let offset = UnitCellMap._keyToCell(key);

            let val = this.cells.get(key);
            for (let pp of ALL_PLUMBING_PIECES) {
                if (val.piece_names.has(pp.name)) {
                    pieces.push([offset, pp]);
                    for (let imp of pp.implies) {
                        pieces.push([offset.plus(imp.offset), PLUMBING_PIECE_MAP.get(imp.name)]);
                    }
                }
            }
        }
        return pieces;
    }

    /**
     * @returns {!Array.<!RenderData>}
     */
    renderData() {
        let pieces = this.piecesAndImpliedPiecesWithPotentialRepeats();
        let seen = new Set();
        let result = [];
        for (let [pt, pp] of pieces) {
            let key = UnitCellMap._cellKey(pt) + ':' + pp.name;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            result.push(pp.boxAt(pt).toRenderData(pp.color));
        }
        return result;
    }

    /**
     * @param {!Ray} ray
     * @returns {!{collisionPoint: !Point, plumbingPiece: !PlumbingPiece, cell: !Point}}
     */
    intersect(ray) {
        let bestPiece = undefined;
        let bestPt = undefined;
        for (let piece of this.piecesAndImpliedPiecesWithPotentialRepeats()) {
            let pt = ray.intersectBox(piece[1].boxAt(piece[0]), 0.001);
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
            plumbingPiece: bestPiece[1],
            cell: bestPiece[0],
            collisionPoint: bestPt
        };
    }
}

export {UnitCell, UnitCellMap}
