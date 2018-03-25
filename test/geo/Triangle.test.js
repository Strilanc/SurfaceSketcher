import {Suite, assertThat, assertTrue, assertFalse} from "test/TestUtil.js"
import {Plane} from "src/geo/Plane.js"
import {Point} from "src/geo/Point.js"
import {Triangle} from "src/geo/Triangle.js"
import {Vector} from "src/geo/Vector.js"

let suite = new Suite("Triangle");

suite.test("constructor", () => {
    let p = new Triangle(
        new Point(0, 0, 3),
        new Point(1, 0, 0),
        new Point(0, 2, 0));
    assertThat(p.a).isEqualTo(new Point(0, 0, 3));
    assertThat(p.b).isEqualTo(new Point(1, 0, 0));
    assertThat(p.c).isEqualTo(new Point(0, 2, 0));
});

suite.test("isEqualTo", () => {
    let a = new Point(1, 0, 0);
    let b = new Point(0, 2, 0);
    let c = new Point(0, 0, 3);
    let d = new Point(1, 2, 3);
    let t = new Triangle(a, b, c);

    assertTrue(t.isEqualTo(t));
    assertTrue(t.isEqualTo(new Triangle(a, b, c)));

    assertFalse(t.isEqualTo(new Triangle(b, a, c)));
    assertFalse(t.isEqualTo(new Triangle(c, a, b)));
    assertFalse(t.isEqualTo(new Triangle(a, b, d)));
    assertFalse(t.isEqualTo(new Triangle(a, d, c)));
    assertFalse(t.isEqualTo(new Triangle(d, b, c)));

    assertFalse(t.isEqualTo(''));
    assertFalse(t.isEqualTo(undefined));
});

suite.test("isApproximatelyEqualTo", () => {
    let a = new Point(1, 0, 0);
    let b = new Point(0, 2, 0);
    let c = new Point(0, 0, 3);
    let d = new Point(1, 2, 3);
    let t = new Triangle(a, b, c);

    assertTrue(t.isApproximatelyEqualTo(new Triangle(a, b, c), 0));
    assertTrue(t.isApproximatelyEqualTo(new Triangle(a, b, c), 0.5));
    assertFalse(t.isApproximatelyEqualTo(new Triangle(a.plus(new Vector(0.9, 0.4, 0.3)), b, c), 0.5));
    assertTrue(t.isApproximatelyEqualTo(new Triangle(a.plus(new Vector(0.9, 0.4, 0.3)), b, c), 1.0));

    assertFalse(t.isApproximatelyEqualTo(new Triangle(b, a, c), 0.001));
    assertFalse(t.isApproximatelyEqualTo(new Triangle(c, a, b), 0.001));
    assertFalse(t.isApproximatelyEqualTo(new Triangle(a, b, d), 0.001));
    assertFalse(t.isApproximatelyEqualTo(new Triangle(a, d, c), 0.001));
    assertFalse(t.isApproximatelyEqualTo(new Triangle(d, b, c), 0.001));

    assertFalse(t.isApproximatelyEqualTo('', 5));
    assertFalse(t.isApproximatelyEqualTo(undefined, 5));
});

suite.test("toString", () => {
    let a = new Point(1, 0, 0);
    let b = new Point(0, 2, 0);
    let c = new Point(0, 0, 3);
    assertThat(new Triangle(a, b, c).toString()).isEqualTo(
        'Triangle((1, 0, 0), (0, 2, 0), (0, 0, 3))')
});

suite.test("normal", () => {
    let t = new Triangle(
        new Point(0, 0, 0),
        new Point(1, 0, 0),
        new Point(0, 1, 0));
    assertThat(t.normal()).isEqualTo(new Vector(0, 0, -1));
});

suite.test("plane", () => {
    let t = new Triangle(
        new Point(0, 0, 10),
        new Point(2, 0, 10),
        new Point(0, 2, 10));
    assertThat(t.plane()).isEqualTo(new Plane(new Point(0, 0, 10), new Vector(0, 0, -1)));
});

suite.test("containsPoint", () => {
    let t = new Triangle(
        new Point(0, 0, 0),
        new Point(1, 0, 0),
        new Point(0, 1, 0));
    assertTrue(t.containsPoint(new Point(0.1, 0.1, 0), 0.0001));
    assertTrue(t.containsPoint(new Point(0.8, 0.1, 0), 0.0001));
    assertTrue(t.containsPoint(new Point(0.1, 0.8, 0), 0.0001));
    assertTrue(t.containsPoint(new Point(0.45, 0.45, 0), 0.0001));
    assertFalse(t.containsPoint(new Point(0.55, 0.55, 0), 0.0001));
    assertFalse(t.containsPoint(new Point(-0.1, 0.1, 0), 0.0001));
    assertFalse(t.containsPoint(new Point(0.1, -0.1, 0), 0.0001));

    assertFalse(t.containsPoint(new Point(0.1, 0.1, 0.5), 0.0001));
    assertTrue(t.containsPoint(new Point(0.1, 0.1, 0.5), 1.0));
});
