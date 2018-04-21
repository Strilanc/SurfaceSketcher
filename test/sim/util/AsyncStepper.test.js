import {Suite, assertThat} from "test/TestUtil.js"
import {AsyncStepper} from "src/sim/util/AsyncStepper.js"

let suite = new Suite("AsyncStepper");

suite.test("initialState", async () => {
    let s = new AsyncStepper();
    await assertThat(s.awaitStep(0)).asyncIsPromiseWithResult(0);
    await assertThat(s.awaitStep(1)).asyncIsPendingPromise();
});

suite.test("firstStep", async () => {
    let s = new AsyncStepper();
    let p = s.awaitStep(1);
    await assertThat(p).asyncIsPendingPromise();
    s.advanceStep();
    await assertThat(p).asyncIsPromiseWithResult(1);
});

suite.test("secondStep", async () => {
    let s = new AsyncStepper();
    let p = s.awaitStep(2);
    s.advanceStep();
    await assertThat(p).asyncIsPendingPromise();
    s.advanceStep();
    await assertThat(p).asyncIsPromiseWithResult(2);
});

suite.test("laterStep", async () => {
    let s = new AsyncStepper();
    for (let i = 0; i < 9; i++) {
        s.advanceStep();
    }
    await assertThat(s.awaitStep(5)).asyncIsPromiseWithResult(5);
    await assertThat(s.awaitStep(9)).asyncIsPromiseWithResult(9);
    let p = s.awaitStep(10);
    await assertThat(p).asyncIsPendingPromise();
    s.advanceStep();
    await assertThat(p).asyncIsPromiseWithResult(10);
    await assertThat(s.awaitStep(10)).asyncIsPromiseWithResult(10);
});
