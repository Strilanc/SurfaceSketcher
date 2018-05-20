/**
 * Creates all the plumbing piece types.
 */

import {DetailedError} from 'src/base/DetailedError.js'
import {seq} from "src/base/Seq.js";
import {PlumbingPiece} from "src/braid/PlumbingPiece.js";
import {
    Sockets,
    DUAL_FLAT_ENTER_INDEX,
    DUAL_FLAT_EXIT_INDEX,
    DUAL_FLAT_INTERIOR_INDEX,
    PRIMAL_FLAT_ENTER_INDEX,
    PRIMAL_FLAT_EXIT_INDEX,
    PRIMAL_FLAT_INTERIOR_INDEX,
} from "src/braid/Sockets.js";
import {UnitCellSocketFootprint} from "src/braid/UnitCellSocketFootprint.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {Rect} from "src/geo/Rect.js";
import {Config} from "src/Config.js";
import {polygonRenderData, pyramidRenderData, lineSegmentPathRenderData} from "src/draw/Shapes.js";
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
    SLAM_TEXTURE_RECT,
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
import {describe} from "src/base/Describe.js";
import {makeFlatGroup} from "src/braid/FlatPieceType.js";

class PlumbingPieces {
}

/**
 * @param {!{x: !number, y: !number, z: !number}} v
 * @returns {!string}
 */
function blochVecToKetText(v) {
    if (v.x === +1) {
        return '+';
    } else if (v.x === -1) {
        return '-';
    } else if (v.y === +1) {
        return '-i';
    } else if (v.y === -1) {
        return '+i';
    } else if (v.z === +1) {
        return '0';
    } else if (v.z === -1) {
        return '1';
    } else {
        return describe(v);
    }
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

/**
 * @param {!string} result
 * @returns {!Rect}
 */
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
 * @param {!XY} dir The direction to expand the hole along. Must be one of the unit cardinal directions.
 * @param {!int} distance The length of the ray to create (including the root location and skipped even qubits).
 * @param {!Axis} axis The hole type.
 */
function expandHoleAlongRay(tileStack, root, dir, distance, axis) {
    let op = axis.opposite();
    for (let i = 1; i < distance; i += 2) {
        let xy = root.plusScaled(dir, i);
        tileStack.measure(xy, axis);
        let c = xy.plus(dir);
        let p1 = c.plus(dir);
        let p2 = c.plus(dir.rotatedClockwise());
        let p3 = c.plus(dir.rotatedCounterClockwise());
        for (let p of [p1, p2, p3]) {
            if (!tileStack.lastTile().measurements.has(p)) {
                tileStack.feedforward_pauli(xy, p, op);
            }
        }
    }
}

/**
 * @param {!TileStack} tileStack Output object to append commands into.
 * @param {!XY} root
 * @param {!XY} sideDir
 * @param {!int} sideLength
 * @param {!XY} expandDir
 * @param {!int} expandLength
 * @param {!Axis} axis The hole type.
 * @param {!int} skip
 */
function expandHoleAlongSide(tileStack, root, sideDir, sideLength, expandDir, expandLength, axis, skip=0) {
    // Grow fingers.
    for (let i = skip; i < sideLength; i += 2) {
        expandHoleAlongRay(
            tileStack,
            root.plusScaled(sideDir, i),
            expandDir,
            expandLength,
            axis);
    }

    // Glue the fingers together.
    for (let i = skip + 1; i < sideLength; i += 2) {
        expandHoleAlongRay(
            tileStack,
            root.plus(expandDir).plusScaled(sideDir, i),
            expandDir,
            expandLength,
            axis.opposite());
    }
}

/**
 * @param {!TileStack} tileStack Output object to append commands onto.
 * @param {!int} xDown
 * @param {!int} xUp
 * @param {!int} yDown
 * @param {!int} yUp
 * @param {!XY} origin The location of the first measurement qubit to turn off. The full hole is made by propagating
 *     outward from this point. It determines how errors / observables are pushed around by the hole creation process.
 * @param {!Axis} axis The hole type.
 */
function startHoleWithPadding(tileStack, origin, xDown, xUp, yDown, yUp, axis) {
    let dirX = new XY(1, 0);
    let dirY = new XY(0, 1);
    let totalWidth = xDown + xUp - 1;

    // Make a complete row.
    expandHoleAlongRay(tileStack, origin, dirX, xUp, axis);
    expandHoleAlongRay(tileStack, origin, dirX.negate(), xDown, axis);

    // Expand row into a square.
    let sideRoot = origin.plusScaled(dirX, -xDown+1);
    expandHoleAlongSide(tileStack, sideRoot, dirX, totalWidth, dirY, yUp, axis);
    expandHoleAlongSide(tileStack, sideRoot, dirX, totalWidth, dirY.negate(), yDown, axis);
}

/**
 * @param {!TileStack} tileStack
 * @param {!Rect} foot
 * @param {!Axis} axis
 */
function startHoleByFootprint(tileStack, foot, axis) {
    let dx = Math.round(foot.w / 4) * 2;
    let dy = Math.round(foot.h / 4) * 2;
    startHoleWithPadding(
        tileStack,
        new XY(foot.x + dx, foot.y + dy),
        dx + 1,
        foot.w - dx,
        dy + 1,
        foot.h - dy,
        axis);
}

/**
 * @param {!TileStack} tileStack
 * @param {!Rect} foot
 * @param {!Axis} axis
 */
function endHoleByFootprint(tileStack, foot, axis) {
    let dataTargets = [];
    let xTargets = [];
    let zTargets = [];
    for (let i = 0; i < foot.w; i++) {
        for (let j = 0; j < foot.h; j++) {
            let xy = new XY(foot.x + i, foot.y + j);
            if ((xy.x & 1) !== 0 && ((xy.y & 1) !== 0)) {
                xTargets.push(xy);
            }
            if ((xy.x & 1) !== (xy.y & 1)) {
                dataTargets.push(xy);
            }
        }
    }
    tileStack.initAll(dataTargets, axis);
    tileStack.measureStabilizers(xTargets, zTargets, () => true);

    for (let i = 0; i < foot.w; i += 2) {
        for (let j = 0; j < foot.h - 2; j += 2) {
            let xy = new XY(foot.x + i, foot.y + j);
            tileStack.feedforward_pauli(xy, xy.offsetBy(0, 1), axis);
            tileStack.propagate(xy, xy.offsetBy(0, 2));
        }
    }
    for (let i = 0; i < foot.w - 2; i += 2) {
        let xy = new XY(foot.x + i, foot.y + foot.h - 1);
        tileStack.feedforward_pauli(xy, xy.offsetBy(1, 0), axis);
        tileStack.propagate(xy, xy.offsetBy(2, 0));
    }
}

/**
 * @param {!TileStack} tileStack
 * @param {!Rect} foot
 * @param {!Axis} axis
 * @param {!boolean} vertical
 */
function cutHoleByFootprint(tileStack, foot, axis, vertical) {
    let dataTargets = [];
    let xTargets = [];
    let zTargets = [];
    for (let i = 0; i < foot.w; i++) {
        for (let j = 0; j < foot.h; j++) {
            let xy = new XY(foot.x + i, foot.y + j);
            if ((xy.x & 1) !== 0 && ((xy.y & 1) !== 0)) {
                xTargets.push(xy);
            }
            if ((xy.x & 1) === 0 && ((xy.y & 1) === 0)) {
                zTargets.push(xy);
            }
            if ((xy.x & 1) !== (xy.y & 1)) {
                dataTargets.push(xy);
            }
        }
    }
    tileStack.initAll(dataTargets, axis);
    if (vertical) {
        tileStack.measureStabilizers(xTargets, zTargets, xy => xy.y >= foot.y && xy.y < foot.y + foot.h);
        for (let i = 0; i < foot.w; i += 2) {
            for (let j = 1; j < foot.h; j += 2) {
                let xy = new XY(foot.x + i, foot.y + j);
                tileStack.feedforward_pauli(xy, xy.offsetBy(0, 1), axis);
                if (j < foot.h - 2) {
                    tileStack.propagate(xy, xy.offsetBy(0, 2));
                }
            }
        }
    } else {
        tileStack.measureStabilizers(xTargets, zTargets, xy => xy.x >= foot.x && xy.x < foot.x + foot.w);
        for (let j = 0; j < foot.h; j += 2) {
            for (let i = 1; i < foot.w; i += 2) {
                let xy = new XY(foot.x + i, foot.y + j);
                tileStack.feedforward_pauli(xy, xy.offsetBy(1, 0), axis);
                if (i < foot.w - 2) {
                    tileStack.propagate(xy, xy.offsetBy(2, 0));
                }
            }
        }
    }
}

/**
 * @param {!SimulationLayout} layout
 * @param {!LocalizedPlumbingPiece} piece
 * @param {!int} codeDistance
 */
function* verticalObservable(layout, piece, codeDistance) {
    let footprint = piece.toSocketFootprintRect(codeDistance);
    for (let i = 1; i < footprint.h; i += 2) {
        yield layout.locToQubit(new XY(footprint.x, footprint.y + i));
    }
}

/**
 * @param {!SimulationLayout} layout
 * @param {!LocalizedPlumbingPiece} piece
 * @param {!int} codeDistance
 */
function* horizontalObservable(layout, piece, codeDistance) {
    let footprint = piece.toSocketFootprintRect(codeDistance);
    for (let i = 1; i < footprint.w; i += 2) {
        yield layout.locToQubit(new XY(footprint.x + i, footprint.y));
    }
}

/**
 * @param {!SimulationLayout} layout
 * @param {!LocalizedPlumbingPiece} piece
 * @param {!int} codeDistance
 */
function* observableAround(layout, piece, codeDistance) {
    let footprint = piece.toSocketFootprintRect(codeDistance);
    for (let i = 0; i < footprint.h; i += 2) {
        yield layout.locToQubit(new XY(footprint.x - 1, footprint.y + i));
        yield layout.locToQubit(new XY(footprint.x + footprint.w, footprint.y + i));
    }
    for (let i = 0; i < footprint.w; i += 2) {
        yield layout.locToQubit(new XY(footprint.x + i, footprint.y - 1));
        yield layout.locToQubit(new XY(footprint.x + i, footprint.y + footprint.h));
    }
}

/**
 * @param {!LocalizedPlumbingPiece} localizedPiece
 * @param {!SimulationResults} simResults
 * @returns {!Array.<!RenderData>}
 */
function displayObservableAroundBar(localizedPiece, simResults) {
    let box = localizedPiece.toBox();
    let quad = box.faceQuad(new Vector(0, 1, 0)).
        offsetBy(new Vector(0, box.diagonal.y / 2, 0));
    let ketRect = resultToKetRect(simResults.getDisplayVal(localizedPiece.loc, localizedPiece.socket));
    let displayQuads = [
        quad.offsetBy(quad.horizontal.scaledBy(-1)).swapLegs().flipVertical(),
        quad.offsetBy(quad.horizontal).swapLegs().flipHorizontal(),
        quad.offsetBy(quad.vertical),
        quad.offsetBy(quad.vertical.scaledBy(-1)).flipVertical().flipHorizontal(),
    ];
    let fillQuads = [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1]
    ].map(([dx, dy]) => quad.offsetBy(quad.horizontal.scaledBy(dx)).offsetBy(quad.vertical.scaledBy(dy)));
    return [
        localizedPiece.toRenderData(),
        ...displayQuads.map(q => q.toRenderData(Config.DisplayColor, ketRect, [0, 0, 0, 0])),
        ...fillQuads.map(q => q.toRenderData(Config.DisplayColor, undefined, [0, 0, 0, 0])),
    ];
}

/**
 * @param {!Surface} surface
 * @param {!Array.<!XY>} qubits
 * @param {!Axis} axis
 * @returns {!string}
 */
function peekObservableKetText(surface, qubits, axis) {
    /** @type {!Surface} */
    let tempClone = surface.clone();
    try {
        for (let i = 1; i < qubits.length; i++) {
            if (axis.is_z()) {
                tempClone.cnot(qubits[i], qubits[0]);
            } else {
                tempClone.cnot(qubits[0], qubits[i]);
            }
        }
        return blochVecToKetText(tempClone.peek_bloch_vector(qubits[0]));
    } finally {
        tempClone.destruct();
    }
}

/**
 * @param {!LocalizedPlumbingPiece} piece
 * @returns {!Array.<!RenderData>}
 */
function ringAroundRenderData(piece) {
    let box = piece.toBox();
    let c = box.center();
    let w = box.diagonal.x;
    let h = box.diagonal.z;
    return [
        piece.toRenderData(),
        lineSegmentPathRenderData(
            [
                c.plus(new Vector(w, 0, h)),
                c.plus(new Vector(w, 0, -h)),
                c.plus(new Vector(-w, 0, -h)),
                c.plus(new Vector(-w, 0, h))
            ],
            [1, 0, 0, 1],
            true)
    ];
}

const DEFAULT_FOOTPRINT = undefined;
const DEFAULT_RENDER = undefined;
const NO_EXTRA_SIMULATION_ACTIONS = undefined;
const NO_PROPAGATION = undefined;
const NO_FOOTPRINT = () => new UnitCellSocketFootprint(new GeneralSet());

let toggleFlatPieceGroup = makeFlatGroup(
    'Toggle',
    NO_FOOTPRINT,
    type => {
        let dir = type.dir();
        return piece => {
            let box = piece.toBox();
            return [lineSegmentPathRenderData(
                [box.faceQuad(dir.scaledBy(-1)).center(), box.faceQuad(dir).center()],
                [1, 0, 0, 1])];
        };
    },
    type => {
        let thresholdId = type.dual ? DUAL_FLAT_INTERIOR_INDEX : PRIMAL_FLAT_INTERIOR_INDEX;
        let observableMaker = type.horizontal ? horizontalObservable : verticalObservable;
        return (piece, layout, codeDistance, id) => surface => {
            if (id === thresholdId) {
                for (let q of observableMaker(layout, piece, codeDistance)) {
                    if (type.dual) {
                        surface.phase_toggle(q);
                    } else {
                        surface.toggle(q);
                    }
                }
            }
        }
    },
    NO_PROPAGATION);

PlumbingPieces.ZPrimalToggle = toggleFlatPieceGroup.ZPrimal;
PlumbingPieces.XPrimalToggle = toggleFlatPieceGroup.XPrimal;
PlumbingPieces.ZDualToggle = toggleFlatPieceGroup.ZDual;
PlumbingPieces.XDualToggle = toggleFlatPieceGroup.XDual;

let inspectFlatPieceGroup = makeFlatGroup(
    'Inspect',
    NO_FOOTPRINT,
    type => {
        return (localizedPiece, simResults) => {
            let quad = type.orientedTopFaceQuad(localizedPiece, 0.5);
            let ketRect = resultToKetRect(simResults.getDisplayVal(localizedPiece.loc, localizedPiece.socket));
            return [quad.toRenderData(Config.DisplayColor, ketRect, [0, 0, 0, 0])];
        };
    },
    type => {
        let observableMaker = type.horizontal ? horizontalObservable : verticalObservable;
        let axis = type.dual ? Axis.Z : Axis.X;
        return (piece, layout, codeDistance) => (surface, displays) => {
            let ketText = peekObservableKetText(surface, [...observableMaker(layout, piece, codeDistance)], axis);
            displays.getOrInsert(piece.loc, () => new GeneralMap()).set(piece.socket, ketText);
        };
    },
    NO_PROPAGATION);

PlumbingPieces.ZPrimalInspect = inspectFlatPieceGroup.ZPrimal;
PlumbingPieces.XPrimalInspect = inspectFlatPieceGroup.XPrimal;
PlumbingPieces.ZDualInspect = inspectFlatPieceGroup.ZDual;
PlumbingPieces.XDualInspect = inspectFlatPieceGroup.XDual;

let initFlatPieceGroup = makeFlatGroup(
    'Init',
    DEFAULT_FOOTPRINT,
    type => {
        let color = type.braidColor();
        let state = type.dual ? KET_OFF_RECT : KET_PLUS_RECT;
        return localizedPiece => {
            return [localizedPiece.toBox().toRenderData(color, state)];
        }
    },
    NO_EXTRA_SIMULATION_ACTIONS,
    type => {
        let enterThreshold = type.dual ? DUAL_FLAT_ENTER_INDEX : PRIMAL_FLAT_ENTER_INDEX;
        let exitThreshold = type.dual ? DUAL_FLAT_EXIT_INDEX : PRIMAL_FLAT_EXIT_INDEX;
        let axis = type.dual ? Axis.Z : Axis.X;
        return (tileStack, piece, codeDistance, id) => {
            if (id === enterThreshold) {
                let foot = piece.toSocketFootprintRect(codeDistance);
                startHoleByFootprint(tileStack, foot, axis);
            } else if (id === exitThreshold) {
                let foot = piece.toSocketFootprintRect(codeDistance);
                let s = codeDistanceToPipeSize(codeDistance);
                if (type.vertical) {
                    foot.y += s.h;
                    foot.h -= s.h * 2;
                } else {
                    foot.x += s.w;
                    foot.w -= s.w * 2;
                }
                cutHoleByFootprint(tileStack, foot, axis, type.vertical);
            }
        }
    });

PlumbingPieces.XPrimalInitPlus = initFlatPieceGroup.XPrimal;
PlumbingPieces.ZPrimalInitPlus = initFlatPieceGroup.ZPrimal;
PlumbingPieces.ZDualInitZero = initFlatPieceGroup.ZDual;
PlumbingPieces.XDualInitZero = initFlatPieceGroup.XDual;

let defaultFlatPieceGroup = makeFlatGroup(
    '', DEFAULT_FOOTPRINT, DEFAULT_RENDER, NO_EXTRA_SIMULATION_ACTIONS, NO_PROPAGATION);

PlumbingPieces.XPrimalDefault = defaultFlatPieceGroup.XPrimal;
PlumbingPieces.ZPrimalDefault = defaultFlatPieceGroup.ZPrimal;
PlumbingPieces.ZDualDefault = defaultFlatPieceGroup.ZDual;
PlumbingPieces.XDualDefault = defaultFlatPieceGroup.XDual;

// PlumbingPieces.XPrimalInjectS = new PlumbingPiece(
//     'PRIMAL_HORIZONTAL_S',
//     Sockets.XPrimal,
//     Config.BRAIDING_PRIMAL_COLOR,
//     S_TEXTURE_RECT,
//     localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(1, 0, 0), Config.BRAIDING_PRIMAL_COLOR));
// PlumbingPieces.ZPrimalInjectS = new PlumbingPiece(
//     'PRIMAL_VERTICAL_S',
//     Sockets.ZPrimal,
//     Config.BRAIDING_PRIMAL_COLOR,
//     S_TEXTURE_RECT,
//     localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(0, 0, 1), Config.BRAIDING_PRIMAL_COLOR));
// PlumbingPieces.XDualInjectS = new PlumbingPiece(
//     'DUAL_HORIZONTAL_S',
//     Sockets.XDual,
//     Config.BRAIDING_DUAL_COLOR,
//     S_TEXTURE_RECT,
//     localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(1, 0, 0), Config.BRAIDING_DUAL_COLOR));
// PlumbingPieces.ZDualInjectS = new PlumbingPiece(
//     'DUAL_VERTICAL_S',
//     Sockets.ZDual,
//     Config.BRAIDING_DUAL_COLOR,
//     S_TEXTURE_RECT,
//     localizedPiece => injectionSiteRenderData(localizedPiece, new Vector(0, 0, 1), Config.BRAIDING_DUAL_COLOR));

PlumbingPieces.TPrimalInspect = new PlumbingPiece(
    'TPrimalInspect',
    Sockets.YPrimal,
    Config.BRAIDING_PRIMAL_COLOR,
    DISPLAY_TEXTURE_RECT,
    displayObservableAroundBar,
    DEFAULT_FOOTPRINT,
    undefined,
    (piece, layout, codeDistance) => (surface, displays) => {
        let ketText = peekObservableKetText(surface, [...observableAround(layout, piece, codeDistance)], Axis.Z);
        displays.getOrInsert(piece.loc, () => new GeneralMap()).set(piece.socket, ketText);
    });
PlumbingPieces.TDualInspect = new PlumbingPiece(
    'TDualInspect',
    Sockets.YDual,
    Config.BRAIDING_DUAL_COLOR,
    DISPLAY_TEXTURE_RECT,
    displayObservableAroundBar,
    DEFAULT_FOOTPRINT,
    undefined,
    (piece, layout, codeDistance) => (surface, displays) => {
        let ketText = peekObservableKetText(surface, [...observableAround(layout, piece, codeDistance)], Axis.X);
        displays.getOrInsert(piece.loc, () => new GeneralMap()).set(piece.socket, ketText);
    });

PlumbingPieces.TPrimal = new PlumbingPiece(
    'PRIMAL_UPWARD',
    Sockets.YPrimal,
    Config.BRAIDING_PRIMAL_COLOR);

PlumbingPieces.ZDualMeasure = new PlumbingPiece(
    'ZDualMeasure',
    Sockets.ZDual,
    Config.BRAIDING_DUAL_COLOR,
    SLAM_TEXTURE_RECT,
    undefined,
    undefined,
    (tileStack, piece, codeDistance, id) => {
        if (id === DUAL_FLAT_EXIT_INDEX) {
            let foot = piece.toSocketFootprintRect(codeDistance);
            endHoleByFootprint(tileStack, foot, Axis.Z)
        }
    });
PlumbingPieces.TDualToggle = new PlumbingPiece(
    'TDualToggle',
    Sockets.YDual,
    Config.BRAIDING_DUAL_COLOR,
    undefined,
    ringAroundRenderData,
    undefined,
    undefined,
    (piece, layout, codeDistance, id) => surface => {
        if (id === PRIMAL_FLAT_INTERIOR_INDEX) {
            for (let q of observableAround(layout, piece, codeDistance)) {
                surface.toggle(q);
            }
        }
    });
PlumbingPieces.TPrimalToggle = new PlumbingPiece(
    'TPrimalToggle',
    Sockets.YPrimal,
    Config.BRAIDING_PRIMAL_COLOR,
    undefined,
    ringAroundRenderData,
    undefined,
    undefined,
    (piece, layout, codeDistance, id) => surface => {
        if (id === DUAL_FLAT_INTERIOR_INDEX) {
            for (let q of observableAround(layout, piece, codeDistance)) {
                surface.phase_toggle(q);
            }
        }
    });

PlumbingPieces.TDual = new PlumbingPiece(
    'DUAL_UPWARD',
    Sockets.YDual,
    Config.BRAIDING_DUAL_COLOR);

PlumbingPieces.CPrimal = new PlumbingPiece(
    'PRIMAL_CENTER',
    Sockets.CPrimal,
    Config.BRAIDING_PRIMAL_COLOR);

PlumbingPieces.CDual = new PlumbingPiece(
    'DUAL_CENTER',
    Sockets.CDual,
    Config.BRAIDING_DUAL_COLOR);

PlumbingPieces.All = [
    PlumbingPieces.TPrimal,
    PlumbingPieces.TDual,
    // PlumbingPieces.ZPrimalInjectS,
    // PlumbingPieces.ZDualInjectS,
    // PlumbingPieces.XDualInjectS,
    // PlumbingPieces.XPrimalInjectS,
    PlumbingPieces.CDual,
    PlumbingPieces.CPrimal,
    PlumbingPieces.ZDualMeasure,
    PlumbingPieces.TDualToggle,
    PlumbingPieces.TPrimalToggle,
    PlumbingPieces.TPrimalInspect,
    PlumbingPieces.TDualInspect,

    ...defaultFlatPieceGroup.All,
    ...initFlatPieceGroup.All,
    ...toggleFlatPieceGroup.All,
    ...inspectFlatPieceGroup.All,
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
    [Sockets.XPrimal, PlumbingPieces.XPrimalDefault],
    [Sockets.ZPrimal, PlumbingPieces.ZPrimalDefault],
    [Sockets.XDual, PlumbingPieces.XDualDefault],
    [Sockets.ZDual, PlumbingPieces.ZDualDefault],
    [Sockets.YPrimal, PlumbingPieces.TPrimal],
    [Sockets.YDual, PlumbingPieces.TDual],
    [Sockets.CPrimal, PlumbingPieces.CPrimal],
    [Sockets.CDual, PlumbingPieces.CDual],
);

export {PlumbingPieces}
