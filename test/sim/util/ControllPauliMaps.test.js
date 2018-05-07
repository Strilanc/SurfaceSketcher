/**
 * @param {!FixupLayer} layer
 */
import {Suite, assertThat, assertTrue, EqualsTester} from "test/TestUtil.js"
import {ControlledPauliMaps} from "src/sim/util/ControlledPauliMaps.js"
import {Axis} from "src/sim/util/Axis.js"
import {FixupOperation} from "src/sim/util/FixupOperation.js"
import {GeneralSet} from "src/base/GeneralSet.js"
import {GeneralMap} from "src/base/GeneralMap.js"
import {XY} from "src/sim/util/XY.js"
import {XYT} from "src/sim/util/XYT.js"
import {PauliMap} from "src/sim/util/PauliMap.js";

let suite = new Suite("ControlledPauliMaps");

/**
 * Checks that the incrementally updated index information is consistent with a regenerated index.
 * @param {!ControlledPauliMaps} controlledPaulisMap
 */
function assertIsConsistent(controlledPaulisMap) {
    //noinspection JSAccessibilityCheck
    let actual = controlledPaulisMap._targetToControls;
    //noinspection JSAccessibilityCheck
    let expected = controlledPaulisMap._regeneratedTargetToControlsMap();
    assertThat(actual).withInfo({controlledPaulisMap}).isEqualTo(expected);
}

suite.test("constructor", () => {
    let a = new XY(1, 1);
    let b = new XY(2, 2);
    let p = new PauliMap();
    let t = new XYT(1, 2, 3);
    p.x(a);
    p.z(b);
    let m = new GeneralMap([t, p]);
    let c = new ControlledPauliMaps(m);
    //noinspection JSAccessibilityCheck
    assertThat(c._pauliMaps).is(m);
    //noinspection JSAccessibilityCheck
    assertThat(c._targetToControls).isEqualTo(new GeneralMap(
        [a, new GeneralSet(t)],
        [b, new GeneralSet(t)],
    ));
    assertIsConsistent(c);
});

suite.test("toString", () => {
    let a = new XY(1, 1);
    let b = new XY(2, 2);
    let t = new XYT(1, 2, 3);
    let t2 = new XYT(1, 2, 4);
    let p = new PauliMap();
    p.x(a);
    p.z(b);
    let p2 = new PauliMap();
    p2.z(b);
    let m = new GeneralMap([t, p], [t2, p2]);
    let c = new ControlledPauliMaps(m);

    assertThat(c.toString()).isEqualTo(`ControlledPauliMaps {
    IF (1, 2) @ 3 THEN X_(1, 1) * Z_(2, 2)
    IF (1, 2) @ 4 THEN Z_(2, 2)
}`);
});
