import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {Surface} from "src/sim/Surface.js"
import {XY} from "src/sim/XY.js";
import {Measurement} from "src/sim/Measurement.js";

let suite = new Suite("Surface");

suite.test('toggle_measure', () => {
    let r = new Surface(2, 2);
    r.toggle(new XY(0, 0));
    assertThat(r.measure(new XY(0, 0))).isEqualTo(new Measurement(true, false));
});
