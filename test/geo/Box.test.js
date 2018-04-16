import {Suite, assertThat, assertTrue, assertFalse} from "test/TestUtil.js"
import {Point} from "src/geo/Point.js"
import {Triangle} from "src/geo/Triangle.js"
import {Vector} from "src/geo/Vector.js"
import {Box, rot3} from "src/geo/Box.js"

let suite = new Suite("Triangle");

suite.test("constructor", () => {
    let p = new Point(1, 2, 3);
    let v = new Vector(4, 5, 6);
    let b = new Box(p, v);
    assertThat(b.baseCorner).isEqualTo(p);
    assertThat(b.diagonal).isEqualTo(v);
});

suite.test("isEqualTo", () => {
    let p = new Point(1, 2, 3);
    let v = new Vector(4, 5, 6);
    let b = new Box(p, v);

    assertTrue(b.isEqualTo(b));
    assertTrue(b.isEqualTo(new Box(p, v)));
    assertFalse(b.isEqualTo(new Box(p, new Vector(1, 2, 3))));
    assertFalse(b.isEqualTo(new Box(new Point(1, 1, 1), v)));
    assertFalse(b.isEqualTo(''));
    assertFalse(b.isEqualTo(undefined));
});

suite.test("rot3", () => {
    assertThat(rot3(0b001, 0)).isEqualTo(0b001);
    assertThat(rot3(0b010, 0)).isEqualTo(0b010);
    assertThat(rot3(0b100, 0)).isEqualTo(0b100);

    assertThat(rot3(0b001, 1)).isEqualTo(0b010);
    assertThat(rot3(0b010, 1)).isEqualTo(0b100);
    assertThat(rot3(0b100, 1)).isEqualTo(0b001);

    assertThat(rot3(0b001, 2)).isEqualTo(0b100);
    assertThat(rot3(0b010, 2)).isEqualTo(0b001);
    assertThat(rot3(0b100, 2)).isEqualTo(0b010);
});

suite.test("isApproximatelyEqualTo", () => {
    let p = new Point(1, 2, 3);
    let v = new Vector(4, 5, 6);
    let b = new Box(p, v);

    assertTrue(b.isApproximatelyEqualTo(b, 0));
    assertTrue(b.isApproximatelyEqualTo(new Box(p, v), 0));
    assertTrue(b.isApproximatelyEqualTo(new Box(p, v), 0.5));
    assertFalse(b.isApproximatelyEqualTo(new Box(p.plus(new Vector(0, 0, 1)), v), 0.5));
    assertTrue(b.isApproximatelyEqualTo(new Box(p.plus(new Vector(0, 0, 1)), v), 2));
});

suite.test("toString", () => {
    let p = new Point(1, 2, 3);
    let v = new Vector(4, 5, 6);
    let b = new Box(p, v);

    assertThat(b.toString()).isEqualTo('Box((1, 2, 3), <4, 5, 6>)')
});

suite.test("corners", () => {
    let p = new Point(1, 2, 3);
    let v = new Vector(4, 5, 6);
    let b = new Box(p, v);
    assertThat(b.corners()).isEqualTo([
        new Point(1, 2, 3),
        new Point(1, 2, 9),
        new Point(1, 7, 3),
        new Point(1, 7, 9),
        new Point(5, 2, 3),
        new Point(5, 2, 9),
        new Point(5, 7, 3),
        new Point(5, 7, 9),
    ]);
    assertThat(b.cornerCoords()).isEqualTo([
        1, 2, 3,
        1, 2, 9,
        1, 7, 3,
        1, 7, 9,
        5, 2, 3,
        5, 2, 9,
        5, 7, 3,
        5, 7, 9,
    ]);
});
