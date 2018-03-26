import {Suite, assertThat, assertTrue, assertFalse} from "test/TestUtil.js"
import {Box} from "src/geo/Box.js"
import {Plane} from "src/geo/Plane.js"
import {Point} from "src/geo/Point.js"
import {Ray} from "src/geo/Ray.js"
import {Triangle} from "src/geo/Triangle.js"
import {Vector} from "src/geo/Vector.js"

let suite = new Suite("Ray");

suite.test("constructor", () => {
    let r = new Ray(new Point(1, 2, 3), new Vector(1, 1, 1));
    assertThat(r.start).isEqualTo(new Point(1, 2, 3));
    assertThat(r.direction).isApproximatelyEqualTo(new Vector(1, 1, 1).scaledBy(Math.sqrt(1/3)));
});

suite.test("isEqualTo", () => {
    let r = new Ray(new Point(1, 2, 3), new Vector(1, 1, 1));
    assertTrue(r.isEqualTo(new Ray(new Point(1, 2, 3), new Vector(1, 1, 1))));
    assertFalse(r.isEqualTo(new Ray(new Point(5, 2, 3), new Vector(1, 1, 1))));
    assertFalse(r.isEqualTo(new Ray(new Point(1, 2, 3), new Vector(1, 5, 1))));
    assertFalse(r.isEqualTo(new Point(1, 2, 3)));
    assertFalse(r.isEqualTo(''));
    assertFalse(r.isEqualTo(undefined));
});

suite.test("isApproximatelyEqualTo", () => {
    let r = new Ray(new Point(1, 2, 3), new Vector(1, 1, 1));
    assertTrue(r.isApproximatelyEqualTo(new Ray(new Point(1, 2, 3), new Vector(1, 1, 1)), 0));
    assertFalse(r.isApproximatelyEqualTo(new Ray(new Point(1.5, 2, 3), new Vector(1.5, 1, 1)), 0.25));
    assertTrue(r.isApproximatelyEqualTo(new Ray(new Point(1.5, 2, 3), new Vector(1.5, 1, 1)), 0.75));
    assertTrue(r.isApproximatelyEqualTo(new Ray(new Point(1, 2, 3), new Vector(2, 2, 2)), 0.0001));
});

suite.test("toString", () => {
    assertThat(new Ray(new Point(1, 2, 3), new Vector(1, -1, 2)).toString()).isEqualTo(
        '(1, 2, 3) + t*<0.4082482904638631, -0.4082482904638631, 0.8164965809277261>')
});

suite.test("intersectPlane", () => {
    let p = new Plane(new Point(5, 20, 1), new Vector(0, 0, 1));
    let r = new Ray(new Point(2, 2, 0), new Vector(1, 1, 1));
    assertThat(r.intersectPlane(p, 0.001)).isEqualTo(new Point(3, 3, 1));

    r = new Ray(new Point(2, 2, 0), new Vector(1, 1, -1));
    assertThat(r.intersectPlane(p, 0.001)).isEqualTo(undefined);

    r = new Ray(new Point(2, 2, 0), new Vector(1, 1, 0));
    assertThat(r.intersectPlane(p, 0.001)).isEqualTo(undefined);
});

suite.test("intersectTriangle", () => {
    let t = new Triangle(
        new Point(0, 0, 0),
        new Point(1, 0, 0),
        new Point(0, 1, 0));

    let r = new Ray(new Point(0, 0, 1), new Vector(0.25, 0.25, -1));
    assertThat(r.intersectTriangle(t, 0.001)).isEqualTo(new Point(0.25, 0.25, 0));

    r = new Ray(new Point(0, 0, 1), new Vector(0.25, 0.25, 1));
    assertThat(r.intersectTriangle(t, 0.001)).isEqualTo(undefined);

    r = new Ray(new Point(0, 0, 1), new Vector(1, 0.25, 1));
    assertThat(r.intersectTriangle(t, 0.001)).isEqualTo(undefined);
});

suite.test("intersectBox", () => {
    let b = new Box(new Point(5, 6, 7), new Vector(1, 2, 3));
    let r = new Ray(new Point(0, 0, 0), new Vector(5, 6, 7));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(5, 6, 7));

    r = new Ray(new Point(0, 0, 0), new Vector(5, 6, 8));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(5, 6, 8));

    r = new Ray(new Point(0, 0, 0), new Vector(-5, 6, 8));
    assertThat(r.intersectBox(b, 0.001)).isEqualTo(undefined);

    r = new Ray(new Point(5.5, 7, 8.5), new Vector(1, 0, 0));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(6, 7, 8.5));

    r = new Ray(new Point(5.5, 7, 8.5), new Vector(-1, 0, 0));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(5, 7, 8.5));

    r = new Ray(new Point(5.5, 7, 8.5), new Vector(0, -1, 0));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(5.5, 6, 8.5));

    r = new Ray(new Point(5.5, 7, 8.5), new Vector(0, 1, 0));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(5.5, 8, 8.5));

    r = new Ray(new Point(5.5, 7, 8.5), new Vector(0, 0, 1));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(5.5, 7, 10));

    r = new Ray(new Point(5.5, 7, 8.5), new Vector(1, 1, 1));
    assertThat(r.intersectBox(b, 0.001)).isApproximatelyEqualTo(new Point(6, 7.5, 9));
});

suite.test("intersectBox_knownFailures", () => {
    let ray = new Ray(
        new Point((9.0000000268220903)/9, 0.51839999109506596, 5.465599998831749),
        new Vector(-6.908098448055072/9, 0.06328029202166196, -7.230087927309097));
    let box = new Box(new Point(0, 0, 0), new Vector(1, 1, 1));
    assertThat(ray.intersectBox(box, 0.001)).isNotEqualTo(undefined);
});

suite.test("intersectTriangle_knownFailure", () => {
    let ray = new Ray(
        new Point((9.0000000268220903)/9, 0.51839999109506596, 5.465599998831749),
        new Vector(-6.908098448055072/9, 0.06328029202166196, -7.230087927309097));
    let t = new Triangle(new Point(1, 1, 1), new Point(1, 0, 1), new Point(0, 1, 1));
    assertThat(ray.intersectTriangle(t, 0.001)).isNotEqualTo(undefined);
});
