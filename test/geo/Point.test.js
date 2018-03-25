import {Suite, assertThat, assertTrue, assertFalse} from "test/TestUtil.js"
import {Point} from "src/geo/Point.js"
import {Vector} from "src/geo/Vector.js"

let suite = new Suite("Point");

suite.test("constructor", () => {
    let p = new Point(2, 3, 5);
    assertThat(p.x).isEqualTo(2);
    assertThat(p.y).isEqualTo(3);
    assertThat(p.z).isEqualTo(5);
});

suite.test("isEqualTo", () => {
    let p = new Point(2, 3, 5);
    assertTrue(p.isEqualTo(p));
    assertTrue(p.isEqualTo(new Point(2, 3, 5)));
    assertFalse(p.isEqualTo(new Point(1, 3, 5)));
    assertFalse(p.isEqualTo(new Point(2, 1, 5)));
    assertFalse(p.isEqualTo(new Point(2, 3, 1)));
    assertFalse(p.isEqualTo(new Point(2, 3, 5.00000001)));
    assertFalse(p.isEqualTo(''));
    assertFalse(p.isEqualTo(2));
    assertFalse(p.isEqualTo(new Vector(2, 3, 5)));
});

suite.test("isApproximatelyEqualTo", () => {
    let p = new Point(2, 3, 5);
    assertTrue(p.isApproximatelyEqualTo(new Point(2, 3, 5), 0));
    assertTrue(p.isApproximatelyEqualTo(new Point(2, 3, 5), 0.5));
    assertFalse(p.isApproximatelyEqualTo(new Point(2, 3, 5.2), 0));
    assertTrue(p.isApproximatelyEqualTo(new Point(2, 3, 5.2), 0.5));
    assertTrue(p.isApproximatelyEqualTo(new Point(1.8, 3.2, 5.2), 0.5));
    assertFalse(p.isApproximatelyEqualTo(new Point(1.8, 3.2, 5.2), 0.1));
});

suite.test("toString", () => {
    assertThat(new Point(2, 3, 5).toString()).isEqualTo('(2, 3, 5)');
});

suite.test("minus", () => {
    assertThat(new Point(2, 3, 5).minus(new Point(7, 11, 17))).isEqualTo(new Vector(-5, -8, -12));
});

suite.test("plus", () => {
    assertThat(new Point(2, 3, 5).plus(new Vector(7, 11, 17))).isEqualTo(new Point(9, 14, 22));
});

suite.test("asVector", () => {
    assertThat(new Point(2, 3, 5).asVector()).isEqualTo(new Vector(2, 3, 5));
});

suite.test("isBetweenBeside", () => {
    let zero = new Point(0, 0, 0);
    let x = new Point(1, 0, 0);
    let y = new Point(0, 1, 0);

    assertFalse(new Point(-100, 0, 0).isBetweenBeside(zero, x));
    assertFalse(new Point(-0.1, 0, 0).isBetweenBeside(zero, x));
    assertTrue(new Point(0.1, 0, 0).isBetweenBeside(zero, x));
    assertTrue(new Point(0.9, 0, 0).isBetweenBeside(zero, x));
    assertFalse(new Point(1.1, 0, 0).isBetweenBeside(zero, x));
    assertFalse(new Point(100, 0, 0).isBetweenBeside(zero, x));

    assertFalse(new Point(-100, 50, -100).isBetweenBeside(zero, x));
    assertFalse(new Point(-0.1, 50, -100).isBetweenBeside(zero, x));
    assertTrue(new Point(0.1, 50, -100).isBetweenBeside(zero, x));
    assertTrue(new Point(0.9, 50, -100).isBetweenBeside(zero, x));
    assertFalse(new Point(1.1, 50, -100).isBetweenBeside(zero, x));
    assertFalse(new Point(100, 50, -100).isBetweenBeside(zero, x));

    assertTrue(new Point(0, 0, 0).isBetweenBeside(x, y));
    assertFalse(new Point(2, 0, 0).isBetweenBeside(x, y));
    assertFalse(new Point(0, 2, 0).isBetweenBeside(x, y));
    assertTrue(new Point(0, 0, 2).isBetweenBeside(x, y));
    assertTrue(new Point(1, 1, 0).isBetweenBeside(x, y));
    assertTrue(new Point(-1, -1, 0).isBetweenBeside(x, y));
    assertFalse(new Point(-1, +1, 0).isBetweenBeside(x, y));
    assertFalse(new Point(+1, -1, 0).isBetweenBeside(x, y));
});
