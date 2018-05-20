/**
 * Methods for preparing parallel operations to perform during simulation, and actually doing that simulation.
 */

import {DetailedError} from 'src/base/DetailedError.js'
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {seq} from "src/base/Seq.js";
import {UnitCellMap} from "src/braid/UnitCellMap.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {Surface} from "src/sim/Surface.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {Tile} from "src/sim/Tile.js";
import {TileStack} from "src/sim/TileStack.js";
import {XY} from "src/sim/util/XY.js";
import {SMALL_DIAMETER} from "src/braid/CodeDistance.js";
import {IMPORTANT_UNIT_CELL_TIMES} from "src/braid/Sockets.js";
import {SimulationLayout} from "src/braid/SimulationLayout.js";

/**
 * @param {!int} codeDistance
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 * @param {!int} id
 * @returns {!UnitCellSocketFootprint}
 */
function combinedFootprint(codeDistance, pieces, id) {
    let result = new GeneralSet();
    for (let piece of pieces) {
        for (let xy of piece.piece.toLocalizedFootprint(piece, codeDistance, id).mask) {
            result.add(xy);
        }
    }
    return new UnitCellSocketFootprint(result);
}

/**
 * @param {!TileStack} tileStack
 * @param {!int} codeDistance
 * @param {!int} id
 * @param {!Array.<!LocalizedPlumbingPiece>} pieces
 */
function propagateSignals(tileStack, codeDistance, pieces, id) {
    for (let piece of pieces) {
        piece.piece.propagateSignalAt(tileStack, piece, codeDistance, id);
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
 * @param {!SimulationLayout} layout
 * @returns {!TileStack}
 */
function makeClearXStabilizersTileStack(layout) {
    let t = makeMeasureAllStabilizersTileStack(layout);
    for (let x = layout.maxX; x >= layout.minX; x--) {
        for (let y = layout.minY; y <= layout.maxY; y++) {
            let xy = new XY(x, y);
            if (layout.is_x(xy)) {
                if (x - 1 >= layout.minX) {
                    t.feedforward_z(xy, xy.offsetBy(-1, 0));
                }
                if (x - 2 >= layout.minX) {
                    t.propagate(xy, xy.offsetBy(-2, 0));
                }
            }
        }
    }
    return t;
}

/**
 * @param {!SimulationLayout} layout
 * @returns {!TileStack}
 */
function makeMeasureAllStabilizersTileStack(layout) {
    let t = new TileStack();
    t.startNewTile();
    t.measureEnabledStabilizers(layout, new GeneralSet());
    return t;
}

/**
 * @param {!int} codeDistance
 * @param {!UnitCellMap} map
 * @returns {!Array.<!TileStack>}
 */
function unitCellMapToTileStacks(codeDistance, map) {
    let layout = determineSimulationLayout(map, codeDistance);
    let tileStacks = [];
    tileStacks.push(makeClearXStabilizersTileStack(layout));
    for (let t = layout.minT + 1; t <= layout.maxT; t++) {
        for (let transitionIndex = 0; transitionIndex < IMPORTANT_UNIT_CELL_TIMES.length; transitionIndex++) {
            let pieces = [...relevantPiecesAt(map, t, transitionIndex)];
            let tileStack = new TileStack();
            tileStack.startNewTile();
            propagateSignals(tileStack, codeDistance, pieces, transitionIndex);
            let block = combinedFootprint(codeDistance, pieces, transitionIndex);
            tileStack.measureEnabledStabilizers(layout, block.mask);
            tileStacks.push(tileStack);
        }
    }
    return tileStacks;
}

/**
 * @param {!UnitCellMap} cellMap
 * @param {!int} codeDistance
 */
function determineSimulationLayout(cellMap, codeDistance) {
    let minX = Infinity;
    let minY = Infinity;
    let minT = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxT = -Infinity;
    let update = xy => {
        minX = Math.min(xy.x, minX);
        minY = Math.min(xy.y, minY);
        maxX = Math.max(xy.x, maxX);
        maxY = Math.max(xy.y, maxY);
    };
    for (let p of cellMap.allLocalizedPieces()) {
        let r = p.toSocketFootprintRect(codeDistance);
        update(new XY(r.x, r.y));
        update(new XY(r.x + r.w - 1, r.y + r.h - 1));
        minT = Math.min(minT, p.loc.y);
        maxT = Math.max(maxT, p.loc.y);
    }

    minX = Math.floor(minX / 2) * 2 - 2;
    minY = Math.floor(minY / 2) * 2 - 2;
    maxX = Math.ceil(maxX / 2) * 2 + 2;
    maxY = Math.ceil(maxY / 2) * 2 + 2;

    if (minX === Infinity) {
        minX = 0;
        minY = 0;
        minT = 0;
        maxX = 0;
        maxY = 0;
        maxT = 0;
    }

    return new SimulationLayout(minX, maxX, minY, maxY, minT - 1, maxT);
}

/**
 * @param {!SimulationLayout} layout
 * @param {!Array.<!TileStack>} tileStacks
 * @returns {!SimulationResults}
 */
function runSimulation(layout, tileStacks) {
    let surface = new Surface(layout.maxX - layout.minX + 1, layout.maxY - layout.minY + 1);
    let measurements = new GeneralMap();
    let tileIndex = layout.minT;
    for (let tileStack of tileStacks) {
        tileStack.simulateOn(surface, layout, tileIndex, measurements);
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
    makeClearXStabilizersTileStack,
    determineSimulationLayout,
}
