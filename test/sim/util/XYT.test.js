import {Suite, assertThat, EqualsTester} from "test/TestUtil.js"

import {XY} from "src/sim/util/XY.js"
import {XYT} from "src/sim/util/XYT.js"

let suite = new Suite("XYT");

suite.test('constructor', () => {
    let m = new XYT(2, 3, 5);
    assertThat(m.x).isEqualTo(2);
    assertThat(m.y).isEqualTo(3);
    assertThat(m.t).isEqualTo(5);
    assertThat(m.xy).isEqualTo(new XY(2, 3));
});

suite.test('equality', () => {
    let eq = new EqualsTester();
    eq.assertAddGeneratedPair(() => new XYT(1, 2, 3));
    eq.assertAddGroup(new XYT(5, 2, 3));
    eq.assertAddGroup(new XYT(1, 5, 3));
    eq.assertAddGroup(new XYT(1, 2, 5));
});

suite.test('toString', () => {
    assertThat(new XYT(1, 2, 3).toString()).isEqualTo('(1, 2) @ 3');
});
