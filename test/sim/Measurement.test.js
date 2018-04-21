import {Suite, assertThat} from "test/TestUtil.js"

import {Measurement} from "src/sim/Measurement.js"

let suite = new Suite("Measurement");

suite.test('constructor', () => {
    let m = new Measurement(false, true);
    assertThat(m.result).isEqualTo(false);
    assertThat(m.random).isEqualTo(true);
});
suite.test('equality', () => {
    let m = new Measurement(false, false);
    assertThat(m).isEqualTo(m);
    assertThat(m).isEqualTo(new Measurement(false, false));
    assertThat(m).isNotEqualTo(new Measurement(false, true));
    assertThat(m).isNotEqualTo(new Measurement(true, false));
    assertThat(m).isNotEqualTo('');
    assertThat(m).isNotEqualTo(undefined);
});

suite.test('toString', () => {
    assertThat(new Measurement(false, false).toString()).isEqualTo('false (determined)');
    assertThat(new Measurement(true, false).toString()).isEqualTo('true (determined)');
    assertThat(new Measurement(false, true).toString()).isEqualTo('false (random)');
    assertThat(new Measurement(true, true).toString()).isEqualTo('true (random)');
});
