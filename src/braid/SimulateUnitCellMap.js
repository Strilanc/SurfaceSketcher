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
import {PLUMBING_PIECE_MAP} from "src/braid/Sockets.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {FixupLayer} from "src/sim/FixupLayer.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {Surface} from "src/sim/Surface.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {GeneralMap} from "src/base/GeneralMap.js";


/**
 * @param {!int} codeDistance
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 * @returns {!UnitCellSocketFootprint}
 */
function blockOut(codeDistance, pieces) {
    let result = new GeneralSet();
    for (let piece of pieces) {
        for (let xy of piece.toFootprint(codeDistance).mask) {
            result.add(xy);
        }
    }
    return new UnitCellSocketFootprint(result);
}

/**
 * @param {!FixupLayer} fixupLayer
 * @param {!int} codeDistance
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 */
function fixOut(fixupLayer, codeDistance, pieces) {
    for (let piece of pieces) {
        piece.doSignalPropagation(codeDistance, fixupLayer);
    }
}

/**
 * @param {!UnitCellMap} map
 * @param {!int} t
 * @returns {!Array.<!LocalizedPlumbingPiece>}
 */
function timeSlice(map, t) {
    let result = [];
    t /= 2;
    for (let piece of map.allLocalizedPieces()) {
        let pt = piece.loc;
        let socket = piece.socket;
        let c = socket.boxAt(pt).center();
        if (t - 0.25 <= c.y && c.y <= t + 0.25) {
            result.push(piece);
        }
    }
    return result;
}

/**
 * @param {!int} codeDistance
 * @param {!UnitCellMap} map
 * @returns {!Array.<!LockstepSurfaceLayer>}
 */
function simulateMap(codeDistance, map) {
    let w = 20;
    let h = 20;
    let surface = new Surface(w, h);
    let layers = [];
    for (let t = 0; t < 100; t++) {
        let slice = [...timeSlice(map, t)];
        if (slice.length === 0) {
            continue;
        }
        let layer = new LockstepSurfaceLayer(new FixupLayer(w, h));
        fixOut(layer.fixup, codeDistance, slice);
        let block = blockOut(codeDistance, slice);
        layer.measureEnabledStabilizers(surface, block.mask);
        layers.push(layer);
    }
    surface.destruct();
    return layers;
}

/**
 * @param {!Array.<!LockstepSurfaceLayer>} layers
 * @returns {!SimulationResults}
 */
function runSimulation(layers) {
    return new SimulationResults(new GeneralMap());
}

class SimulationResults {
    /**
     * @param {!GeneralMap.<!Point, !GeneralMap.<!UnitCellSocket, !string>>} displayVals
     */
    constructor(displayVals) {
        this.displayVals = displayVals;
    }

    /**
     * @param {!Point} loc
     * @param {!UnitCellSocket} socket
     * @returns {undefined|*}
     */
    get(loc, socket) {
        let s = this.displayVals.get(loc);
        if (s === undefined) {
            return undefined;
        }
        return s.get(socket);
    }
}

export {simulateMap, SimulationResults, runSimulation}
