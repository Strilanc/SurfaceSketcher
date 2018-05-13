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
import {RenderData} from "src/geo/RenderData.js";
import {codeDistanceToPipeSeparation, codeDistanceToPipeSize} from "src/braid/CodeDistance.js";
import {XYT} from "src/sim/util/XYT.js";
import {XY} from "src/sim/util/XY.js";

const PRIMAL_COLOR = [0.9, 0.9, 0.9, 1.0];
const DUAL_COLOR = [0.4, 0.4, 0.4, 1.0];

class PlumbingPieces {
}

/**
 * @param {!LocalizedPlumbingPiece} localizedPiece
 * @param {!Vector} d
 * @param {![!number, !number, !number, !number]} color
 * @returns {!Array.<!RenderData>}
 */
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
 * @param {!TileStack} tileStack
 * @param {!int} codeDistance
 * @param {!int} dx
 * @param {!int} dy
 */
function propagateRightward(tileStack, codeDistance, dx, dy) {
    let {w, h} = codeDistanceToPipeSize(codeDistance);
    let s = codeDistanceToPipeSeparation(codeDistance);
    for (let j = 0; j < h; j += 2) {
        for (let i = 1; i < s; i += 2) {
            let x = i + w + dx;
            let y = j + dy;
            tileStack.feedforward_x(new XY(x, y), new XY(x + 2, y));
        }
    }
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
    undefined,
    propagateRightward);
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
    V_ARROW_TEXTURE_RECT.flip());
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
    displayResult);

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
    DUAL_COLOR);

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

export {PlumbingPieces}
