/**
 * Utilities for rendering a representation of a quantum computation made up of parallel tiles.
 */

import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"
import {Vector} from "src/geo/Vector.js";
import {codeDistanceToPipeSize, codeDistanceUnitCellSize} from "src/braid/CodeDistance.js";
import {DetailedError} from "src/base/DetailedError.js";
import {XY} from "src/sim/util/XY.js";
import {X_DOWN, X_LEFT, X_RIGHT, X_UP} from "src/sim/Tile.js";
import {pyramidRenderData, circleRenderData, lineSegmentPathRenderData, polygonRenderData} from "src/draw/Shapes.js";
import {XYT} from "src/sim/util/XYT.js";
import {Config} from "src/Config.js";
import {PauliMap} from "src/sim/util/PauliMap.js";
import {IMPORTANT_UNIT_CELL_TIMES} from "src/braid/Sockets.js";
import {Quad} from "src/geo/Quad.js";

const OP_HEIGHT = 0.005;
/**
 * @param {*} operationIdentifier
 * @returns {!XY}
 */
function cnotDirection(operationIdentifier) {
    switch (operationIdentifier) {
        case X_RIGHT:
            return new XY(1, 0);
        case X_LEFT:
            return new XY(-1, 0);
        case X_DOWN:
            return new XY(0, +1);
        case X_UP:
            return new XY(0, -1);
    }
    return undefined;
}

/**
 * @param {!number} time
 * @param {!Array.<[!number, !number]>} keyframes Timestamp+coordinate pairs.
 * @returns {*}
 */
function keyFrameLerp(time, ...keyframes) {
    if (time < keyframes[0][0]) {
        return keyframes[0][1]
    }
    for (let i = 0; i < keyframes.length - 1; i++) {
        let [k0, x0] = keyframes[i];
        let [k1, x1] = keyframes[i + 1];
        if (k0 <= time && time < k1) {
            return x0 + (time - k0 + 1) / (k1 - k0 + 1) * (x1 - x0);
        }
    }
    return keyframes[keyframes.length - 1][1]
}

/**
 * @param {!int} codeDistance
 * @param {!XY} xy
 * @param {!int} opIndex
 * @param {!int} tileIndex
 * @returns {!Point}
 */
function qubitPosition(codeDistance, xy, opIndex, tileIndex) {
    let unitCellIndex = Math.floor(tileIndex / IMPORTANT_UNIT_CELL_TIMES.length);
    let transitionIndex = tileIndex - unitCellIndex * IMPORTANT_UNIT_CELL_TIMES.length;
    let tileIndexY = unitCellIndex + IMPORTANT_UNIT_CELL_TIMES[transitionIndex];

    let {y: row, x: col} = xy;
    let {w: uw, h: uh} = codeDistanceUnitCellSize(codeDistance);
    let {w: pw, h: ph} = codeDistanceToPipeSize(codeDistance);
    let blockX = Math.floor(col / uw);
    let blockY = Math.floor(row / uh);
    let subX = ((col % uw) + uw) % uw;
    let subY = ((row % uh) + uh) % uh;
    let sw = Math.floor((uw - 2*pw)/4) * 2;
    let sh = Math.floor((uh - 2*ph)/4) * 2;
    let x = keyFrameLerp(subX, [0, 0], [pw, 0.2], [pw + sw, 0.5], [pw*2 + sw, 0.7], [uw, 1]);
    let y = keyFrameLerp(subY, [0, 0], [ph, 0.2], [ph + sh, 0.5], [ph*2 + sh, 0.7], [uh, 1]);
    return new Point(x + blockX, opIndex*OP_HEIGHT + tileIndexY, y + blockY)
}

/**
 * @param {!Tile} tile
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @param {!SimulationResults} simResult
 * @returns {!Array.<!RenderData>}
 */
function _tileWireRenderData(tile, tileIndex, codeDistance, simResult) {
    let pos = (xy, opIndex) => qubitPosition(codeDistance, xy, opIndex, tileIndex);

    let result = [];
    let depth = tile.depth();

    // Initializations.
    for (let [xy, axis] of tile.initializations.entries()) {
        if (axis.is_z()) {
            result.push(uprightPyramidRenderData(pos(xy, -1), -OP_HEIGHT, Config.BRAIDING_PRIMAL_COLOR));
        } else {
            result.push(uprightPyramidRenderData(pos(xy, -1), -OP_HEIGHT, Config.BRAIDING_DUAL_COLOR));
        }
    }

    // Measurements.
    for (let [xy, axis] of tile.measurements.entries()) {
        let color;
        let m = simResult.measurements.get(new XYT(xy.x, xy.y, tileIndex));

        if (m !== undefined && m.result) {
            if (axis.is_z()) {
                color = [1, 0.7, 0.7, 1];
            } else {
                color = [0.7, 0.4, 0.4, 1];
            }
        } else if (axis.is_z()) {
            color = Config.BRAIDING_PRIMAL_COLOR;
        } else {
            color = Config.BRAIDING_DUAL_COLOR;
        }
        result.push(uprightPyramidRenderData(pos(xy, depth + 1), +OP_HEIGHT, color));
    }

    // Data lines.
    for (let xy of tile.operations.keys()) {
        result.push(lineSegmentPathRenderData([pos(xy, -1), pos(xy, depth + 4)], [0, 0, 0, 1]));
    }

    return result;
}

/**
 * @param {!SimulationLayout} layout
 * @param {!Tile} tile
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @param {!SimulationResults} simResult
 * @returns {!Array.<!RenderData>}
 */
function _tileSimplifiedWireRenderData(layout, tile, tileIndex, codeDistance, simResult) {
    // let pos = xy => qubitPosition(codeDistance, xy, 0, tileIndex);
    let quadData = (xy, color) => {
        let c1 = qubitPosition(codeDistance, xy.offsetBy(-0.001, -0.001), 0, tileIndex);
        let c2 = qubitPosition(codeDistance, xy.offsetBy(0.999, 0.999), 0, tileIndex);
        let d = c2.minus(c1);
        return new Quad(c1, new Vector(d.x, 0, 0), new Vector(0, 0, d.z)).toRenderData(color, undefined, [0, 0, 0, 1]);
    };
    // let circleData = (xy, color) => {
    //     let center = pos(xy);
    //     return circleRenderData(center, new Vector(0.01, 0, 0), new Vector(0, 0, 0.01), color);
    // };
    // let faceData = (xy, color) => {
    //     let center = pos(xy);
    //     let left = pos(xy.offsetBy(1, 0));
    //     let right = pos(xy.offsetBy(-1, 0));
    //     let top = pos(xy.offsetBy(0, 1));
    //     let down = pos(xy.offsetBy(0, -1));
    //     return polygonRenderData(center, [left, top, right, down], color, [0, 0, 0, 1]);
    // };

    let result = [];

    for (let x = layout.minX; x <= layout.maxX; x++) {
        for (let y = layout.minY; y <= layout.maxY; y++) {
            let xy = new XY(x, y);
            let color = undefined;
            let measurement = simResult.measurements.get(new XYT(xy.x, xy.y, tileIndex));

            let measurementAxis = tile.measurements.get(xy);
            let initAxis = tile.initializations.get(xy);
            let isHeldData = measurementAxis === undefined && initAxis === undefined;
            let isMeasuredData = measurementAxis !== undefined && initAxis === undefined;
            let isStabilizer = measurementAxis !== undefined && initAxis !== undefined;
            let isHole = !tile.operations.has(xy) && measurementAxis === undefined && initAxis === undefined;

            if (isHole) {
                color = Config.SIMPLIFIED_HOLE_COLOR;
            } else if (isHeldData) {
                color = Config.SIMPLIFIED_DATA_COLOR;
            } else if (isStabilizer) {
                if (measurement !== undefined && measurement.result) {
                    color = measurementAxis.is_z() ?
                        Config.SIMPLIFIED_PRIMAL_COLOR_HIGHLIGHT :
                        Config.SIMPLIFIED_DUAL_COLOR_HIGHLIGHT;
                } else {
                    color = measurementAxis.is_z() ?
                        Config.SIMPLIFIED_PRIMAL_COLOR :
                        Config.SIMPLIFIED_DUAL_COLOR;
                }
            } else if (isMeasuredData) {
                if (measurement !== undefined && measurement.result) {
                    color = measurementAxis.is_z() ?
                        Config.SIMPLIFIED_DATA_PRIMAL_MEASURE_ON_COLOR :
                        Config.SIMPLIFIED_DATA_DUAL_MEASURE_ON_COLOR;
                } else {
                    color = measurementAxis.is_z() ?
                        Config.SIMPLIFIED_DATA_PRIMAL_MEASURE_OFF_COLOR :
                        Config.SIMPLIFIED_DATA_DUAL_MEASURE_OFF_COLOR;
                }
            } else if (initAxis !== undefined) {
                color = initAxis.is_z() ?
                    Config.BRAIDING_PRIMAL_COLOR:
                    Config.BRAIDING_DUAL_COLOR;
            } else {
                // unknown
                color = [1, 0, 0, 1];
            }

            if (color !== undefined) {
                result.push(quadData(xy, color));
            }
        }
    }

    return result;
}

/**
 * @param {!TileColumn} tileColumn
 * @param {!int} tileIndex
 * @param {!int} opIndex
 * @param {!XY} colXy
 * @param {!int} codeDistance
 * @returns {!Array.<!RenderData>}
 */
function _tileOperationToRenderData(tileColumn, tileIndex, opIndex, colXy, codeDistance) {
    let pos = xy => qubitPosition(codeDistance, xy, opIndex, tileIndex);

    let delta = cnotDirection(tileColumn.entries[opIndex]);
    if (delta === undefined) {
        return [];
    }

    let target = flatCrossedCircleRenderDataMulti(
        pos(colXy),
        delta.x,
        delta.y,
        OP_HEIGHT/2,
        [0.9, 0.9, 0.9, 1],
        [0, 0, 0, 1]);

    let control = flatCrossedCircleRenderDataMulti(
        pos(colXy.offsetBy(delta.x, delta.y)),
        -delta.x,
        -delta.y,
        OP_HEIGHT/8,
        [0, 0, 0, 1],
        undefined);

    let controlToTargetLine = lineSegmentPathRenderData([pos(colXy), pos(colXy.offsetBy(delta.x, delta.y))]);

    return [...target, ...control, controlToTargetLine];
}

/**
 * @param {!TileStack} tileStack
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @param {!boolean} simplified
 * @returns {!Array.<!RenderData>}
 */
function _tileStackFeedToRenderData(tileStack, tileIndex, codeDistance, simplified) {
    if (simplified) {
        return _tileStackFeedToRenderDataSimplified(tileStack, tileIndex, codeDistance);
    }
    let result = [];

    for (let [xyt, pauliMap] of tileStack.feed.entries()) {
        let controlPos = qubitPosition(codeDistance, xyt.xy, 10, xyt.t + tileIndex);
        let controlData = circleRenderData(
            controlPos,
            new Vector(0.002, 0, 0),
            new Vector(0, 0, 0.002),
            [0, 0, 0, 1],
            undefined,
            12);
        result.push(controlData);

        for (let [target, effect] of pauliMap.operations.entries()) {
            let targetPos = qubitPosition(codeDistance, target, 10, xyt.t + tileIndex);
            let targetColor;
            if (effect === PauliMap.XMask) {
                targetColor = Config.BRAIDING_PRIMAL_COLOR;
            } else if (effect === PauliMap.ZMask) {
                targetColor = Config.BRAIDING_DUAL_COLOR;
            } else if (effect === (PauliMap.XMask | PauliMap.ZMask)) {
                targetColor = [0, 0, 1, 1];
            }

            let delta = targetPos.minus(controlPos).perpOnto(new Vector(0, 1, 0)).unit();
            let targetData = flatCrossedCircleRenderDataMulti(
                targetPos,
                delta.x,
                delta.y,
                0.004,
                targetColor,
                [0, 0, 0, 1]);

            let controlToTargetLine = lineSegmentPathRenderData([controlPos, targetPos]);

            result.push(...targetData);
            result.push(controlToTargetLine);
        }
    }
    return result;
}

/**
 * @param {!TileStack} tileStack
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @param {!boolean} simplified
 * @returns {!Array.<!RenderData>}
 */
function _tileStackPropToRenderData(tileStack, tileIndex, codeDistance, simplified) {
    if (simplified) {
        return _tileStackPropToRenderDataSimplified(tileStack, tileIndex, codeDistance);
    }
    let result = [];

    for (let xyt of tileStack.prop.topologicalOrder()) {
        let outs = tileStack.prop.outEdges(xyt);
        if (outs.length === 0) {
            continue;
        }

        let controlPos = qubitPosition(codeDistance, xyt.xy, 9, xyt.t + tileIndex);
        let controlData = circleRenderData(
            controlPos,
            new Vector(0.002, 0, 0),
            new Vector(0, 0, 0.002),
            [0, 0, 0, 1],
            undefined,
            12);
        result.push(controlData);

        for (let target of outs) {
            let targetPos = qubitPosition(codeDistance, target, 7, xyt.t + tileIndex);
            let delta = targetPos.minus(controlPos).perpOnto(new Vector(0, 1, 0)).unit();
            let targetData = flatCrossedCircleRenderDataMulti(
                targetPos,
                delta.x,
                delta.y,
                0.004,
                Config.BRAIDING_PRIMAL_COLOR,
                [0, 0, 0, 1]);

            let controlToTargetLine = lineSegmentPathRenderData([controlPos, targetPos]);

            result.push(...targetData);
            result.push(controlToTargetLine);
        }
    }
    return result;
}

/**
 * @param {!TileStack} tileStack
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @returns {!Array.<!RenderData>}
 */
function _tileStackPropToRenderDataSimplified(tileStack, tileIndex, codeDistance) {
    let result = [];

    for (let xyt of tileStack.prop.topologicalOrder()) {
        let outs = tileStack.prop.outEdges(xyt);
        if (outs.length === 0) {
            continue;
        }

        let controlPos = qubitPosition(codeDistance, xyt.xy.offsetBy(0.5, 0.5), 1, xyt.t + tileIndex);
        for (let target of outs) {
            let targetPos = qubitPosition(codeDistance, target.xy.offsetBy(0.5, 0.5), 1, xyt.t + tileIndex);
            result.push(arrowRenderData(targetPos, controlPos, Config.SIMPLIFIED_PROPAGATE_COLOR));
        }
    }
    return result;
}
/**
 * @param {!TileStack} tileStack
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @returns {!Array.<!RenderData>}
 */
function _tileStackFeedToRenderDataSimplified(tileStack, tileIndex, codeDistance) {
    let result = [];
    for (let [xyt, pauliMap] of tileStack.feed.entries()) {
        let controlPos = qubitPosition(codeDistance, xyt.xy.offsetBy(0.5, 0.5), 1, xyt.t + tileIndex);

        for (let [target, effect] of pauliMap.operations.entries()) {
            let targetPos = qubitPosition(codeDistance, target.offsetBy(0.5, 0.5), 1, xyt.t + tileIndex);
            let targetColor;
            if (effect === PauliMap.XMask) {
                targetColor = Config.SIMPLIFIED_PRIMAL_COLOR;
            } else if (effect === PauliMap.ZMask) {
                targetColor = Config.SIMPLIFIED_DUAL_COLOR;
            } else if (effect === (PauliMap.XMask | PauliMap.ZMask)) {
                targetColor = Config.SIMPLIFIED_DATA_COLOR;
            }
            result.push(arrowRenderData(targetPos, controlPos, targetColor));
        }
    }
    return result;
}

/**
 * @param {!Point} tip
 * @param {!number} height
 * @param {![!number, !number, !number, !number]} color
 * @returns {!RenderData}
 */
function uprightPyramidRenderData(tip, height, color) {
    let base = tip.plus(new Vector(0, height, 0));
    let corner = base.plus(new Vector(height, 0, height));
    return pyramidRenderData(tip, base, corner, color, [0, 0, 0, 1]);
}

/**
 * @param {!Point} center
 * @param {!int} dx
 * @param {!int} dz
 * @param {!number} radius
 * @param {![!number, !number, !number, !number]} centerColor
 * @param {![!number, !number, !number, !number]}borderColor
 * @returns {!Array.<!RenderData>}
 */
function flatCrossedCircleRenderDataMulti(center, dx, dz, radius, centerColor, borderColor) {
    let dh = new Vector(dx*radius, 0, dz*radius);
    let dv = new Vector(0, radius, 0);
    let circleData = circleRenderData(center, dh, dv, centerColor, borderColor, 12);

    let crossData1 = lineSegmentPathRenderData([center.plus(dh), center.plus(dh.scaledBy(-1))]);
    let crossData2 = lineSegmentPathRenderData([center.plus(dv), center.plus(dv.scaledBy(-1))]);

    return [circleData, crossData1, crossData2];
}

/**
 * @param {!SimulationLayout} layout
 * @param {!Tile} tile
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @param {!SimulationResults} simResult
 * @param {!boolean} simplified
 * @returns {!Array.<!RenderData>}
 */
function tileToRenderData(layout, tile, tileIndex, codeDistance, simResult, simplified) {
    if (simplified) {
        return _tileSimplifiedWireRenderData(layout, tile, tileIndex, codeDistance, simResult);
    }

    let result = _tileWireRenderData(tile, tileIndex, codeDistance, simResult);
    for (let [xy, col] of tile.operations.entries()) {
        for (let colOpIndex = 0; colOpIndex < col.entries.length; colOpIndex++) {
            result.push(..._tileOperationToRenderData(col, tileIndex, colOpIndex, xy, codeDistance));
        }
    }
    return result;
}

/**
 * @param {!SimulationLayout} layout
 * @param {!TileStack} tileStack
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @param {!SimulationResults} simResult
 * @param {!boolean} simplified
 * @returns {!Array.<!RenderData>}
 */
function tileStackToRenderData(layout, tileStack, tileIndex, codeDistance, simResult, simplified=true) {
    let result = [];
    for (let i = 0; i < tileStack.tiles.length; i++) {
        result.push(
            ...tileToRenderData(layout, tileStack.tiles[i], tileIndex + i, codeDistance, simResult, simplified));
    }
    result.push(..._tileStackFeedToRenderData(tileStack, tileIndex, codeDistance, simplified));
    result.push(..._tileStackPropToRenderData(tileStack, tileIndex, codeDistance, simplified));
    return result;
}

/**
 * @param {!SimulationLayout} layout
 * @param {!int} tileIndex
 * @param {!int} codeDistance
 * @returns {!RenderData}
 */
function tileStackToOutlineRenderData(layout, tileIndex, codeDistance) {
    let c1 = qubitPosition(codeDistance, new XY(layout.minX - 0.001, layout.minY - 0.001), 0, tileIndex);
    let c2 = qubitPosition(codeDistance, new XY(layout.maxX + 0.999, layout.maxY + 0.999), 0, tileIndex);
    let d = c2.minus(c1);
    return new Quad(c1, new Vector(d.x, 0, 0), new Vector(0, 0, d.z)).toRenderData(
        undefined, undefined, [0, 0, 0, 0.5]);
}

/**
 * @param {!Point} targetPos
 * @param {!Point} controlPos
 * @param {![!number, !number, !number, !number]} fillColor
 * @returns {!RenderData}
 */
function arrowRenderData(targetPos, controlPos, fillColor) {
    let crossSpan = 0.3;
    let alongSpan = 1.5;

    let along = targetPos.minus(controlPos).unit().scaledBy(0.01);
    let cross = along.cross(new Vector(0, 1, 0)).scaledBy(crossSpan);
    let cen = targetPos.plus(along.scaledBy(-alongSpan));
    return polygonRenderData(
        targetPos,
        [
            controlPos,
            cen.plus(cross.scaledBy(-0.5)),
            cen.plus(cross.scaledBy(-2)),
            targetPos,
            cen.plus(cross.scaledBy(2)),
            cen.plus(cross.scaledBy(0.5)),
        ],
        fillColor,
        undefined);
}

export {tileToRenderData, tileStackToRenderData, tileStackToOutlineRenderData}
