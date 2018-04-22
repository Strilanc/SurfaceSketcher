/**
 * @param {!FixupLayer} layer
 */
import {Suite, assertThat, assertTrue, EqualsTester} from "test/TestUtil.js"
import {FixupLayer} from "src/sim/FixupLayer.js"
import {Axis} from "src/sim/util/Axis.js"
import {FixupOperation} from "src/sim/util/FixupOperation.js"
import {XY} from "src/sim/util/XY.js"
import {XYT} from "src/sim/util/XYT.js"

let suite = new Suite("FixupLayer");

/**
 * @param {!FixupLayer} layer
 */
function assertIsConsistent(layer) {
    //noinspection JSAccessibilityCheck
    let actual = [layer._involvedIds, layer._eventMap];
    //noinspection JSAccessibilityCheck
    let expected = [layer._regeneratedInvolvedIds(), layer._regeneratedEventMap()];
    assertThat(actual).withInfo({layer}).isEqualTo(expected);
}

suite.test("constructor", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let layer = new FixupLayer(3, 3, [op], 5);
    assertThat(layer._time).isEqualTo(5);
    assertThat(layer._ops).isEqualTo([op]);
    assertThat(layer.width).isEqualTo(3);
    assertThat(layer.height).isEqualTo(3);
    assertThat(layer._involvedIds).isEqualTo([
        [new Set(), new Set(), new Set()],
        [new Set(), new Set([5]), new Set()],
        [new Set(), new Set(), new Set([5])],
    ]);
    assertThat(layer._eventMap).isEqualTo(new Map([['(1, 2) @ 3', 5]]));
    assertIsConsistent(layer);
});

suite.test("toString", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let op2 = new FixupOperation(undefined, [new XY(1, 2)]);
    let layer = new FixupLayer(3, 3, [op, op2], 5);

    assertThat(layer.toString()).isEqualTo(`FixupLayer(size=3x3, t=5, ops=[
        if measurement (1, 2) @ 3 then X_(1, 1) * Z_(2, 2)
        X_(1, 2)\n])`);
});

suite.test("equals", () => {
    let eq = new EqualsTester();
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let op2 = new FixupOperation(undefined, [new XY(1, 2)]);
    eq.assertAddGroup(new FixupLayer(3, 3), new FixupLayer(3, 3, [], 0));
    eq.assertAddGroup(new FixupLayer(3, 3, [op], 5));
    eq.assertAddGroup(new FixupLayer(4, 3, [op], 5));
    eq.assertAddGroup(new FixupLayer(3, 4, [op], 5));
    eq.assertAddGroup(new FixupLayer(3, 3, [op], 6));
    eq.assertAddGroup(new FixupLayer(3, 3, [op2], 5));
});

suite.test("clone", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let layer = new FixupLayer(3, 3, [op], 5);
    let layer2 = layer.clone();
    assertThat(layer2).isEqualTo(layer);
    assertTrue(layer2 !== layer);
    assertTrue(layer2._ops !== layer._ops);
    assertIsConsistent(layer2);
});

suite.test("pushFixup", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let layer = new FixupLayer(3, 3, [], 2);
    layer.pushFixup(op);
    assertIsConsistent(layer);
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [op], 2));
});

suite.test("hadamard", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let op_clone = op.clone();
    let op2 = new FixupOperation(undefined, [new XY(1, 2)]);
    let layer = new FixupLayer(3, 3, [op, op2], 2);
    layer.hadamard(new XY(1, 1));
    assertIsConsistent(layer);

    op_clone.hadamard(new XY(1, 1));
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [op_clone, op2], 2));
});

suite.test("cnot", () => {
    let c = new XY(1, 1);
    let t = new XY(2, 2);
    let op = new FixupOperation(new XYT(1, 2, 3), [c], [t]);
    let op_clone = op.clone();
    let layer = new FixupLayer(3, 3, [op], 2);
    layer.cnot(c, t);
    assertIsConsistent(layer);

    op_clone.cnot(c, t);
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [op_clone], 2));

    layer.cnot(c, new XY(0, 0));
    assertIsConsistent(layer);
    layer.cnot(t, new XY(1, 0));
    assertIsConsistent(layer);
    layer.cnot(new XY(0, 1), t);
    assertIsConsistent(layer);
    layer.cnot(new XY(0, 2), c);
    assertIsConsistent(layer);
});

suite.test("measure", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let op_clone = op.clone();
    let op2 = new FixupOperation(undefined, [new XY(1, 2)]);
    let layer = new FixupLayer(3, 3, [op, op2], 2);
    layer.measure(new XY(1, 1), Axis.Z);
    assertIsConsistent(layer);

    op_clone.measure(new XY(1, 1));
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [op_clone, op2], 2));

    layer.measure(new XY(1, 1), Axis.X);
    assertIsConsistent(layer);
    layer.measure(new XY(2, 2), Axis.Z);
    assertIsConsistent(layer);
    layer.measure(new XY(2, 2), Axis.X);
    assertIsConsistent(layer);
});

suite.test("updateWithMeasurementResult", () => {
    let op = new FixupOperation(new XYT(1, 2, 3), [new XY(1, 1)], [new XY(2, 2)]);
    let op2 = new FixupOperation(new XYT(1, 1, 5), [new XY(1, 2)]);
    let layer = new FixupLayer(3, 3, [op.clone(), op2.clone()], 2);

    layer.updateWithMeasurementResult(new XYT(1, 2, 1), false);
    assertIsConsistent(layer);
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [op, op2], 2));

    layer.updateWithMeasurementResult(new XYT(1, 2, 3), false);
    assertIsConsistent(layer);
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [new FixupOperation(), op2], 2));

    layer.updateWithMeasurementResult(new XYT(1, 1, 5), true);
    assertIsConsistent(layer);
    assertThat(layer).isEqualTo(
        new FixupLayer(3, 3, [new FixupOperation(), new FixupOperation(undefined, [new XY(1, 2)])], 2));
});

suite.test("shiftUnconditionalUpdates", () => {
    let op = new FixupOperation(undefined, [new XY(1, 1)], [new XY(2, 2)]);
    let op2 = new FixupOperation(undefined, [new XY(1, 1)], [new XY(2, 0)]);
    let op3 = new FixupOperation(new XYT(1, 1, 5), [new XY(1, 2)]);
    let op4 = new FixupOperation(undefined, [new XY(0, 1)], [new XY(2, 2)]);
    let layer = new FixupLayer(3, 3, [op.clone(), op2.clone(), op3.clone(), op4.clone()], 2);

    let fixup = layer.shiftUnconditionalUpdates();
    assertThat(layer).isEqualTo(new FixupLayer(3, 3, [op3, op4], 4));
    assertIsConsistent(layer);
    assertThat(fixup).isEqualTo(new FixupOperation(undefined, [], [new XY(2, 2), new XY(2, 0)]));
});
