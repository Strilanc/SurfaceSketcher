/**
 * @param {!string} c
 * @returns {undefined|!XY}
 */
import {seq, Seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {Axis} from "src/sim/util/Axis.js";
import {DetailedError} from "src/base/DetailedError.js";
import {FixupLayer} from "src/sim/FixupLayer.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {RenderData} from "src/geo/RenderData.js";
import {Point} from "src/geo/Point.js";
import {Sphere} from "src/geo/Sphere.js";
import {indent} from "src/base/Util.js";
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {codeDistanceUnitCellSize, codeDistanceToPipeSize} from "src/braid/PlumbingPieces.js";
import {DirectedGraph} from "src/sim/util/DirectedGraph.js";
import {gridRangeToString} from "src/sim/util/Util.js";

let HADAMARD = 'H';
let CONTROL = 'C';
let X_RIGHT = '<';
let X_LEFT = '>';
let X_UP = 'v';
let X_DOWN = '^';

function qubitPosition(codeDistance, row, col, intraLayer, interLayer) {
    let {w: uw, h: uh} = codeDistanceUnitCellSize(codeDistance);
    let {w: pw, h: ph} = codeDistanceToPipeSize(codeDistance);
    let blockX = Math.floor(col / uw);
    let blockY = Math.floor(row / uh);
    let subX = col % uw;
    let subY = row % uh;
    let sw = Math.floor((uw - 2*pw)/4) * 2;
    let sh = Math.floor((uh - 2*ph)/4) * 2;
    let x = keyFrameLerp(subX, [0, 0], [pw, 0.2], [pw + sw, 0.5], [pw*2 + sw, 0.7], [uw, 1]);
    let y = keyFrameLerp(subY, [0, 0], [ph, 0.2], [ph + sh, 0.5], [ph*2 + sh, 0.7], [uh, 1]);
    return new Point(x + blockX, intraLayer*0.03 + interLayer*0.5, y + blockY)
}

function keyFrameLerp(k, ...keyframes) {
    for (let i = 0; i < keyframes.length - 1; i++) {
        let [k0, x0] = keyframes[i];
        let [k1, x1] = keyframes[i + 1];
        if (k0 <= k && k < k1) {
            return x0 + (k - k0 + 1) / (k1 - k0 + 1) * (x1 - x0);
        }
    }
    throw new DetailedError("Not covered.", {k, keyframes});
}

function x_dir(c) {
    switch (c) {
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

class LockstepSurfaceLayer {
    /**
     * @param {!FixupLayer} fixup
     */
    constructor(fixup) {
        this.fixup = fixup;
        this.grid = /** @type {!Array.<!Array.<!Array.<undefined|!string>>>} */ makeArrayGrid(
            fixup.width, fixup.height, () => []);
        this.initializations = /** @type {!GeneralMap.<!XY, !Axis>} */ new GeneralMap();
        this.measurements = /** @type {!GeneralMap.<!XY, !Axis>} */ new GeneralMap();
    }

    get width() {
        return this.fixup.width;
    }

    get height() {
        return this.fixup.height;
    }

    /**
     * @returns {!Array.<!XY>}
     */
    xys() {
        let result = [];
        for (let x = 0; x < this.fixup.width; x++) {
            for (let y = 0; y < this.fixup.height; y++) {
                result.push(new XY(x, y));
            }
        }
        return result;
    }

    /**
     * @param {!int} k
     * @param {!int} codeDistance
     * @returns {!Array.<!RenderData>}
     */
    toInterLayerRenderDatas(k, codeDistance) {
        let pos = (row, col, layer) => qubitPosition(codeDistance, row, col, layer, k);

        let positions = [];
        let colors = [];
        let triangleIndices = [];

        let wirePositions = [];
        let wireColors = [];
        let wireIndices = [];

        let subRenders = [];
        let d = this.depth();

        // Draw initializations.
        for (let xy of this.xys()) {
            let init = this.initializations.get(xy);
            if (init !== undefined) {
                if (init.is_z()) {
                    subRenders.push(pyramidRenderData(pos(xy.y, xy.x, -1), -0.01, [0, 1, 0, 1]));
                } else {
                    subRenders.push(pyramidRenderData(pos(xy.y, xy.x, -1), -0.01, [0, 0, 1, 1]));
                }
            }

            let measure = this.measurements.get(xy);
            if (measure !== undefined) {
                if (measure.is_z()) {
                    subRenders.push(pyramidRenderData(pos(xy.y, xy.x, d), +0.01, [0, 1, 0, 1]));
                } else {
                    subRenders.push(pyramidRenderData(pos(xy.y, xy.x, d), +0.01, [0, 0, 1, 1]));
                }
            }
        }

        for (let {x, y} of this.xys()) {
            if (this.grid[y][x].every(e => e === undefined)) {
                continue;
            }

            wirePositions.push(pos(y, x, -1));
            wirePositions.push(pos(y, x, d));
            let color;
            let initVal = this.initializations.get(new XY(x, y));
            if (initVal === undefined) {
                color = [0, 0, 0, 1];
            } else if (initVal.is_z()) {
                color = [0, 1, 0, 1];
            } else if (initVal.is_x()) {
                color = [0, 0, 1, 1];
            } else  {
                color = [1, 0, 0, 1];
            }
            wireColors.push(color, color);
            wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);
        }

        for (let op of this.fixup._ops) {
            if (op.condition !== undefined) {
                for (let t of op.x_targets) {
                    wirePositions.push(pos(t.y, t.x, d - 1));
                    wirePositions.push(pos(op.condition.y, op.condition.x, d + 1));
                    wireColors.push([1, 0, 0, 1], [1, 0, 0, 1]);
                    wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);
                }
            }
        }

        return [...subRenders,
            new RenderData(
                positions,
                colors,
                triangleIndices,
                new RenderData(
                    wirePositions,
                    wireColors,
                    wireIndices,
                    undefined))];
    }

    /**
     * @param {!int} layer
     * @param {!int} k
     * @param {!int} codeDistance
     * @returns {!Array.<!RenderData>}
     */
    toIntraLayerRenderDatas(layer, k, codeDistance) {
        let pos = (row, col) => qubitPosition(codeDistance, row, col, layer, k);

        let positions = [];
        let colors = [];
        let triangleIndices = [];

        let wirePositions = [];
        let wireColors = [];
        let wireIndices = [];

        let subRenders = [];

        for (let {x, y} of this.xys()) {
            let c = this.grid[y][x][layer];
            let target = x_dir(c);
            if (target !== undefined) {
                let {x: dx, y: dy} = target;

                subRenders.push(flatCrossedCircleRenderData(
                    pos(y, x),
                    target.x,
                    target.y,
                    0.006,
                    [0.9, 0.9, 0.9, 1],
                    [0, 0, 0, 1]));

                subRenders.push(flatCrossedCircleRenderData(
                    pos(y + target.y, x + target.x),
                    -target.x,
                    -target.y,
                    0.002,
                    [0, 0, 0, 1],
                    undefined));

                wirePositions.push(pos(y, x));
                wirePositions.push(pos(y + dy, x + dx));
                wireColors.push([0, 0, 0, 1]);
                wireColors.push([0, 0, 0, 1]);
                wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);
            }

            switch (c) {
                case HADAMARD:
                    subRenders.push(new Sphere(pos(y, x), 0.01).toRenderData([0, 0, 1, 1]));
                    break;
            }
        }

        return [...subRenders,
            new RenderData(
                positions,
                colors,
                triangleIndices,
                new RenderData(
                    wirePositions,
                    wireColors,
                    wireIndices,
                    undefined))];
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        this.fixup.cnot(control, target);
        let c = this.grid[control.y][control.x];
        let t = this.grid[target.y][target.x];
        if (target.isEqualTo(control.rightNeighbor())) {
            padPush(c, t, CONTROL, X_LEFT);
        } else if (target.isEqualTo(control.leftNeighbor())) {
            padPush(c, t, CONTROL, X_RIGHT);
        } else if (target.isEqualTo(control.aboveNeighbor())) {
            padPush(c, t, CONTROL, X_DOWN);
        } else if (target.isEqualTo(control.belowNeighbor())) {
            padPush(c, t, CONTROL, X_UP);
        } else {
            throw new DetailedError('Long-distance cnot.', {control, target});
        }
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        this.fixup.hadamard(target);
        let t = this.grid[target.y][target.x];
        t.push(HADAMARD);
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    measure(target, axis=Axis.Z) {
        this.fixup.measure(target, axis);
        this.measurements.set(target, axis);
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     * @private
     */
    _inRange(xy) {
        let {x, y} = xy;
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    /**
     * @param {!Array.<!XY>} targets
     */
    hadamardAll(targets) {
        for (let target of targets) {
            this.hadamard(target);
        }
    }

    /**
     * @param {!Array.<!XY>} targets
     * @param {!Axis} axis
     */
    measureAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.measure(target, axis);
        }
    }

    /**
     * @param {!Array.<!XY>} targets
     * @param {!Axis} axis
     */
    initAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.initializations.set(target, axis);
        }
    }

    /**
     * @param {!Surface} surface
     * @param {!GeneralSet.<!XY>} disables
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureEnabledStabilizers(surface, disables) {
        let xTargets = [];
        let zTargets = [];
        for (let row = 0; row < surface.height; row++) {
            for (let col = 0; col < surface.width; col++) {
                let xy = new XY(col, row);
                if (!disables.has(xy)) {
                    if (surface.is_x(xy)) {
                        xTargets.push(xy);
                    }
                    if (surface.is_z(xy)) {
                        zTargets.push(xy);
                    }
                }
            }
        }
        return this.measureStabilizers(xTargets, zTargets, xy => !disables.has(xy));
    }

    /**
     * @param {!Array.<!XY>} xTargets
     * @param {!Array.<!XY>} zTargets
     * @param {!function(!XY): !boolean} isEnabled
     */
    measureStabilizers(xTargets, zTargets, isEnabled=() => true) {
        this.initAll(xTargets, Axis.X);
        this.initAll(zTargets, Axis.Z);

        for (let i = 0; i < 4; i++) {
            for (let xTarget of xTargets) {
                let n = xTarget.neighbors()[i];
                if (this._inRange(n) && isEnabled(n)) {
                    this.cnot(xTarget, n);
                }
            }
            if (i < 2) {
                this.padAllToDepth();
            }
        }
        for (let i = 0; i < 4; i++) {
            for (let zTarget of zTargets) {
                let n = zTarget.neighbors()[i ^ 2];
                if (this._inRange(n) && isEnabled(n)) {
                    this.cnot(n, zTarget);
                }
            }
            if (i >= 2) {
                this.padAllToDepth();
            }
        }

        this.measureAll(xTargets, Axis.X);
        this.measureAll(zTargets, Axis.Z);
    }

    padAllToDepth() {
        let d = this.depth();
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                let m = this.grid[y][x];
                while (m.length < d) {
                    m.push(undefined);
                }
            }
        }
    }

    /**
     * @returns {!int}
     */
    depth() {
        return seq(this.grid).flatten().map(e => e.length).max();
    }

    /**
     * @returns {!string}
     */
    toString() {
        let m = seq(this.grid).flatten().map(e => e.length).max();
        let planes = [];
        planes.push(gridRangeToString(0, this.height - 1, 0, this.width - 1, (row, col) => {
            let init = this.initializations.get(new XY(col, row));
            if (init === undefined) {
                return ' ';
            } else if (init.is_z()) {
                return '0';
            } else {
                return '+';
            }
        }));
        for (let z = 0; z < m; z++) {
            planes.push(gridRangeToString(0, this.height - 1, 0, this.width - 1, (row, col) => this.grid[row][col][z]));
        }
        planes.push(gridRangeToString(0, this.height - 1, 0, this.width - 1, (row, col) => {
            let init = this.measurements.get(new XY(col, row));
            if (init === undefined) {
                return ' ';
            } else if (init.is_z()) {
                return 'M';
            } else {
                return 'E';
            }
        }));

        let planeText = planes.join('\n\n');
        let fixupText = this.fixup.toString();
        return `LockstepSurfaceLayer(grid=\n${indent(planeText)},\n\n${indent('fixup=' + fixupText)})`;
    }
}

/**
 * @param {!Array.<T>} array1
 * @param {!Array.<T>} array2
 * @param {T} item1
 * @param {T} item2
 * @param {T} pad
 * @template T
 */
function padPush(array1, array2, item1, item2, pad=undefined) {
    while (array1.length < array2.length) {
        array1.push(pad);
    }
    while (array2.length < array1.length) {
        array2.push(pad);
    }
    array1.push(item1);
    array2.push(item2);
}

/**
 * @param {!Point} tip
 * @param {!number} height
 * @param {![!number, !number, !number, !number]} color
 * @returns {!RenderData}
 */
function pyramidRenderData(tip, height, color) {
    let points = [
        tip,
        tip.plus(new Vector(height, height, height)),
        tip.plus(new Vector(height, height, -height)),
        tip.plus(new Vector(-height, height, -height)),
        tip.plus(new Vector(-height, height, height)),
    ];
    let colors = [color, color, color, color, color];
    let indices = [
        0, 1, 2,
        0, 2, 3,
        0, 3, 4,
        0, 4, 1,
    ];
    return new RenderData(points, colors, indices, new RenderData([], [], [], undefined));
}

/**
 * @param {!Point} center
 * @param {!int} dx
 * @param {!int} dz
 * @param {!number} radius
 * @param {![!number, !number, !number, !number]} centerColor
 * @param {![!number, !number, !number, !number]}borderColor
 * @returns {!RenderData}
 */
function flatCrossedCircleRenderData(center, dx, dz, radius, centerColor, borderColor) {
    const divisions = 16;

    let triPositions = [center];
    let triColors = [centerColor];
    let triIndices = [];
    let wirePositions = [];
    let wireColors = [];
    let wireIndices = [];
    for (let i = 0; i < divisions; i++) {
        let theta = i / divisions * Math.PI * 2;
        let y = Math.cos(theta);
        let xz = Math.sin(theta);
        let pt = center.plus(new Vector(xz*dx, y, xz*dz).scaledBy(radius));
        triPositions.push(pt);
        triIndices.push(0, 1 + i, 1 + (i + 1) % divisions);
        triColors.push(centerColor);

        if (borderColor !== undefined) {
            wirePositions.push(pt);
            wireIndices.push(i, (i + 1) % divisions);
            wireColors.push(borderColor);
        }
    }

    if (borderColor !== undefined) {
        wirePositions.push(center.plus(new Vector(radius * dx, 0, radius * dz)));
        wirePositions.push(center.plus(new Vector(-radius * dx, 0, -radius * dz)));
        wireColors.push(borderColor);
        wireColors.push(borderColor);
        wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);

        wirePositions.push(center.plus(new Vector(0, radius, 0)));
        wirePositions.push(center.plus(new Vector(0, -radius, 0)));
        wireColors.push(borderColor);
        wireColors.push(borderColor);
        wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);
    }

    return new RenderData(triPositions, triColors, triIndices,
        new RenderData(
            wirePositions,
            wireColors,
            wireIndices,
            undefined));
}

export {LockstepSurfaceLayer}
