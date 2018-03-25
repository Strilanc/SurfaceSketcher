import {Suite, assertThat, assertTrue, assertFalse} from "test/TestUtil.js"
import {Plane} from "src/geo/Plane.js"
import {Point} from "src/geo/Point.js"
import {Vector} from "src/geo/Vector.js"

let suite = new Suite("Plane");

suite.test("constructor", () => {
    let p = new Plane(new Point(1, 2, 3), new Vector(1, 1, 1));
    assertThat(p.center).isEqualTo(new Point(1, 2, 3));
    assertThat(p.normal).isApproximatelyEqualTo(new Vector(1, 1, 1).scaledBy(Math.sqrt(1/3)));
});

suite.test("isEqualTo", () => {
    let p = new Plane(new Point(1, 2, 3), new Vector(1, 1, 1));
    assertTrue(p.isEqualTo(new Plane(new Point(1, 2, 3), new Vector(1, 1, 1))));
    assertFalse(p.isEqualTo(new Plane(new Point(5, 2, 3), new Vector(1, 1, 1))));
    assertFalse(p.isEqualTo(new Plane(new Point(1, 2, 3), new Vector(1, 5, 1))));
    assertFalse(p.isEqualTo(new Point(1, 2, 3)));
    assertFalse(p.isEqualTo(''));
    assertFalse(p.isEqualTo(undefined));
});

suite.test("isApproximatelyEqualTo", () => {
    let p = new Plane(new Point(1, 2, 3), new Vector(1, 1, 1));
    assertTrue(p.isApproximatelyEqualTo(new Plane(new Point(1, 2, 3), new Vector(1, 1, 1)), 0));
    assertFalse(p.isApproximatelyEqualTo(new Plane(new Point(1.5, 2, 3), new Vector(1.5, 1, 1)), 0.25));
    assertTrue(p.isApproximatelyEqualTo(new Plane(new Point(1.5, 2, 3), new Vector(1.5, 1, 1)), 0.75));
    assertTrue(p.isApproximatelyEqualTo(new Plane(new Point(1, 2, 3), new Vector(2, 2, 2)), 0.0001));
});

suite.test("toString", () => {
    assertThat(new Plane(new Point(1, 2, 3), new Vector(1, -1, 2)).toString()).isEqualTo(
        'Plane((1, 2, 3), <0.4082482904638631, -0.4082482904638631, 0.8164965809277261>)')
});

suite.test("containsPoint", () => {
    let p = new Plane(new Point(0, 1, 0), new Vector(1, 0, 0));
    assertTrue(p.containsPoint(new Point(0, 500, -200), 0.0001));
    assertFalse(p.containsPoint(new Point(0.5, 500, -200), 0.0001));
    assertFalse(p.containsPoint(new Point(-0.5, 500, -200), 0.0001));
    assertTrue(p.containsPoint(new Point(0.5, 500, -200), 1.0));
    assertTrue(p.containsPoint(new Point(-0.5, 500, -200), 1.0));
});

suite.test("isPointInNormalDirection", () => {
    let p = new Plane(new Point(0, 1, 0), new Vector(1, 0, 0));
    assertTrue(p.isPointInNormalDirection(new Point(500, 200, 300), 0));
    assertTrue(p.isPointInNormalDirection(new Point(500, 200, -300), 0));
    assertTrue(p.isPointInNormalDirection(new Point(500, -200, 300), 0));
    assertFalse(p.isPointInNormalDirection(new Point(-500, 200, 300), 0));

    assertTrue(p.isPointInNormalDirection(new Point(0.1, 0, 0), 0));
    assertFalse(p.isPointInNormalDirection(new Point(-0.1, 0, 0), 0));
    assertFalse(p.isPointInNormalDirection(new Point(-0.1, 0, 0), 0.05));
    assertTrue(p.isPointInNormalDirection(new Point(-0.1, 0, 0), 0.15));
});
