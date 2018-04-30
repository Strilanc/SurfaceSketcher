/**
 * @param {!int} t
 */
import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {seq} from "src/base/Seq.js";
import {UnitCellMap} from "src/braid/UnitCellMap.js";
import {LockstepSurfaceLayer} from "src/sim/LockstepSurfaceLayer.js";
import {PLUMBING_PIECE_MAP, PlumbingPieceFootprint} from "src/braid/PlumbingPieces.js";
import {FixupLayer} from "src/sim/FixupLayer.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {Surface} from "src/sim/Surface.js";


/**
 * @param {!int} codeDistance
 * @param {!int} width
 * @param {!int} height
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 * @returns {!PlumbingPieceFootprint}
 */
function blockOut(codeDistance, width, height, pieces) {
    let result = makeArrayGrid(width, height, () => false);
    for (let piece of pieces) {
        let footprint = piece.toFootprint(codeDistance);
        for (let row = 0; row < footprint.mask.length; row++) {
            for (let col = 0; col < footprint.mask[row].length; col++) {
                if (footprint.mask[row][col]) {
                    result[row + footprint.offsetY][col + footprint.offsetX] = true;
                }
            }
        }
    }
    return new PlumbingPieceFootprint(0, 0, result);
}

/**
 * @param {!UnitCellMap} map
 * @param {!int} t
 * @returns {!Array.<!LocalizedPlumbingPiece>}
 */
function timeSlice(map, t) {
    let result = [];
    t /= 2;
    for (let piece of map.piecesAndImpliedPieces()) {
        let pt = piece.cell;
        let pp = piece.plumbingPiece;
        let c = pp.boxAt(pt).center();
        if (t - 0.25 <= c.y && c.y <= t + 0.25) {
            result.push(piece);
        }
    }
    return result;
}

/**
 * @param {!UnitCellMap} map
 * @returns {!Array.<!LockstepSurfaceLayer>}
 */
function simulate_map(map) {
    let surface = new Surface(20, 20);
    let layers = [];
    for (let t = 0; t < 100; t++) {
        let slice = [...timeSlice(map, t)];
        if (slice.length === 0) {
            continue;
        }
        let layer = new LockstepSurfaceLayer(new FixupLayer(20, 20));
        let block = blockOut(5, 20, 20, slice);
        layer.measureEnabledStabilizers(surface, block.mask);
        layers.push(layer);
    }
    return layers;
}

export {simulate_map}
