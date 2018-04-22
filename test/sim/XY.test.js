import {Suite, assertThat, EqualsTester} from "test/TestUtil.js"

import {XY} from "src/sim/XY.js"

let suite = new Suite("XY");

suite.test('constructor', () => {
    let m = new XY(2, 3, true);
    assertThat(m.x).isEqualTo(2);
    assertThat(m.y).isEqualTo(3);
    assertThat(m.must_be_active).isEqualTo(true);
});

suite.test('equality', () => {
    let eq = new EqualsTester();
    eq.assertAddGeneratedPair(() => new XY(1, 2, true));
    eq.assertAddGroup(new XY(5, 2, true));
    eq.assertAddGroup(new XY(1, 5, true));
    eq.assertAddGroup(new XY(1, 2, false));
});

suite.test('toString', () => {
    assertThat(new XY(1, 2).toString()).isEqualTo('(1, 2)');
    assertThat(new XY(1, 2, true).toString()).isEqualTo('(1, 2) [must be active]');
});

suite.test('neighbors', () => {
    assertThat(new XY(2, 5).neighbors()).isEqualTo([
        new XY(3, 5),
        new XY(1, 5),
        new XY(2, 6),
        new XY(2, 4),
    ])
});
