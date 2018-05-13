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
    feedforward_x(control, target) {
        this.feed.feedforward_x(this.measurementOnLastTileAt(control), target);
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    feedforward_z(control, target) {
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
        for (let xyt of this.prop.topologicalOrder()) {
            if (measurements.get(xyt).result) {
                for (let xyt2 of this.prop.outEdges(xyt)) {
                    let m3 = measurements.get(xyt2);
                    m3.result = !m3.result;
                }
            }
        }

        // Quantum propagation.
        for (let [control, feed] of this.feed._pauliMaps.entries()) {
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
            let controlEffects = tile.pauliMapForControl(control);
            let flips = controlEffects.flips(target, axis);

            controlEffects.set(target, 0);
            if (flips) {
                this.prop.includeEdge(control, id);
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
            let controlEffects = tile.pauliMapForControl(control);
            controlEffects.set(target, 0);
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
        return this.lastTile().measureStabilizers(xTargets, zTargets, xy => avail.has(xy) && !disables.has(xy));
    }
}

export {TileStack}
