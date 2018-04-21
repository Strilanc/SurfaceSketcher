// Copyright 2017 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"
import {Matrix} from "src/sim/util/Matrix.js"

import {VectorSimulator} from "src/sim/VectorSimulator.js"
import {PauliFrame} from "src/sim/PauliFrame.js"
import {ChpSimulator} from "src/sim/ChpSimulator.js"

let suite = new Suite("SimularSpec");

let simulators = [
    {name: 'VectorSimulator', factory: () => new VectorSimulator()},
    {name: 'PauliFrame_VectorSimulator', factory: () => new PauliFrame(new VectorSimulator())},
    {name: 'ChpSimulator', factory: () => new ChpSimulator()},
    {name: 'PauliFrame_ChpSimulator', factory: () => new PauliFrame(new ChpSimulator())},
];

/**
 * @param {!string} test_name
 * @param {!function(!SimulatorSpec)} testFunc
 */
function sim_test(test_name, testFunc) {
    for (let {name, factory} of simulators) {
        suite.test(`${test_name}[${name}]`, () => {
            let sim = factory();
            try {
                testFunc(sim);
            } finally {
                sim.destruct();
            }
        });
    }
}

sim_test('zero', sim => {
    let q = sim.qalloc();
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: 0, y: 0, z: +1});
    assertFalse(sim.measure(q));
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: 0, y: 0, z: +1});
});

sim_test('toggle1', sim => {
    let q1 = sim.qalloc();
    let q2 = sim.qalloc();
    sim.x(q1);
    assertThat(sim.probability(q1)).isApproximatelyEqualTo(1);
    assertThat(sim.probability(q2)).isApproximatelyEqualTo(0);
});

sim_test('toggle2', sim => {
    let q1 = sim.qalloc();
    let q2 = sim.qalloc();
    sim.x(q2);
    assertThat(sim.probability(q1)).isApproximatelyEqualTo(0);
    assertThat(sim.probability(q2)).isApproximatelyEqualTo(1);
});

sim_test('multiple', sim => {
    let q1 = sim.qalloc();
    let q2 = sim.qalloc();
    let q3 = sim.qalloc();
    assertThat(sim.probability(q1)).isApproximatelyEqualTo(0);
    assertThat(sim.probability(q2)).isApproximatelyEqualTo(0);
    assertThat(sim.probability(q3)).isApproximatelyEqualTo(0);

    sim.hadamard(q1);
    sim.x(q2);
    sim.hadamard(q3);
    sim.phase(q3);
    assertThat(sim.blochVector(q1)).isApproximatelyEqualTo({x: +1, y: 0, z: 0});
    assertThat(sim.blochVector(q2)).isApproximatelyEqualTo({x: 0, y: 0, z: -1});
    assertThat(sim.blochVector(q3)).isApproximatelyEqualTo({x: 0, y: +1, z: 0});

    sim.free(q2);
    assertThat(sim.blochVector(q1)).isApproximatelyEqualTo({x: +1, y: 0, z: 0});
    assertThat(sim.blochVector(q3)).isApproximatelyEqualTo({x: 0, y: +1, z: 0});
    assertThrows(() => sim.blochVector(q2));
});

sim_test('hadamard', sim => {
    let q = sim.qalloc();
    sim.hadamard(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: +1, y: 0, z: 0});
    sim.hadamard(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: 0, y: 0, z: +1});
});

sim_test('phase', sim => {
    let q = sim.qalloc();
    sim.hadamard(q);
    sim.phase(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: 0, y: +1, z: 0});
    sim.phase(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: -1, y: 0, z: 0});
    sim.phase(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: 0, y: -1, z: 0});
    sim.phase(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: +1, y: 0, z: 0});
    sim.hadamard(q);
    sim.phase(q);
    assertThat(sim.blochVector(q)).isApproximatelyEqualTo({x: 0, y: 0, z: +1});
});

sim_test('not', sim => {
    let q = sim.qalloc();
    assertThat(sim.probability(q)).isApproximatelyEqualTo(0.0);
    sim.x(q);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(1.0);
    assertTrue(sim.measure(q));
    assertThat(sim.probability(q)).isApproximatelyEqualTo(1.0);
    sim.x(q);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(0.0);
    sim.hadamard(q);
    sim.x(q);
    sim.hadamard(q);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(0.0);
});

sim_test('cnot', sim => {
    let p = sim.qalloc();
    let q = sim.qalloc();
    assertThrows(() => sim.cnot(p, p));
    assertThrows(() => sim.cnot(q, q));
    assertThat(sim.probability(p)).isApproximatelyEqualTo(0);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(0);

    sim.cnot(p, q);
    assertThat(sim.probability(p)).isApproximatelyEqualTo(0);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(0);

    sim.x(q);
    sim.cnot(p, q);
    assertThat(sim.probability(p)).isApproximatelyEqualTo(0);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(1);

    sim.x(p);
    sim.cnot(p, q);
    assertThat(sim.probability(p)).isApproximatelyEqualTo(1);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(0);

    sim.cnot(p, q);
    assertThat(sim.probability(p)).isApproximatelyEqualTo(1);
    assertThat(sim.probability(q)).isApproximatelyEqualTo(1);
});

sim_test('stateProliferation', sim => {
    let s = sim.qalloc();
    sim.hadamard(s);
    sim.phase(s);
    assertThat(sim.blochVector(s)).isApproximatelyEqualTo({x: 0, y: +1, z: 0});

    let t = sim.qalloc();
    sim.hadamard(t);

    // Kickback an S gate.
    sim.cnot(t, s);
    sim.hadamard(s);
    sim.cnot(t, s);
    sim.hadamard(s);

    assertThat(sim.blochVector(s)).isApproximatelyEqualTo({x: 0, y: +1, z: 0});
    assertThat(sim.blochVector(t)).isApproximatelyEqualTo({x: 0, y: +1, z: 0});

    // Kickback an S gate.
    sim.cnot(t, s);
    sim.hadamard(s);
    sim.cnot(t, s);
    sim.hadamard(s);

    sim.hadamard(t);
    assertThat(sim.probability(t)).isApproximatelyEqualTo(1);
});
