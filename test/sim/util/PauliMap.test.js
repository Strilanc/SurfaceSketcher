import {Suite, assertThat, assertTrue, assertFalse, EqualsTester} from "test/TestUtil.js"
import {PauliMap} from "src/sim/util/PauliMap.js"
import {Axis} from "src/sim/util/Axis.js"
import {GeneralMap} from "src/base/GeneralMap.js"
import {XY} from "src/sim/util/XY.js"

let suite = new Suite("PauliMap");

suite.test("constructor", () => {
    let m = new GeneralMap([["a", PauliMap.XMask]]);
    let s = new PauliMap(m);
    assertThat(s.operations).is(m);
});

suite.test("equals", () => {
    let eq = new EqualsTester();
    eq.assertAddGroup(new PauliMap(), new PauliMap(new GeneralMap()));
    eq.assertAddGroup(new PauliMap(new GeneralMap(["a", PauliMap.XMask])));
    eq.assertAddGroup(new PauliMap(new GeneralMap(["a", PauliMap.ZMask])));
    eq.assertAddGroup(new PauliMap(new GeneralMap(["b", PauliMap.XMask])));
    eq.assertAddGroup(new PauliMap(new GeneralMap(["a", PauliMap.XMask], ["b", PauliMap.XMask])));
    eq.assertAddGeneratedPair(() => new PauliMap(new GeneralMap([new XY(1, 2), PauliMap.XMask])));
    eq.assertAddGroup(new PauliMap(new GeneralMap([new XY(1, 3), PauliMap.XMask])));
});

suite.test("toString", () => {
    assertThat(new PauliMap().toString()).isEqualTo('I');
    assertThat(new PauliMap(new GeneralMap(["a", PauliMap.XMask])).toString()).isEqualTo('X_a');
    assertThat(new PauliMap(new GeneralMap(["a", PauliMap.ZMask])).toString()).isEqualTo('Z_a');
    assertThat(new PauliMap(new GeneralMap(["a", PauliMap.XMask | PauliMap.ZMask])).toString()).isEqualTo('Y_a');
    assertThat(new PauliMap(new GeneralMap(
        ["a", PauliMap.XMask],
        [new XY(1, 2), PauliMap.ZMask]
    )).toString()).isEqualTo('Z_(1, 2) * X_a');
});

suite.test("clone", () => {
    let s = new PauliMap(new GeneralMap(["a", PauliMap.XMask]));
    let s2 = s.clone();
    assertThat(s2).isEqualTo(s);
    assertTrue(s2 !== s);
    assertTrue(s.operations !== s2.operations);
    s.x("b");
    assertThat(s2).isNotEqualTo(s);
});

suite.test("get_and_set", () => {
    let s = new PauliMap();
    assertThat(s.get("a")).isEqualTo(0);
    assertThat(s.operations).isEqualTo(new GeneralMap());
    s.set("a", 0);
    assertThat(s.operations).isEqualTo(new GeneralMap());
    s.set("a", PauliMap.XMask);
    assertThat(s.get("a")).isEqualTo(PauliMap.XMask);
    assertThat(s.operations).isEqualTo(new GeneralMap(["a", PauliMap.XMask]));
});

suite.test("x", () => {
    let s = new PauliMap();
    assertThat(s.toString()).isEqualTo('I');
    s.x("a");
    assertThat(s.toString()).isEqualTo('X_a');
    s.x("b");
    assertThat(s.toString()).isEqualTo('X_a * X_b');
    s.x("a");
    assertThat(s.toString()).isEqualTo('X_b');
    s.x(new XY(1, 2));
    assertThat(s.toString()).isEqualTo('X_(1, 2) * X_b');
});

suite.test("y", () => {
    let s = new PauliMap();
    assertThat(s.toString()).isEqualTo('I');
    s.y("a");
    assertThat(s.toString()).isEqualTo('Y_a');
    s.y("b");
    assertThat(s.toString()).isEqualTo('Y_a * Y_b');
    s.y("a");
    assertThat(s.toString()).isEqualTo('Y_b');
    s.y(new XY(1, 2));
    assertThat(s.toString()).isEqualTo('Y_(1, 2) * Y_b');
});

suite.test("z", () => {
    let s = new PauliMap();
    assertThat(s.toString()).isEqualTo('I');
    s.z("a");
    assertThat(s.toString()).isEqualTo('Z_a');
    s.z("b");
    assertThat(s.toString()).isEqualTo('Z_a * Z_b');
    s.z("a");
    assertThat(s.toString()).isEqualTo('Z_b');
    s.z(new XY(1, 2));
    assertThat(s.toString()).isEqualTo('Z_(1, 2) * Z_b');
});

suite.test("xyz", () => {
    let s = new PauliMap();
    assertThat(s.toString()).isEqualTo('I');
    s.x("a");
    assertThat(s.toString()).isEqualTo('X_a');
    s.z("a");
    assertThat(s.toString()).isEqualTo('Y_a');
    s.y("a");
    assertThat(s.toString()).isEqualTo('I');
});

suite.test("hadamard", () => {
    let s = new PauliMap();
    s.x(5);
    s.hadamard(5);
    assertThat(s.toString()).isEqualTo('Z_5');
    s.hadamard(5);
    assertThat(s.toString()).isEqualTo('X_5');
    s.y(6);
    s.hadamard(6);
    assertThat(s.toString()).isEqualTo('X_5 * Y_6');
    s.hadamard(7);
    assertThat(s.toString()).isEqualTo('X_5 * Y_6');
});

suite.test("cnot_control_to_target", () => {
    let s = new PauliMap();
    assertThat(s.toString()).isEqualTo('I');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('I');

    s.x('c');
    assertThat(s.toString()).isEqualTo('X_c');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('X_c * X_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('X_c');

    s.z('c');
    assertThat(s.toString()).isEqualTo('Y_c');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Y_c * X_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Y_c');

    s.x('c');
    assertThat(s.toString()).isEqualTo('Z_c');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Z_c');
});

suite.test("cnot_target_to_control", () => {
    let s = new PauliMap();
    assertThat(s.toString()).isEqualTo('I');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('I');

    s.x('t');
    assertThat(s.toString()).isEqualTo('X_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('X_t');

    s.z('t');
    assertThat(s.toString()).isEqualTo('Y_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Z_c * Y_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Y_t');

    s.x('t');
    assertThat(s.toString()).isEqualTo('Z_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Z_c * Z_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Z_t');
});

suite.test("cnot_bi_directional", () => {
    let s = new PauliMap();
    s.x('c');
    s.z('t');
    assertThat(s.toString()).isEqualTo('X_c * Z_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Y_c * Y_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('X_c * Z_t');
    s.y('c');
    s.y('t');
    assertThat(s.toString()).isEqualTo('Z_c * X_t');
    s.cnot('c', 't');
    assertThat(s.toString()).isEqualTo('Z_c * X_t');
});

suite.test("measure_x", () => {
    let s = new PauliMap();
    s.x('x');
    s.y('y');
    s.z('z');
    s.measure('x', Axis.X);
    s.measure('y', Axis.X);
    s.measure('z', Axis.X);
    assertThat(s.toString()).isEqualTo('Z_y * Z_z');
});

suite.test("measure_z", () => {
    let s = new PauliMap();
    s.x('x');
    s.y('y');
    s.z('z');
    s.measure('x', Axis.Z);
    s.measure('y', Axis.Z);
    s.measure('z', Axis.Z);
    assertThat(s.toString()).isEqualTo('X_x * X_y');
});

suite.test("mapKeys", () => {
    let s1 = new PauliMap();
    let s2 = new PauliMap();

    s1.x(1);
    s1.y(2);
    s1.z(3);

    s2.x(11);
    s2.y(12);
    s2.z(13);

    assertThat(s1.mapKeys(e => e + 10)).isEqualTo(s2);
});

suite.test("times", () => {
    let s1 = new PauliMap();
    let s2 = new PauliMap();

    s1.x('a');
    s1.y('b');
    s1.z('c');

    s2.x('d');
    s2.y('e');
    s2.z('f');

    s1.x('g');
    s1.y('h');
    s1.z('i');

    s2.x('g');
    s2.y('h');
    s2.z('i');

    s1.x('j');
    s1.y('k');
    s1.z('l');

    s2.x('k');
    s2.y('l');
    s2.z('j');

    assertThat(s1.times(s2).toString()).isEqualTo('X_a * Y_b * Z_c * X_d * Y_e * Z_f * Y_j * Z_k * X_l');
    assertThat(s2.times(s1).toString()).isEqualTo('X_a * Y_b * Z_c * X_d * Y_e * Z_f * Y_j * Z_k * X_l');
    assertThat(s1.inline_times(s2)).is(s1);
    assertThat(s1.toString()).isEqualTo('X_a * Y_b * Z_c * X_d * Y_e * Z_f * Y_j * Z_k * X_l');
});
