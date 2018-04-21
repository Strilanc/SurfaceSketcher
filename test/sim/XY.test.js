import {Suite, assertThat} from "test/TestUtil.js"

import {XY} from "src/sim/XY.js"

let suite = new Suite("XY");

suite.test('constructor', () => {
    let m = new XY(2, 3, true);
    assertThat(m.x).isEqualTo(2);
    assertThat(m.y).isEqualTo(3);
    assertThat(m.must_be_active).isEqualTo(true);
});

suite.test('equality', () => {
    let a = new XY(1, 2, true);
    assertThat(a).isEqualTo(a);
    assertThat(a).isEqualTo(new XY(1, 2, true));
    assertThat(a).isNotEqualTo(new XY(5, 2, true));
    assertThat(a).isNotEqualTo(new XY(1, 5, true));
    assertThat(a).isNotEqualTo(new XY(1, 2, false));
    assertThat(a).isNotEqualTo('');
    assertThat(a).isNotEqualTo(undefined);
});

suite.test('toString', () => {
    assertThat(new XY(1, 2).toString()).isEqualTo('(1, 2)');
    assertThat(new XY(1, 2, true).toString()).isEqualTo('(1, 2) [must be active]');
});
