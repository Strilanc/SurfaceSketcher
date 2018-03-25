import {Suite, assertThat} from "test/TestUtil.js"
import {Mat4} from "src/base/Mat4.js"

let suite = new Suite("Mat4");

suite.test("constructor", () => {
    let m = new Mat4(new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16]));
    assertThat(m.getCell(1, 2)).isEqualTo(7);
});

suite.test("times", () => {
    let m1 = new Mat4(new Float32Array([
        1, 2, 3, 4,
        5, 6, 7, 8,
        9, 10, 11, 12,
        13, 14, 15, 16]));
    let m2 = new Mat4(new Float32Array([
        17, 18, 19, 20,
        21, 22, 23, 24,
        25, 26, 27, 28,
        29, 30, 31, 32]));
    let m3 = new Mat4(new Float32Array([
        250, 260, 270, 280,
        618, 644, 670, 696,
        986, 1028, 1070, 1112,
        1354, 1412, 1470, 1528]));
    assertThat(m1.times(m2)).isEqualTo(m3);
});

suite.test("translation", () => {
    assertThat(Mat4.translation(2, 3, 5)).isEqualTo(new Mat4(new Float32Array([
        1, 0, 0, 2,
        0, 1, 0, 3,
        0, 0, 1, 5,
        0, 0, 0, 1,
    ])));

    assertThat(Mat4.translation(2, 3, 5).times(Mat4.translation(1, 3, -8))).isEqualTo(
        Mat4.translation(3, 6, -3));
});

suite.test("scaling", () => {
    assertThat(Mat4.scaling(2, 3, 5)).isEqualTo(new Mat4(new Float32Array([
        2, 0, 0, 0,
        0, 3, 0, 0,
        0, 0, 5, 0,
        0, 0, 0, 1,
    ])));

    assertThat(Mat4.scaling(2, 3, 5).times(Mat4.scaling(1, 3, -8))).isEqualTo(
        Mat4.scaling(2, 9, -40));
});

suite.test("transformPoint", () => {
    let t = Mat4.translation(2, 3, 5);
    let s = Mat4.scaling(2, 3, 5);
    assertThat(t.transformPoint(1, 3, -8)).isEqualTo([3, 6, -3]);
    assertThat(s.transformPoint(1, 3, -8)).isEqualTo([2, 9, -40]);

    assertThat(t.times(s).transformPoint(1, 3, -8)).isEqualTo([4, 12, -35]);
    assertThat(s.times(t).transformPoint(1, 3, -8)).isEqualTo([6, 18, -15]);
});
