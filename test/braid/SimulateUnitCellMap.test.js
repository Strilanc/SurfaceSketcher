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
import {SimulationLayout} from "src/braid/SimulationLayout.js";

let suite = new Suite("SimulateUnitCellMap");

suite.test('makeMeasureAllStabilizersTileStack_stabilizes', () => {
    let layout = new SimulationLayout(0, 1, 0, 1, 0, 1);
    let tileStacks = [
        makeMeasureAllStabilizersTileStack(layout),
        makeMeasureAllStabilizersTileStack(layout)
    ];

    let results = runSimulation(layout, tileStacks);

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
    let layout = new SimulationLayout(0, 3, 0, 3, 0, 1);
    let tileStacks = [
        makeClearXStabilizersTileStack(layout),
        makeMeasureAllStabilizersTileStack(layout)
    ];

    let results = runSimulation(layout, tileStacks);
    for (let [xyt, measurement] of results.measurements.entries()) {
        if (xyt.t > 0) {
            assertThat(measurement).isEqualTo(new Measurement(false, false));
        }
    }
});

suite.test('introducingHoleDoesNotAffectRemoteStabilizers', () => {
    for (let hole of [new XY(2, 2), new XY(3, 3)]) {
        let layout = new SimulationLayout(0, 4, 0, 4, 0, 1);
        let t = makeClearXStabilizersTileStack(layout);
        t.startNewTile();
        t.measureEnabledStabilizers(layout, new GeneralSet(hole));
        let result = runSimulation(layout, [t]);
        for (let x = layout.minX; x <= layout.maxX; x++) {
            for (let y = layout.minY; y <= layout.maxY; y++) {
                let xy = new XY(x, y);
                let m = result.measurements.get(new XYT(xy.x, xy.y, 1));
                if (layout.is_data(xy) || hole.isEqualTo(xy)) {
                    assertThat(m).withInfo({xy}).isEqualTo(undefined);
                } else {
                    assertThat(m).withInfo({xy}).isEqualTo(new Measurement(false, false));
                }
            }
        }
    }
});
