import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {XY, Measurement} from "src/sim/Surface.js"

let suite = new Suite("Surface");

suite.test('xy_constructor', () => {
    let m = new XY(2, 3, true);
    assertThat(m.x).isEqualTo(2);
    assertThat(m.y).isEqualTo(3);
    assertThat(m.must_be_active).isEqualTo(true);
});

suite.test('xy_equality', () => {
    let a = new XY(1, 2, true);
    assertThat(a).isEqualTo(a);
    assertThat(a).isEqualTo(new XY(1, 2, true));
    assertThat(a).isNotEqualTo(new XY(5, 2, true));
    assertThat(a).isNotEqualTo(new XY(1, 5, true));
    assertThat(a).isNotEqualTo(new XY(1, 2, false));
    assertThat(a).isNotEqualTo('');
    assertThat(a).isNotEqualTo(undefined);
});

suite.test('xy_toString', () => {
    assertThat(new XY(1, 2).toString()).isEqualTo('(1, 2)');
    assertThat(new XY(1, 2, true).toString()).isEqualTo('(1, 2) [must be active]');
});

suite.test('measurement_constructor', () => {
    let m = new Measurement(false, true);
    assertThat(m.result).isEqualTo(false);
    assertThat(m.random).isEqualTo(true);
});
suite.test('measurement_equality', () => {
    let m = new Measurement(false, false);
    assertThat(m).isEqualTo(m);
    assertThat(m).isEqualTo(new Measurement(false, false));
    assertThat(m).isNotEqualTo(new Measurement(false, true));
    assertThat(m).isNotEqualTo(new Measurement(true, false));
    assertThat(m).isNotEqualTo('');
    assertThat(m).isNotEqualTo(undefined);
});

suite.test('measurement_toString', () => {
    assertThat(new Measurement(false, false).toString()).isEqualTo('false (determined)');
    assertThat(new Measurement(true, false).toString()).isEqualTo('true (determined)');
    assertThat(new Measurement(false, true).toString()).isEqualTo('false (random)');
    assertThat(new Measurement(true, true).toString()).isEqualTo('true (random)');
});
