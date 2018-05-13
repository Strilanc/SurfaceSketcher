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
