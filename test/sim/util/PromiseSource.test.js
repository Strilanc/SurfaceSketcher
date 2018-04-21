import {Suite, assertThat} from "test/TestUtil.js"
import {PromiseSource} from "src/sim/util/PromiseSource.js"

let suite = new Suite("PromiseSource");

suite.test("idle", async () => {
    let s = new PromiseSource();
    await assertThat(s.promise).asyncIsPendingPromise();
});

suite.test("setResult", async () => {
    let s = new PromiseSource();
    s.setResult(5);
    await assertThat(s.promise).asyncIsPromiseWithResult(5);
});

suite.test("setError", async () => {
    let s = new PromiseSource();
    s.setError('bad');
    await assertThat(s.promise).asyncIsPromiseWithError('bad');
});
