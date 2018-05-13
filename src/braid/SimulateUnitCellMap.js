/**
 * Methods for preparing parallel operations to perform during simulation, and actually doing that simulation.
 */

import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {seq} from "src/base/Seq.js";
import {UnitCellMap} from "src/braid/UnitCellMap.js";
import {LockstepSurfaceLayer} from "src/sim/LockstepSurfaceLayer.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {FixupLayer} from "src/sim/FixupLayer.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {Surface} from "src/sim/Surface.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {Tile} from "src/sim/Tile.js";
import {TileStack} from "src/sim/TileStack.js";
import {XY} from "src/sim/util/XY.js";
import {SMALL_DIAMETER} from "src/braid/CodeDistance.js";
import {IMPORTANT_UNIT_CELL_TIMES} from "src/braid/Sockets.js";

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
        piece.piece.propagateSignalEnter(tileStack, piece, codeDistance);
        piece.piece.propagateSignalExit(tileStack, piece, codeDistance);
    }
}

/**
 * @param {!UnitCellMap} map
 * @param {!int} unitCellIndex
 * @param {!int} transitionIndex
 * @returns {!Array.<!LocalizedPlumbingPiece>}
 */
function relevantPiecesAt(map, unitCellIndex, transitionIndex) {
    let result = [];
    let absoluteT = unitCellIndex + IMPORTANT_UNIT_CELL_TIMES[transitionIndex];
    for (let piece of map.allLocalizedPieces()) {
        let pt = piece.loc;
        let socket = piece.socket;
        let box = socket.boxAt(pt);
        let y1 = box.baseCorner.y;
        let y2 = y1 + box.diagonal.y;
        if (absoluteT + 0.001 > y1 && absoluteT - 0.001 < y2) {
            result.push(piece);
        }
    }
    return result;
}

/**
 * @param {!Surface} surface
 * @returns {!TileStack}
 */
function makeClearXStabilizersTileStack(surface) {
    let t = makeMeasureAllStabilizersTileStack(surface);
    for (let j = 1; j < surface.height; j += 2) {
        for (let i = (surface.width | 1) - 2; i >= 1; i -= 2) {
            if (i >= 1) {
                t.feedforward_z(new XY(i, j), new XY(i - 1, j));
            }
            if (i >= 2) {
                t.propagate(new XY(i, j), new XY(i - 2, j));
            }
        }
    }
    return t;
}

/**
 * @param {!Surface} surface
 * @returns {!TileStack}
 */
function makeMeasureAllStabilizersTileStack(surface) {
    let t = new TileStack();
    t.startNewTile();
    t.measureEnabledStabilizers(surface, new GeneralSet());
    return t;
}

/**
 * @param {!int} codeDistance
 * @param {!UnitCellMap} map
 * @returns {!Array.<!TileStack>}
 */
function unitCellMapToTileStacks(codeDistance, map) {
    let w = 8;
    let h = 16;
    let surface = new Surface(w, h);
    let tileStacks = [];
    tileStacks.push(makeClearXStabilizersTileStack(surface));
    let max_z = seq(map.cells.keys()).map(e => e.z).max(-1);
    for (let unitCellIndex = 0; unitCellIndex <= max_z; unitCellIndex++) {
        for (let transitionIndex = 0; transitionIndex < IMPORTANT_UNIT_CELL_TIMES.length; transitionIndex++) {
            let pieces = [...relevantPiecesAt(map, unitCellIndex, transitionIndex)];
            let tileStack = new TileStack();
            tileStack.startNewTile();
            propagateSignals(tileStack, codeDistance, pieces);
            let block = combinedFootprint(codeDistance, pieces);
            tileStack.measureEnabledStabilizers(surface, block.mask);
            tileStacks.push(tileStack);
        }
    }
    surface.destruct();
    return tileStacks;
}

/**
 * @param {!Array.<!TileStack>} tileStacks
 * @param {!int} tileIndex
 * @returns {!SimulationResults}
 */
function runSimulation(tileStacks, tileIndex=0) {
    let w = 8;
    let h = 16;
    let surface = new Surface(w, h);
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

export {
    unitCellMapToTileStacks,
    SimulationResults,
    runSimulation,
    makeMeasureAllStabilizersTileStack,
    makeClearXStabilizersTileStack
}
