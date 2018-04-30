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
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {codeDistanceUnitCellSize, codeDistanceToPipeSize} from "src/braid/PlumbingPieces.js";

let INIT_0 = '0';
let INIT_PLUS = '+';
let MEASURE_Z = 'M';
let MEASURE_X = 'E';
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
    }

    get width() {
        return this.fixup.width;
    }

    get height() {
        return this.fixup.height;
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

        for (let x = 0; x < this.fixup.width; x++) {
            for (let y = 0; y < this.fixup.height; y++) {
                if (!this.grid[y][x].every(e => e === undefined)) {
                    wirePositions.push(pos(y, x, 0));
                    wirePositions.push(pos(y, x, d - 1));
                    let color = [0, 0, 0, 1];
                    if (this.grid[y][x][0] === INIT_0) {
                        color = [0, 1, 0, 1];
                    } else if (this.grid[y][x][0] === INIT_PLUS) {
                        color = [0, 0, 1, 1];
                    }
                    wireColors.push(color, color);
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

        for (let x = 0; x < this.fixup.width; x++) {
            for (let y = 0; y < this.fixup.height; y++) {
                let c = this.grid[y][x][layer];
                let target = x_dir(c);
                if (target !== undefined) {
                    let {x: dx, y: dy} = target;
                    subRenders.push(flatCrossedCircleRenderData(
                        pos(y, x),
                        0.006,
                        [0.8, 0.8, 0.8, 1],
                        [0, 0, 0, 1]));
                    wirePositions.push(pos(y, x));
                    wirePositions.push(pos(y + dy, x + dx));
                    wireColors.push([0, 0, 0, 1]);
                    wireColors.push([0, 0, 0, 1]);
                    wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);
                }

                switch (c) {
                    case CONTROL:
                        subRenders.push(new Sphere(pos(y, x), 0.003).toRenderData([0, 0, 0, 1]));
                        break;
                    case INIT_0:
                        subRenders.push(pyramidRenderData(pos(y, x), -0.01, [0, 1, 0, 1]));
                        break;
                    case INIT_PLUS:
                        subRenders.push(pyramidRenderData(pos(y, x), -0.01, [0, 0, 1, 1]));
                        break;
                    case MEASURE_Z:
                        subRenders.push(pyramidRenderData(pos(y, x), +0.01, [0, 1, 0, 1]));
                        break;
                    case MEASURE_X:
                        subRenders.push(pyramidRenderData(pos(y, x), +0.01, [0, 0, 1, 1]));
                        break;
                    case HADAMARD:
                        subRenders.push(new Sphere(pos(y, x), 0.01).toRenderData([0, 0, 1, 1]));
                        break;
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
     * @returns {!MeasurementAdjustment}
     */
    measure(target, axis=Axis.Z) {
        let result = this.fixup.measure(target, axis);
        let t = this.grid[target.y][target.x];
        t.push(axis.is_x() ? MEASURE_X : MEASURE_Z);
        return result;
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
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureAll(targets, axis=Axis.Z) {
        let result = new GeneralMap();
        for (let target of targets) {
            result.set(target, this.measure(target, axis));
        }
        return result;
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    reset(target, axis=Axis.Z) {
        let t = this.grid[target.y][target.x];
        t.push(axis.is_x() ? INIT_PLUS : INIT_0);
    }

    /**
     * @param {!Array.<!XY>} targets
     * @param {!Axis} axis
     */
    resetAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.reset(target, axis);
        }
    }

    /**
     * @param {!Surface} surface
     * @param {!Array.<!Array.<!boolean>>} disables
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureEnabledStabilizers(surface, disables) {
        let xTargets = [];
        let zTargets = [];
        for (let row = 0; row < disables.length; row++) {
            for (let col = 0; col < disables[row].length; col++) {
                let xy = new XY(col, row);
                if (!disables[row][col]) {
                    if (surface.is_x(xy)) {
                        xTargets.push(xy);
                    }
                    if (surface.is_z(xy)) {
                        zTargets.push(xy);
                    }
                }
            }
        }
        return this.measureStabilizers(xTargets, zTargets, xy => !disables[xy.y][xy.x]);
    }

    /**
     * @param {!Array.<!XY>} xTargets
     * @param {!Array.<!XY>} zTargets
     * @param {!function(!XY): !boolean} isEnabled
     * @returns {!GeneralMap.<!XY, !MeasurementAdjustment>}
     */
    measureStabilizers(xTargets, zTargets, isEnabled=() => true) {
        this.resetAll(xTargets, Axis.X);
        this.resetAll(zTargets, Axis.Z);

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

        let map1 = this.measureAll(xTargets, Axis.X);
        let map2 = this.measureAll(zTargets, Axis.Z);
        return new GeneralMap(...map1.entries(), ...map2.entries());
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

    toString() {
        let m = seq(this.grid).flatten().map(e => e.length).max();
        let rail = Seq.repeat('#', this.width + 2).join('');
        let planes = [];
        for (let z = 0; z < m; z++) {
            let rows = [rail];
            for (let row = 0; row < this.height; row++) {
                let cells = [];
                for (let col = 0; col < this.width; col++) {
                    let v = this.grid[row][col][z];
                    if (v === undefined) {
                        v = ' ';
                    }
                    cells.push(v === undefined ? ' ' : v);
                }
                rows.push('#' + cells.join('') + '#');
            }
            rows.push(rail);
            planes.push(rows.join('\n'));
        }

        let r = planes.join('\n\n').split('\n').join('\n    ');
        return `LockstepSurfaceLayer(grid=\n    ${r},\n\n    fixup=${this.fixup.toString()})`;
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

function flatCrossedCircleRenderData(center, radius, centerColor, borderColor) {
    const divisions = 16;

    let triPositions = [center];
    let triColors = [centerColor];
    let triIndices = [];
    let wirePositions = [];
    let wireColors = [];
    let wireIndices = [];
    for (let i = 0; i < divisions; i++) {
        let theta = i / divisions * Math.PI * 2;
        let x = Math.cos(theta);
        let z = Math.sin(theta);
        let pt = center.plus(new Vector(x, 0, z).scaledBy(radius));
        wirePositions.push(pt);
        triPositions.push(pt);
        wireIndices.push(i, (i + 1) % divisions);
        triIndices.push(0, 1 + i, 1 + (i + 1) % divisions);
        wireColors.push(borderColor);
        triColors.push(centerColor);
    }

    wirePositions.push(center.plus(new Vector(radius, 0, 0)));
    wirePositions.push(center.plus(new Vector(-radius, 0, 0)));
    wireColors.push(borderColor);
    wireColors.push(borderColor);
    wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);

    wirePositions.push(center.plus(new Vector(0, 0, radius)));
    wirePositions.push(center.plus(new Vector(0, 0, -radius)));
    wireColors.push(borderColor);
    wireColors.push(borderColor);
    wireIndices.push(wirePositions.length - 2, wirePositions.length - 1);

    return new RenderData(triPositions, triColors, triIndices,
        new RenderData(
            wirePositions,
            wireColors,
            wireIndices,
            undefined));
}

export {LockstepSurfaceLayer}
