import {Suite, assertThat, assertTrue, assertFalse, EqualsTester} from "test/TestUtil.js"
import {Rect} from "src/geo/Rect.js"

let suite = new Suite("Plane");

suite.test("constructor", () => {
    let r = new Rect(1, 2, 3, 4);
    assertThat(r.x).isEqualTo(1);
    assertThat(r.y).isEqualTo(2);
    assertThat(r.w).isEqualTo(3);
    assertThat(r.h).isEqualTo(4);
});

suite.test("isEqualTo", () => {
    let eq = new EqualsTester();
    eq.assertAddGeneratedPair(() => new Rect(2, 3, 4, 5));
    eq.assertAddGroup(new Rect(0, 3, 4, 5));
    eq.assertAddGroup(new Rect(2, 0, 4, 5));
    eq.assertAddGroup(new Rect(2, 3, 0, 5));
    eq.assertAddGroup(new Rect(2, 3, 4, 0));
});

suite.test("scaledBy", () => {
    let r = new Rect(1, 2, 3, 4);
    assertThat(r.scaledBy(0.5)).isEqualTo(new Rect(0.5, 1, 1.5, 2));
});

suite.test("flip", () => {
    let r = new Rect(1, 2, 3, 4);
    assertThat(r.flip()).isEqualTo(new Rect(4, 6, -3, -4));
});
