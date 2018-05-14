import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {XY} from "src/sim/util/XY.js";
import {XYT} from "src/sim/util/XYT.js";
import {Axis} from "src/sim/util/Axis.js";
import {TileStack} from "src/sim/TileStack.js";
import {CONTROL, X_LEFT, Tile, TileColumn} from "src/sim/Tile.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {DirectedGraph} from "src/sim/util/DirectedGraph.js";
import {ControlledPauliMaps} from "src/sim/util/ControlledPauliMaps.js";
import {PauliMap} from "src/sim/util/PauliMap.js";
import {Surface} from "src/sim/Surface.js";
import {GeneralSet} from "src/base/GeneralSet.js";

let suite = new Suite("TileStack");

suite.test('feedforwardConvertsIntoPropagationUponMeasurement', () => {
    let tileStack = new TileStack();
    tileStack.startNewTile();
    tileStack.init(new XY(0, 0), Axis.X);
    tileStack.init(new XY(1, 0));
    tileStack.init(new XY(2, 0));

    tileStack.measure(new XY(0, 0));
    tileStack.feedforward_x(new XY(0, 0), new XY(1, 0));

    tileStack.measure(new XY(1, 0));
    tileStack.feedforward_x(new XY(1, 0), new XY(2, 0));

    assertThat(tileStack).isEqualTo(new TileStack(
        DirectedGraph.fromEdgeList([[new XYT(0, 0, 0), new XYT(1, 0, 0)]]),
        new ControlledPauliMaps(new GeneralMap(
            [new XYT(1, 0, 0), PauliMap.justFlipOf(new XY(2, 0), Axis.X)]
        )),
        [new Tile(
            new GeneralMap([new XY(0, 0), Axis.X], [new XY(1, 0), Axis.Z], [new XY(2, 0), Axis.Z]),
            new GeneralMap(),
            new GeneralMap([new XY(0, 0), Axis.Z], [new XY(1, 0), Axis.Z]))]));
});

suite.test('feedforwardIsPropagatedByCNOTs', () => {
    let tileStack = new TileStack();
    tileStack.startNewTile();
    let m = new XY(0, 0);
    let c = new XY(1, 0);
    let t = new XY(2, 0);
    tileStack.init(m, Axis.X);
    tileStack.init(c);
    tileStack.init(t);

    tileStack.measure(m);
    tileStack.feedforward_x(m, c);
    tileStack.cnot(c, t);

    assertThat(tileStack).isEqualTo(new TileStack(
        new DirectedGraph(),
        new ControlledPauliMaps(new GeneralMap(
            [new XYT(0, 0, 0), new PauliMap(new GeneralMap([c, PauliMap.XMask], [t, PauliMap.XMask]))]
        )),
        [new Tile(
            new GeneralMap([m, Axis.X], [c, Axis.Z], [t, Axis.Z]),
            new GeneralMap([c, new TileColumn([CONTROL])], [t, new TileColumn([X_LEFT])]),
            new GeneralMap([m, Axis.Z]))]));
});

suite.test('feedforwardIsPropagatedByStabilizerMeasurements', () => {
    let tileStack = new TileStack();
    tileStack.startNewTile();
    let m = new XY(0, 0);
    let t = new XY(1, 0);
    let s = new XY(2, 0);
    tileStack.init(m, Axis.X);
    tileStack.init(t);

    tileStack.measure(m);
    tileStack.feedforward_x(m, t);
    tileStack.measureStabilizers([], [s], xy => xy.isEqualTo(t) || xy.isEqualTo(s));

    assertThat(tileStack).isEqualTo(new TileStack(
        DirectedGraph.fromEdgeList([[new XYT(0, 0, 0), new XYT(2, 0, 0)]]),
        new ControlledPauliMaps(new GeneralMap(
            [new XYT(0, 0, 0), PauliMap.justFlipOf(t, Axis.X)])),
        [new Tile(
            new GeneralMap([m, Axis.X], [t, Axis.Z], [s, Axis.Z]),
            new GeneralMap([t, new TileColumn([CONTROL])], [s, new TileColumn([X_LEFT])]),
            new GeneralMap([m, Axis.Z], [s, Axis.Z]))]));
});

suite.test('doubleFeedforwardHasNoEffectOnStabilizer', () => {
    let surface = new Surface(2, 2);
    let t = new TileStack();
    t.startNewTile();
    t.init(new XY(8, 8), Axis.X);
    t.measure(new XY(8, 8), Axis.Z);
    t.feedforward_x(new XY(8, 8), new XY(0, 1));
    t.feedforward_x(new XY(8, 8), new XY(1, 0));
    t.measureEnabledStabilizers(surface, new GeneralSet());
    surface.destruct();
    assertThat(t.prop).isEqualTo(new DirectedGraph());
});
