import {Suite, assertThat, assertTrue, assertFalse, EqualsTester} from "test/TestUtil.js"

import {Axis} from "src/sim/util/Axis.js"

let suite = new Suite("Util");

suite.test('equals', () => {
    let eq = new EqualsTester();
    eq.assertAddGroup(Axis.X, new Axis(true));
    eq.assertAddGroup(Axis.Z, new Axis(false));
});

suite.test('toString', () => {
    assertThat(Axis.X.toString()).isEqualTo('X axis');
    assertThat(Axis.Z.toString()).isEqualTo('Z axis');
});

suite.test('is_xz', () => {
    assertTrue(Axis.X.is_x());
    assertTrue(Axis.Z.is_z());
    assertFalse(Axis.Z.is_x());
    assertFalse(Axis.X.is_z());
});

suite.test('opposite', () => {
    assertThat(Axis.X.opposite()).isEqualTo(Axis.Z);
    assertThat(Axis.Z.opposite()).isEqualTo(Axis.X);
});
