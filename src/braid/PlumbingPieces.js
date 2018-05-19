/**
 * @param {!LocalizedPlumbingPiece} localizedPiece
 * @param {!Vector} d
 * @param {![!number, !number, !number, !number]} color
 * @returns {!Array.<!RenderData>}
 */
import {DetailedError} from 'src/base/DetailedError.js'
import {seq} from "src/base/Seq.js";
import {PlumbingPiece} from "src/braid/PlumbingPiece.js";
import {Sockets} from "src/braid/Sockets.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {Rect} from "src/geo/Rect.js";
import {pyramidRenderData, lineSegmentPathRenderData} from "src/draw/Shapes.js";
import {
    H_ARROW_TEXTURE_RECT,
    V_ARROW_TEXTURE_RECT,
    S_TEXTURE_RECT,
    H_INIT_TEXTURE_RECT,
    DISPLAY_TEXTURE_RECT,
    KET_UNKNOWN_RECT,
    KET_PLUS_I_RECT,
    KET_MINUS_I_RECT,
    KET_PLUS_RECT,
    KET_MINUS_RECT,
    KET_OFF_RECT,
    KET_ON_RECT,
} from "src/draw/shader.js";
import {Vector} from "src/geo/Vector.js";
import {Axis} from "src/sim/util/Axis.js";
import {RenderData} from "src/geo/RenderData.js";
import {
    codeDistanceToPipeSeparation,
    codeDistanceToPipeSize,
    codeDistanceUnitCellSize
} from "src/braid/CodeDistance.js";
import {XYT} from "src/sim/util/XYT.js";
import {XY} from "src/sim/util/XY.js";

const PRIMAL_COLOR = [0.9, 0.9, 0.9, 1.0];
const DUAL_COLOR = [0.4, 0.4, 0.4, 1.0];

class PlumbingPieces {
}

function injectionSiteRenderData(localizedPiece, d, color) {
    let box = localizedPiece.toBox();
    let left = box.baseCorner.plus(box.diagonal.pointwiseMultiply(new Vector(1, 1, 1).minus(d).scaledBy(0.5)));
    let tip = box.center();
    let right = box.baseCorner.plus(box.diagonal.pointwiseMultiply(new Vector(1, 1, 1).plus(d).scaledBy(0.5)));
    let leftCorner = box.baseCorner;
    let rightCorner = box.baseCorner.plus(box.diagonal);
    let a = pyramidRenderData(tip, left, leftCorner, color, [0, 0, 0, 1]);
    let b = pyramidRenderData(tip, right, rightCorner, color, [0, 0, 0, 1]);
    let w = 0.05;
    let c = lineSegmentPathRenderData([
        tip,
        tip.plus(new Vector(0, w, 0)),
        tip.plus(new Vector(w, w, 0)),
        tip.plus(new Vector(w, 2 * w, 0)),
        tip.plus(new Vector(-w, 2 * w, 0)),
        tip.plus(new Vector(-w, 3 * w, 0)),
        tip.plus(new Vector(w, 3 * w, 0))
    ]);
    return [a, b, c];
}

function resultToKetRect(result) {
    switch (result) {
        case '0': return KET_OFF_RECT;
        case '1': return KET_ON_RECT;
        case '+': return KET_PLUS_RECT;
        case '-': return KET_MINUS_RECT;
        case '+i': return KET_PLUS_I_RECT;
        case '-i': return KET_MINUS_I_RECT;
    }
    return KET_UNKNOWN_RECT;
}

/**
 * Expands a hole along a single unit-diameter ray, pushing errors and observables out of the way with feedforward.
 *
 * @param {!TileStack} tileStack Output object to append commands into.
 * @param {!XY} root A location on the border within the existing hole.
 * @param {!int} dx The direction to expand the hole along.
 * @param {!int} dy The direction to expand the hole along.
 * @param {!int} distance The length of the ray to create (including the root location and skipped even qubits).
 * @param {!Axis} axis The hole type.
 */
function expandHoleAlongRay(tileStack, root, dx, dy, distance, axis) {
    let op = axis.opposite();
    for (let i = 1; i < distance; i += 2) {
        let xy = new XY(root.x + i * dx, root.y + i * dy);
        tileStack.measure(xy, axis);
        let c = xy.offsetBy(dx, dy);
        let p1 = c.offsetBy(dx, dy);
        let p2 = c.offsetBy(-dy, dx);
        let p3 = c.offsetBy(dy, -dx);
        for (let p of [p1, p2, p3]) {
            if (!tileStack.lastTile().measurements.has(p)) {
                tileStack.feedforward_pauli(xy, p, op);
            }
        }
    }
}

/**
 * @param {!TileStack} tileStack Output object to append commands into.
 * @param {!XY} rightHandedRoot
 * @param {!int} dx
 * @param {!int} dy
 * @param {!int} distance
 * @param {!int} sideLength
 * @param {!Axis} axis The hole type.
 */
function expandHoleAlongSide(tileStack, rightHandedRoot, dx, dy, sideLength, distance, axis) {
    let sx = dy;
    let sy = -dx;

    // Grow fingers.
    for (let i = 0; i < sideLength; i += 2) {
        let root = new XY(rightHandedRoot.x + sx * i, rightHandedRoot.y + sy * i);
        expandHoleAlongRay(tileStack, root, dx, dy, distance, axis);
    }

    // Glue the fingers together.
    for (let i = 1; i < sideLength; i += 2) {
        let root = new XY(rightHandedRoot.x + sx * i + dx, rightHandedRoot.y + sy * i + dy);
        expandHoleAlongRay(tileStack, root, dx, dy, distance, axis.opposite());
    }
}

/**
 * @param {!TileStack} tileStack Output object to append commands onto.
 * @param {!Rect} rect The area to turn into a hole.
 * @param {!XY} holeOrigin The location of the first measurement qubit to turn off. The full hole is made by propagating
 *     outward from this point. It determines how errors / observables are pushed around by the hole creation process.
 * @param {!Axis} axis The hole type.
 */
function startHole(tileStack, rect, holeOrigin, axis) {
    if (((holeOrigin.x - rect.x) & 1) !== 0 || ((holeOrigin.y - rect.y) & 1) !== 0) {
        throw new DetailedError('Holes must start on a stabilizer of the same type.', {rect, holeOrigin});
    }
    if (!rect.contains(holeOrigin)) {
        throw new DetailedError('Holes must start inside themselves.', {rect, holeOrigin});
    }

    let rightWidth = rect.x + rect.w - holeOrigin.x;
    let leftWidth = holeOrigin.x - rect.x + 1;
    let aboveHeight = rect.y + rect.h - holeOrigin.y;
    let belowHeight = holeOrigin.y - rect.y + 1;

    // Make a complete row.
    expandHoleAlongRay(tileStack, holeOrigin, 1, 0, rightWidth, axis);
    expandHoleAlongRay(tileStack, holeOrigin, -1, 0, leftWidth, axis);

    // Expand row into a square.
    expandHoleAlongSide(tileStack, new XY(rect.x, holeOrigin.y), 0, 1, rect.w, aboveHeight, axis);
    expandHoleAlongSide(tileStack, new XY(rect.x + rect.w - 1, holeOrigin.y), 0, -1, rect.w, belowHeight, axis);
}

/**
 * @param {!TileStack} tileStack
 * @param {!LocalizedPlumbingPiece} piece
 * @param {!int} codeDistance
 */
function propagateRightward(tileStack, piece, codeDistance) {
    let foot = piece.toSocketFootprintRect(codeDistance);
    startHole(tileStack, foot, new XY(foot.x, foot.y), Axis.Z);
}

/**
 * @param {!LocalizedPlumbingPiece} localizedPiece
 * @param {!SimulationResults} simResults
 * @returns {!Array.<!RenderData>}
 */
function displayResult(localizedPiece, simResults) {
    let box = localizedPiece.toBox();
    let quad = box.faceQuad(new Vector(0, 1, 0)).
        swapLegs().
        flipHorizontal().
        offsetBy(new Vector(0, box.diagonal.y / 2, 0));
    let ketRect = resultToKetRect(simResults.get(localizedPiece.loc, localizedPiece.socket));
    return [quad.toRenderData([1, 0.8, 0.8, 1], ketRect)];
}

PlumbingPieces.PRIMAL_RIGHTWARD = new PlumbingPiece(
    'PRIMAL_RIGHTWARD',
    Sockets.XPrimal,
    PRIMAL_COLOR,
    H_ARROW_TEXTURE_RECT,
    undefined,
    undefined);
PlumbingPieces.PRIMAL_LEFTWARD = new PlumbingPiece(
    'PRIMAL_LEFTWARD',
    Sockets.XPrimal,
    PRIMAL_COLOR,
    H_ARROW_TEXTURE_RECT.flip());
PlumbingPieces.PRIMAL_HORIZONTAL_S = new PlumbingPiece(
    'PRIMAL_HORIZONTAL_S',
    Sockets.XPrimal,
    PRIMAL_COLOR,
    S_TEXTURE_RECT,
    localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(1, 0, 0), PRIMAL_COLOR));
PlumbingPieces.PRIMAL_HORIZONTAL_INIT = new PlumbingPiece(
    'PRIMAL_HORIZONTAL_INIT',
    Sockets.XPrimal,
    PRIMAL_COLOR,
    H_INIT_TEXTURE_RECT);
PlumbingPieces.PRIMAL_Z_INSPECT = new PlumbingPiece(
    'PRIMAL_Z_INSPECT',
    Sockets.ZPrimal,
    PRIMAL_COLOR,
    DISPLAY_TEXTURE_RECT,
    displayResult,
    () => new UnitCellSocketFootprint(new GeneralSet()));

PlumbingPieces.PRIMAL_BACKWARD = new PlumbingPiece(
    'PRIMAL_BACKWARD',
    Sockets.ZPrimal,
    PRIMAL_COLOR,
    V_ARROW_TEXTURE_RECT);
PlumbingPieces.PRIMAL_FOREWARD = new PlumbingPiece(
    'PRIMAL_FOREWARD',
    Sockets.ZPrimal,
    PRIMAL_COLOR,
    V_ARROW_TEXTURE_RECT.flip());
PlumbingPieces.PRIMAL_VERTICAL_S = new PlumbingPiece(
    'PRIMAL_VERTICAL_S',
    Sockets.ZPrimal,
    PRIMAL_COLOR,
    S_TEXTURE_RECT,
    localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(0, 0, 1), PRIMAL_COLOR));

PlumbingPieces.PRIMAL_UPWARD = new PlumbingPiece(
    'PRIMAL_UPWARD',
    Sockets.YPrimal,
    PRIMAL_COLOR);

PlumbingPieces.DUAL_RIGHTWARD = new PlumbingPiece(
    'DUAL_RIGHTWARD',
    Sockets.XDual,
    DUAL_COLOR,
    H_ARROW_TEXTURE_RECT);
PlumbingPieces.DUAL_LEFTWARD = new PlumbingPiece(
    'DUAL_LEFTWARD',
    Sockets.XDual,
    DUAL_COLOR,
    H_ARROW_TEXTURE_RECT.flip());
PlumbingPieces.DUAL_HORIZONTAL_S = new PlumbingPiece(
    'DUAL_HORIZONTAL_S',
    Sockets.XDual,
    DUAL_COLOR,
    S_TEXTURE_RECT,
    localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(1, 0, 0), DUAL_COLOR));

PlumbingPieces.DUAL_BACKWARD = new PlumbingPiece(
    'DUAL_BACKWARD',
    Sockets.ZDual,
    DUAL_COLOR,
    V_ARROW_TEXTURE_RECT);
PlumbingPieces.DUAL_FOREWARD = new PlumbingPiece(
    'DUAL_FOREWARD',
    Sockets.ZDual,
    DUAL_COLOR,
    V_ARROW_TEXTURE_RECT.flip(),
    undefined,
    undefined,
    propagateRightward);
PlumbingPieces.DUAL_VERTICAL_S = new PlumbingPiece(
    'DUAL_VERTICAL_S',
    Sockets.ZDual,
    DUAL_COLOR,
    S_TEXTURE_RECT,
    localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(0, 0, 1), DUAL_COLOR));
PlumbingPieces.DUAL_Z_INSPECT = new PlumbingPiece(
    'DUAL_Z_INSPECT',
    Sockets.ZDual,
    DUAL_COLOR,
    DISPLAY_TEXTURE_RECT,
    displayResult,
    () => new UnitCellSocketFootprint(new GeneralSet()));

PlumbingPieces.DUAL_UPWARD = new PlumbingPiece(
    'DUAL_UPWARD',
    Sockets.YDual,
    DUAL_COLOR);

PlumbingPieces.PRIMAL_CENTER = new PlumbingPiece(
    'PRIMAL_CENTER',
    Sockets.CPrimal,
    PRIMAL_COLOR);

PlumbingPieces.DUAL_CENTER = new PlumbingPiece(
    'DUAL_CENTER',
    Sockets.CDual,
    DUAL_COLOR,
    undefined,
    undefined,
    undefined,
    propagateRightward);

PlumbingPieces.All = [
    PlumbingPieces.PRIMAL_RIGHTWARD,
    PlumbingPieces.PRIMAL_BACKWARD,
    PlumbingPieces.PRIMAL_UPWARD,
    PlumbingPieces.PRIMAL_LEFTWARD,
    PlumbingPieces.PRIMAL_FOREWARD,
    PlumbingPieces.DUAL_RIGHTWARD,
    PlumbingPieces.DUAL_BACKWARD,
    PlumbingPieces.DUAL_UPWARD,
    PlumbingPieces.DUAL_LEFTWARD,
    PlumbingPieces.DUAL_FOREWARD,
    PlumbingPieces.DUAL_CENTER,
    PlumbingPieces.PRIMAL_CENTER,
    PlumbingPieces.PRIMAL_HORIZONTAL_S,
    PlumbingPieces.PRIMAL_VERTICAL_S,
    PlumbingPieces.DUAL_VERTICAL_S,
    PlumbingPieces.DUAL_HORIZONTAL_S,
    PlumbingPieces.PRIMAL_HORIZONTAL_INIT,
    PlumbingPieces.DUAL_Z_INSPECT,
    PlumbingPieces.PRIMAL_Z_INSPECT,
];

PlumbingPieces.BySocket = new GeneralMap();
for (let pp of PlumbingPieces.All) {
    PlumbingPieces.BySocket.getOrInsert(pp.socket, () => []).push(pp);
}

PlumbingPieces.ByName = seq(PlumbingPieces.All).keyedBy(e => e.name);
PlumbingPieces.forceGetByName = name => {
    let result = PlumbingPieces.ByName.get(name);
    if (result === undefined) {
        throw new DetailedError('Unknown plumbing piece.', {name});
    }
    return result;
};

PlumbingPieces.Defaults = new GeneralMap(
    [Sockets.XPrimal, PlumbingPieces.PRIMAL_RIGHTWARD],
    [Sockets.YPrimal, PlumbingPieces.PRIMAL_UPWARD],
    [Sockets.ZPrimal, PlumbingPieces.PRIMAL_BACKWARD],
    [Sockets.XDual, PlumbingPieces.DUAL_RIGHTWARD],
    [Sockets.YDual, PlumbingPieces.DUAL_UPWARD],
    [Sockets.ZDual, PlumbingPieces.DUAL_FOREWARD],
    [Sockets.CPrimal, PlumbingPieces.PRIMAL_CENTER],
    [Sockets.CDual, PlumbingPieces.DUAL_CENTER],
);

export {PlumbingPieces, PRIMAL_COLOR, DUAL_COLOR}
