import {Suite, assertThat, assertTrue, EqualsTester} from "test/TestUtil.js"
import {FixupOperation} from "src/sim/util/FixupOperation.js"
import {XY} from "src/sim/util/XY.js"
import {XYT} from "src/sim/util/XYT.js"

let suite = new Suite("FixupOperation");

suite.test("constructor", () => {
    let s = new FixupOperation(
        new XYT(1, 2, 3),
        [new XY(4, 5)],
        [new XY(6, 7)]);
    assertThat(s.condition).isEqualTo(new XYT(1, 2, 3));
    assertThat(s.x_targets).isEqualTo(new Set([new XY(4, 5).toString()]));
    assertThat(s.z_targets).isEqualTo(new Set([new XY(6, 7).toString()]));
});

suite.test("equals", () => {
    let eq = new EqualsTester();
    eq.assertAddGroup(new FixupOperation(), new FixupOperation(undefined, [], []));
    eq.assertAddGroup(
        new FixupOperation(new XYT(1, 2, 3), [new XY(4, 5)], [new XY(6, 7)]),
        new FixupOperation(new XYT(1, 2, 3), [new XY(4, 5).toString()], [new XY(6, 7).toString()]));
    eq.assertAddGroup(new FixupOperation(new XYT(1, 2, 9), [new XY(4, 5)], [new XY(6, 7)]));
    eq.assertAddGroup(new FixupOperation(new XYT(1, 2, 3), [], [new XY(6, 7)]));
    eq.assertAddGroup(new FixupOperation(new XYT(1, 2, 3), [new XY(4, 5)], []));
    eq.assertAddGroup(new FixupOperation(new XYT(1, 2, 3), [new XY(6, 7)], [new XY(4, 5)]));
});

suite.test("toString", () => {
    assertThat(new FixupOperation().toString()).isEqualTo('I');
    assertThat(new FixupOperation(new XYT(1, 2, 3)).toString()).isEqualTo('if measurement (1, 2) @ 3 then I');
    assertThat(new FixupOperation(undefined, [new XY(1, 2)]).toString()).isEqualTo('X_(1, 2)');
    assertThat(new FixupOperation(undefined, [], [new XY(1, 2)]).toString()).isEqualTo(
        'Z_(1, 2)');

    assertThat(new FixupOperation(new XYT(1, 2, 3), [new XY(4, 5)], [new XY(6, 7)]).toString()).isEqualTo(
        'if measurement (1, 2) @ 3 then X_(4, 5) * Z_(6, 7)');
});

suite.test("clone", () => {
    assertThat(new FixupOperation().toString()).isEqualTo('I');
    let s = new FixupOperation(new XYT(1, 2, 3), [new XY(4, 5)], [new XY(6, 7)]);
    let s2 = s.clone();
    assertThat(s2).isEqualTo(s);
    assertTrue(s.x_targets !== s2.x_targets);
    assertTrue(s.z_targets !== s2.z_targets);
    s.z_targets.add(new XY(8, 9).toString());
    assertThat(s2).isNotEqualTo(s);
});

suite.test("hadamard", () => {
    let s = new FixupOperation(undefined, [new XY(4, 5)], [new XY(6, 7)]);
    s.hadamard(new XY(4, 5));
    assertThat(s).isEqualTo(new FixupOperation(undefined, [], [new XY(4, 5), new XY(6, 7)]));
    s.hadamard(new XY(6, 7));
    assertThat(s).isEqualTo(new FixupOperation(undefined, [new XY(6, 7)], [new XY(4, 5)]));
    s.hadamard(new XY(4, 6));
    assertThat(s).isEqualTo(new FixupOperation(undefined, [new XY(6, 7)], [new XY(4, 5)]));
});

suite.test("cnot", () => {
    let a = new XY(3, 3);
    let x = new XY(1, 1);
    let z = new XY(2, 2);

    let s = new FixupOperation(undefined, [x], [z]);

    s.cnot(a, x);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [z]));
    s.cnot(a, z);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [a, z]));
    s.cnot(a, z);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [z]));

    s.cnot(z, a);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [z]));
    s.cnot(x, a);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [a, x], [z]));
    s.cnot(x, a);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [z]));

    s.cnot(z, x);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [z]));
    s.cnot(x, z);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x, z], [x, z]));
    s.cnot(x, z);
    assertThat(s).isEqualTo(new FixupOperation(undefined, [x], [z]));
});
