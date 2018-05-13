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
import {Tile} from "src/sim/Tile.js";
import {TileStack} from "src/sim/TileStack.js";


/**
 * @param {!int} codeDistance
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 * @returns {!UnitCellSocketFootprint}
 */
function combinedFootprint(codeDistance, pieces) {
    let result = new GeneralSet();
    for (let piece of pieces) {
        for (let xy of piece.piece.toLocalizedFootprint(piece, codeDistance).mask) {
            result.add(xy);
        }
    }
    return new UnitCellSocketFootprint(result);
}

/**
 * @param {!TileStack} tileStack
 * @param {!int} codeDistance
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 */
function propagateSignals(tileStack, codeDistance, pieces) {
    for (let piece of pieces) {
        piece.piece.propagateSignal(tileStack, piece, codeDistance);
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
 * @returns {!Array.<!TileStack>}
 */
function simulateMap(codeDistance, map) {
    let w = 8;
    let h = 16;
    let surface = new Surface(w, h);
    let tileStacks = [];
    let count = seq(map.cells.keys()).map(e => (e.z + 2) * 2).max(0);
    for (let t = 0; t < count; t++) {
        let pieces = [...timeSlice(map, t)];
        let tileStack = new TileStack();
        tileStack.startNewTile();
        propagateSignals(tileStack, codeDistance, pieces);
        let block = combinedFootprint(codeDistance, pieces);
        tileStack.measureEnabledStabilizers(surface, block.mask);
        tileStacks.push(tileStack);
    }
    surface.destruct();
    return tileStacks;
}

/**
 * @param {!Array.<!TileStack>} tileStacks
 * @returns {!SimulationResults}
 */
function runSimulation(tileStacks) {
    let w = 8;
    let h = 16;
    let surface = new Surface(w, h);
    surface.clearXStabilizers();
    let tileIndex = 0;
    let measurements = new GeneralMap();
    for (let tileStack of tileStacks) {
        tileStack.simulateOn(surface, tileIndex, measurements);
        tileIndex += tileStack.tiles.length;
    }
    surface.destruct();

    return new SimulationResults(new GeneralMap(), measurements);
}

class SimulationResults {
    /**
     * @param {!GeneralMap.<!Point, !GeneralMap.<!UnitCellSocket, !string>>} displayVals
     * @param {!GeneralMap.<!XYT, !Measurement>} measurements
     */
    constructor(displayVals, measurements) {
        this.displayVals = displayVals;
        this.measurements = measurements;
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
