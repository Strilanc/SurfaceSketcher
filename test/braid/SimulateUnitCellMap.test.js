import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {
    makeClearXStabilizersTileStack,
    makeMeasureAllStabilizersTileStack,
    runSimulation
} from "src/braid/SimulateUnitCellMap.js"
import {Surface} from "src/sim/Surface.js";
import {XY} from "src/sim/util/XY.js";
import {XYT} from "src/sim/util/XYT.js";
import {Measurement} from "src/sim/Measurement.js";
import {TileStack} from "src/sim/TileStack.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {Axis} from "src/sim/util/Axis.js";
import {DirectedGraph} from "src/sim/util/DirectedGraph.js";

let suite = new Suite("SimulateUnitCellMap");

suite.test('makeMeasureAllStabilizersTileStack_stabilizes', () => {
    let surface = new Surface(2, 2);
    let tileStacks = [
        makeMeasureAllStabilizersTileStack(surface),
        makeMeasureAllStabilizersTileStack(surface)
    ];
    surface.destruct();

    let results = runSimulation(tileStacks, 0);

    let r = results.measurements.get(new XYT(1, 1, 0));
    assertTrue(r.random);
    assertThat(results.measurements.get(new XYT(0, 1, 0))).isEqualTo(undefined);
    assertThat(results.measurements.get(new XYT(1, 0, 0))).isEqualTo(undefined);
    assertThat(results.measurements.get(new XYT(0, 0, 0))).isEqualTo(new Measurement(false, false));

    assertThat(results.measurements.get(new XYT(1, 1, 1))).isEqualTo(new Measurement(r.result, false));
    assertThat(results.measurements.get(new XYT(0, 1, 1))).isEqualTo(undefined);
    assertThat(results.measurements.get(new XYT(1, 0, 1))).isEqualTo(undefined);
    assertThat(results.measurements.get(new XYT(0, 0, 1))).isEqualTo(new Measurement(false, false));
});

suite.test('makeClearXStabilizersTileStack', () => {
    let surface = new Surface(4, 4);
    let tileStacks = [
        makeClearXStabilizersTileStack(surface),
        makeMeasureAllStabilizersTileStack(surface)
    ];
    surface.destruct();

    let results = runSimulation(tileStacks, 0);
    for (let [xyt, measurement] of results.measurements.entries()) {
        if (xyt.t > 0) {
            assertThat(measurement).isEqualTo(new Measurement(false, false));
        }
    }
});

suite.test('introducingHoleDoesNotAffectRemoteStabilizers', () => {
    for (let hole of [new XY(2, 2), new XY(3, 3)]) {
        let surface = new Surface(5, 5);
        let t = makeClearXStabilizersTileStack(surface);
        t.startNewTile();
        t.measureEnabledStabilizers(surface, new GeneralSet(hole));
        surface.destruct();
        let result = runSimulation([t]);
        for (let i = 0; i < surface.width; i++) {
            for (let j = 0; j < surface.height; j++) {
                let xy = new XY(i, j);
                let m = result.measurements.get(new XYT(xy.x, xy.y, 1));
                if (surface.is_data(xy) || hole.isEqualTo(xy)) {
                    assertThat(m).withInfo({xy}).isEqualTo(undefined);
                } else {
                    assertThat(m).withInfo({xy}).isEqualTo(new Measurement(false, false));
                }
            }
        }
    }
});
