import {Suite, assertThat, assertTrue, assertFalse} from "test/TestUtil.js"
import {Vector} from "src/geo/Vector.js"

let suite = new Suite("Vector");

suite.test("constructor", () => {
    let v = new Vector(2, 3, 5);
    assertThat(v.x).isEqualTo(2);
    assertThat(v.y).isEqualTo(3);
    assertThat(v.z).isEqualTo(5);
});

suite.test("isEqualTo", () => {
    let v = new Vector(2, 3, 5);
    assertTrue(v.isEqualTo(v));
    assertTrue(v.isEqualTo(new Vector(2, 3, 5)));
    assertFalse(v.isEqualTo(new Vector(1, 3, 5)));
    assertFalse(v.isEqualTo(new Vector(2, 1, 5)));
    assertFalse(v.isEqualTo(new Vector(2, 3, 1)));
    assertFalse(v.isEqualTo(new Vector(2, 3, 5.00000001)));
    assertFalse(v.isEqualTo(''));
    assertFalse(v.isEqualTo(2));
});

suite.test("isApproximatelyEqualTo", () => {
    let v = new Vector(2, 3, 5);
    assertTrue(v.isApproximatelyEqualTo(new Vector(2, 3, 5), 0));
    assertTrue(v.isApproximatelyEqualTo(new Vector(2, 3, 5), 0.5));
    assertFalse(v.isApproximatelyEqualTo(new Vector(2, 3, 5.2), 0));
    assertTrue(v.isApproximatelyEqualTo(new Vector(2, 3, 5.2), 0.5));
    assertTrue(v.isApproximatelyEqualTo(new Vector(1.8, 3.2, 5.2), 0.5));
    assertFalse(v.isApproximatelyEqualTo(new Vector(1.8, 3.2, 5.2), 0.1));
});

suite.test("toString", () => {
    assertThat(new Vector(2, 3, 5).toString()).isEqualTo('<2, 3, 5>');
});

suite.test("scaledBy", () => {
    assertThat(new Vector(2, 3, 5).scaledBy(0.5)).isEqualTo(new Vector(1, 1.5, 2.5));
});

suite.test("length", () => {
    assertThat(new Vector(1, 0, 0).length()).isEqualTo(1);
    assertThat(new Vector(0, 2, 0).length()).isEqualTo(2);
    assertThat(new Vector(0, 0, -5).length()).isEqualTo(5);
    assertThat(new Vector(2, -2, 1).length()).isEqualTo(3);
    assertThat(new Vector(1, 1, -1).length()).isApproximatelyEqualTo(Math.sqrt(3));
});

suite.test("norm2", () => {
    assertThat(new Vector(2, 3, 5).norm2()).isEqualTo(38);
    assertThat(new Vector(2, 0, 0).norm2()).isEqualTo(4);
    assertThat(new Vector(0, 3, 0).norm2()).isEqualTo(9);
    assertThat(new Vector(0, 0, 4).norm2()).isEqualTo(16);
});

suite.test("unit", () => {
    assertThat(new Vector(1, 0, 0).unit()).isEqualTo(new Vector(1, 0, 0));
    assertThat(new Vector(0, 2, 0).unit()).isEqualTo(new Vector(0, 1, 0));
    assertThat(new Vector(0, 0, 5).unit()).isEqualTo(new Vector(0, 0, 1));
    assertThat(new Vector(1, 1, 1).unit()).isApproximatelyEqualTo(
        new Vector(Math.sqrt(1/3), Math.sqrt(1/3), Math.sqrt(1/3)));
    assertThat(new Vector(1, 1, 0).unit()).isApproximatelyEqualTo(
        new Vector(Math.sqrt(1/2), Math.sqrt(1/2), 0));
});

suite.test("dot", () => {
    let x = new Vector(1, 0, 0);
    let y = new Vector(0, 1, 0);
    let z = new Vector(0, 0, 1);

    assertThat(x.dot(x)).isEqualTo(1);
    assertThat(y.dot(y)).isEqualTo(1);
    assertThat(z.dot(z)).isEqualTo(1);

    assertThat(x.dot(y)).isEqualTo(0);
    assertThat(y.dot(z)).isEqualTo(0);
    assertThat(z.dot(x)).isEqualTo(0);

    assertThat(y.dot(x)).isEqualTo(0);
    assertThat(z.dot(y)).isEqualTo(0);
    assertThat(x.dot(z)).isEqualTo(0);

    assertThat(x.scaledBy(2).dot(x.scaledBy(3))).isEqualTo(6);

    assertThat(new Vector(2, 3, 5).dot(new Vector(7, 11, -13))).isEqualTo(-18);
});

suite.test("cross", () => {
    let x = new Vector(1, 0, 0);
    let y = new Vector(0, 1, 0);
    let z = new Vector(0, 0, 1);

    assertThat(x.cross(x)).isEqualTo(new Vector(0, 0, 0));
    assertThat(y.cross(y)).isEqualTo(new Vector(0, 0, 0));
    assertThat(z.cross(z)).isEqualTo(new Vector(0, 0, 0));

    assertThat(x.cross(y)).isEqualTo(z);
    assertThat(y.cross(z)).isEqualTo(x);
    assertThat(z.cross(x)).isEqualTo(y);

    assertThat(y.cross(x)).isEqualTo(z.scaledBy(-1));
    assertThat(z.cross(y)).isEqualTo(x.scaledBy(-1));
    assertThat(x.cross(z)).isEqualTo(y.scaledBy(-1));

    assertThat(x.scaledBy(2).cross(y.scaledBy(3))).isEqualTo(z.scaledBy(6));

    assertThat(new Vector(2, 3, 5).cross(new Vector(7, 11, 13))).isEqualTo(new Vector(-16, 9, 1));
});

suite.test("projectOnto", () => {
    let x = new Vector(1, 0, 0);
    let y = new Vector(0, 1, 0);
    let z = new Vector(0, 0, 1);

    assertThat(new Vector(2, 3, 5).projectOnto(x)).isEqualTo(x.scaledBy(2));
    assertThat(new Vector(2, 3, 5).projectOnto(y)).isEqualTo(y.scaledBy(3));
    assertThat(new Vector(2, 3, 5).projectOnto(z)).isEqualTo(z.scaledBy(5));

    assertThat(new Vector(2, 3, 5).projectOnto(x.scaledBy(2))).isEqualTo(x.scaledBy(2));
    assertThat(new Vector(2, 3, 5).projectOnto(y.scaledBy(-1))).isEqualTo(y.scaledBy(3));
    assertThat(new Vector(2, 3, 5).projectOnto(z.scaledBy(0.5))).isEqualTo(z.scaledBy(5));

    assertThat(new Vector(2, 3, 5).projectOnto(new Vector(1, 1, 1))).isEqualTo(
        new Vector(1, 1, 1).scaledBy(10/3));
    assertThat(new Vector(2, 3, 5).projectOnto(new Vector(2, 2, 2))).isEqualTo(
        new Vector(1, 1, 1).scaledBy(10/3));
});

suite.test("minus", () => {
    assertThat(new Vector(2, 3, 5).minus(new Vector(11, 13, 19))).isEqualTo(
        new Vector(-9, -10, -14));
});

suite.test("perpOnto", () => {
    assertThat(new Vector(2, 3, 5).perpOnto(new Vector(1, 0, 0))).isEqualTo(new Vector(0, 3, 5));
});
