/**
 * @param {!string} c
 * @returns {undefined|!XY}
 */
import {seq, Seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {Axis} from "src/sim/util/Axis.js";
import {DetailedError} from "src/base/DetailedError.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {makeArrayGrid} from "src/sim/util/Util.js";
import {RenderData} from "src/geo/RenderData.js";
import {Point} from "src/geo/Point.js";
import {Sphere} from "src/geo/Sphere.js";
import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {codeDistanceUnitCellSize, codeDistanceToPipeSize} from "src/braid/CodeDistance.js";
import {DirectedGraph} from "src/sim/util/DirectedGraph.js";
import {XYT} from "src/sim/util/XYT.js";
import {equate_Iterables} from "src/base/Equate.js";
import {PauliMap} from "src/sim/util/PauliMap.js";
import {Tile} from "src/sim/Tile.js";
import {ControlledPauliMaps} from "src/sim/util/ControlledPauliMaps.js";
import {GeneralSet} from "src/base/GeneralSet.js";

/**
 * A TileStack is a mergeable unit of parallel quantum computation, including the details needed to compute an eventual
 * Pauli frame when running the computation with lag in the control loop.
 */
class TileStack {
    /**
     * @param {!DirectedGraph.<!XYT>} prop The classical control propagation graph. Determines which measurements toggle
     *     which other measurements.
     * @param {!ControlledPauliMaps} feed The pauli fixup feedforward control layer. Determines which measurement
     *     results need to toggle or phase toggle which qubits.
     * @param {!Array.<!Tile>} tiles A series of fixed-depth command chunks representing what the quantum computer
     *     will actually be told to do.
     */
    constructor(prop=new DirectedGraph(), feed=new ControlledPauliMaps(), tiles=[]) {
        /** @type {!DirectedGraph.<!XYT>} */
        this.prop = prop;
        /** @type {!ControlledPauliMaps} */
        this.feed = feed;
        /** @type {!Array.<!Tile>} */
        this.tiles = tiles;
    }

    /**
     * @returns {!Tile}
     */
    lastTile() {
        return this.tiles[this.tiles.length - 1];
    }

    startNewTile() {
        this.tiles.push(new Tile());
    }

    /**
     * @param {!XY} xy
     */
    measurementOnLastTileAt(xy) {
        if (!this.lastTile().measurements.has(xy)) {
            throw new DetailedError('Not measured yet.', {xy});
        }
        return new XYT(xy.x, xy.y, this.tiles.length - 1);
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    propagate(control, target) {
        this.prop.toggleEdge(this.measurementOnLastTileAt(control), this.measurementOnLastTileAt(target));
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     * @param {!Axis} axis
     */
    feedforward_pauli(control, target, axis) {
        if (axis.is_z()) {
            this.feedforward_z(control, target);
        } else {
            this.feedforward_x(control, target);
        }
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    feedforward_x(control, target) {
        if (this.lastTile().measurements.has(target)) {
            throw new DetailedError('Already measured.', {target});
        }
        this.feed.feedforward_x(this.measurementOnLastTileAt(control), target);
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    feedforward_z(control, target) {
        if (this.lastTile().measurements.has(target)) {
            throw new DetailedError('Already measured.', {target});
        }
        this.feed.feedforward_z(this.measurementOnLastTileAt(control), target);
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        this.feed.cnot(control, target);
        this.lastTile().cnot(control, target);
    }

    /**
     * @param {!Surface} surface
     * @param {!int} tileIndex
     * @param {!GeneralMap.<!XYT, !Measurement>} measurementResultsOut
     */
    simulateOn(surface, tileIndex, measurementResultsOut) {
        let measurements = new GeneralMap();
        for (let i = 0; i < this.tiles.length; i++) {
            this.tiles[i].simulateOn(surface, i, measurements);
        }

        // Classical propagation.
        for (let control of this.prop.topologicalOrder()) {
            if (measurements.get(control).result) {
                for (let target of this.prop.outEdges(control)) {
                    let targetMeasurement = measurements.get(target);
                    targetMeasurement.result = !targetMeasurement.result;
                }
            }
        }

        // Quantum propagation.
        for (let [control, feed] of this.feed.entries()) {
            if (measurements.get(control).result) {
                for (let [target, mask] of feed.operations.entries()) {
                    if ((PauliMap.ZMask & mask) !== 0) {
                        surface.phase(target);
                        surface.phase(target);
                    }
                    if ((PauliMap.XMask & mask) !== 0) {
                        surface.hadamard(target);
                        surface.phase(target);
                        surface.phase(target);
                        surface.hadamard(target);
                    }
                }
            }
            feed.targets()
        }

        let result = measurements.mapKeys(xyt => new XYT(xyt.x, xyt.y, xyt.t + tileIndex));
        for (let [key, val] of result.entries()) {
            measurementResultsOut.set(key, val);
        }
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    measure(target, axis=Axis.Z) {
        let id = new XYT(target.x, target.y, this.tiles.length - 1);
        let tile = this.lastTile();
        tile.measure(target, axis);

        // Move effects on the target out of quantum feedforward and into classical propagation.
        for (let control of this.feed.controlsAffecting(target)) {
            let controlEffects = this.feed.pauliMapForControl(control);
            let flips = controlEffects.flips(target, axis);

            controlEffects.set(target, 0);
            this.feed.syncTargetToControlsFor(target, control);
            if (flips) {
                this.prop.toggleEdge(control, id);
            }
        }
    }

    /**
     * @param {!XY} target
     * @param {!Axis} axis
     */
    init(target, axis=Axis.Z) {
        let tile = this.lastTile();
        tile.init(target, axis);

        // Drop feedforward effects on the target.
        for (let control of this.feed.controlsAffecting(target)) {
            let controlEffects = this.feed.pauliMapForControl(control);
            controlEffects.set(target, 0);
            controlEffects.syncTargetToControlsFor(target, control);
        }
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        this.feed.hadamard(target);
        this.lastTile().hadamard(target);
    }

    /**
     * @param {!XY} target
     */
    pauli_x(target) {
        this.lastTile().pauli_x(target);
    }

    /**
     * @param {!XY} target
     */
    pauli_z(target) {
        this.lastTile().pauli_x(target);
    }

    /**
     * @returns {!{minX: !int, minY: !int, maxX: !int, maxY: !int}}
     */
    bounds() {
        let minX = 0;
        let minY = 0;
        let maxX = 0;
        let maxY = 0;
        let update = xy => {
            minX = Math.min(xy.x, minX);
            minY = Math.min(xy.x, minY);
            maxX = Math.min(xy.x, maxX);
            maxY = Math.min(xy.x, maxY);
        };

        for (let tile of this.tiles) {
            let e = tile.bounds();
            update(new XY(e.minX, e.minY));
            update(new XY(e.maxX, e.maxY));
        }
        for (let xyt of this.prop.nodes()) {
            update(xyt.xy);
        }
        for (let entry of this.feed.entries()) {
            for (let xy of entry[1].targets()) {
                update(xy);
            }
        }

        return {minX, minY, maxX, maxY};
    }

    /**
     * Returns a combined tile formed by first applying this tile, and then the given next tile.
     * @param {!TileStack} nextTile The tile to concatenate on to this one.
     * @returns {!TileStack} The combined tile.
     */
    then(nextTile) {
        let dt = this.tiles.length;
        let commands = [...this.tiles, nextTile.tiles];
        let tick = xyt => new XYT(xyt.x, xyt.y, xyt.t + dt);

        let prop = nextTile.prop.mapKeys(tick);
        prop.inline_union(this.prop);

        let feed = nextTile.feed.mapControls(tick);
        feed.inline_union(this.feed);

        return new TileStack(prop, feed, commands);
    }

    /**
     * @param {!TileStack|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof TileStack &&
            this.prop.isEqualTo(other.prop) &&
            this.feed.isEqualTo(other.feed) &&
            equate_Iterables(this.tiles, other.tiles);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `TileStack(prop=${this.prop}, feed=${this.feed}, tiles=${this.tiles})`;
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
    initAll(targets, axis=Axis.Z) {
        for (let target of targets) {
            this.init(target, axis);
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
        let avail = new GeneralSet();
        for (let row = 0; row < surface.height; row++) {
            for (let col = 0; col < surface.width; col++) {
                let xy = new XY(col, row);
                if (!disables.has(xy)) {
                    if (surface.is_x(xy)) {
                        xTargets.push(xy);
                        avail.add(xy);
                    } else if (surface.is_z(xy)) {
                        zTargets.push(xy);
                        avail.add(xy);
                    } else if (surface.is_data(xy)) {
                        avail.add(xy);
                    }
                }
            }
        }
        return this.measureStabilizers(xTargets, zTargets, xy => avail.has(xy) && !disables.has(xy));
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
                if (isEnabled(n)) {
                    this.cnot(xTarget, n);
                }
            }
            if (i < 2) {
                this.lastTile().padAllToDepth();
            }
        }
        for (let i = 0; i < 4; i++) {
            for (let zTarget of zTargets) {
                let n = zTarget.neighbors()[i ^ 2];
                if (isEnabled(n)) {
                    this.cnot(n, zTarget);
                }
            }
            if (i >= 2) {
                this.lastTile().padAllToDepth();
            }
        }

        this.measureAll(xTargets, Axis.X);
        this.measureAll(zTargets, Axis.Z);
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
}

export {TileStack}
