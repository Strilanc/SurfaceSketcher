import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {shrinkBox, clampBox} from "src/braid/LocalizedPlumbingPiece.js"
import {Box} from "src/geo/Box.js"
import {Point} from "src/geo/Point.js";
import {Vector} from "src/geo/Vector.js";

let suite = new Suite("LocalizedPlumbingPiece");

suite.test('shrinkBox', () => {
    let b = new Box(new Point(1, 2, 3), new Vector(4, 5, 6));
    assertThat(shrinkBox(b, new Vector(+1, 0, 0), 0.5)).isEqualTo(new Box(new Point(1.5, 2, 3), new Vector(3.5, 5, 6)));
    assertThat(shrinkBox(b, new Vector(0, +1, 0), 0.5)).isEqualTo(new Box(new Point(1, 2.5, 3), new Vector(4, 4.5, 6)));
    assertThat(shrinkBox(b, new Vector(0, 0, +1), 0.5)).isEqualTo(new Box(new Point(1, 2, 3.5), new Vector(4, 5, 5.5)));

    assertThat(shrinkBox(b, new Vector(-1, 0, 0), 0.5)).isEqualTo(new Box(new Point(1, 2, 3), new Vector(3.5, 5, 6)));
    assertThat(shrinkBox(b, new Vector(0, -1, 0), 0.5)).isEqualTo(new Box(new Point(1, 2, 3), new Vector(4, 4.5, 6)));
    assertThat(shrinkBox(b, new Vector(0, 0, -1), 0.5)).isEqualTo(new Box(new Point(1, 2, 3), new Vector(4, 5, 5.5)));
});

suite.test('clampBox', () => {
    let b = new Box(new Point(2, 3, 4), new Vector(5, 6, 7));
    assertThat(clampBox(b, new Vector(+1, 0, 0), 2)).isEqualTo(new Box(new Point(5, 3, 4), new Vector(2, 6, 7)));
    assertThat(clampBox(b, new Vector(0, +1, 0), 2)).isEqualTo(new Box(new Point(2, 7, 4), new Vector(5, 2, 7)));
    assertThat(clampBox(b, new Vector(0, 0, +1), 2)).isEqualTo(new Box(new Point(2, 3, 9), new Vector(5, 6, 2)));

    assertThat(clampBox(b, new Vector(-1, 0, 0), 2)).isEqualTo(new Box(new Point(2, 3, 4), new Vector(2, 6, 7)));
    assertThat(clampBox(b, new Vector(0, -1, 0), 2)).isEqualTo(new Box(new Point(2, 3, 4), new Vector(5, 2, 7)));
    assertThat(clampBox(b, new Vector(0, 0, -1), 2)).isEqualTo(new Box(new Point(2, 3, 4), new Vector(5, 6, 2)));
});
