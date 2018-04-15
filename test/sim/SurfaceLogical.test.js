import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {
    SurfaceLogical,
    Motion,
    DoubleDefectQubit,
    STATE_ZERO,
    STATE_ONE,
    STATE_PLUS,
    STATE_MINUS
} from "src/sim/SurfaceLogical.js"
import {Surface, XY, Measurement} from "src/sim/Surface.js"

function normalize_diagram(text) {
    return text.split('\n').map(e => e.trim()).join('\n').trim();
}

let suite = new Suite("SurfaceLogical");

suite.test('motion_constructor', () => {
    let m = new Motion(new XY(2, 3), 0, 1);
    assertThat(m.start).isEqualTo(new XY(2, 3));
    assertThat(m.dx).isEqualTo(0);
    assertThat(m.dy).isEqualTo(1);

    assertThrows(() => new Motion(new XY(0, 0), 2, 0));
    assertThrows(() => new Motion(new XY(0, 0), 0, 0));
    assertThrows(() => new Motion(new XY(0, 0), Math.sqrt(0.5), Math.sqrt(0.5)));
});

suite.test('motion_equality', () => {
    let m = new Motion(new XY(2, 3), 0, 1);
    assertThat(m).isEqualTo(m);
    assertThat(m).isEqualTo(new Motion(new XY(2, 3), 0, 1));
    assertThat(m).isNotEqualTo(new Motion(new XY(2, 3), 0, -1));
    assertThat(m).isNotEqualTo(new Motion(new XY(2, 3), 1, 0));
    assertThat(m).isNotEqualTo(new Motion(new XY(5, 3), 0, 1));
    assertThat(new Motion(new XY(2, 3), 1, 0)).isNotEqualTo(new Motion(new XY(2, 3), -1, 0));
    assertThat(m).isNotEqualTo('');
    assertThat(m).isNotEqualTo(undefined);
});

suite.test('motion_toString', () => {
    assertThat(new Motion(new XY(2, 3), 1, 0).toString()).isEqualTo('(2++, 3)');
    assertThat(new Motion(new XY(4, 5), 0, -1).toString()).isEqualTo('(4, 5--)');
});

suite.test('doubleDefectQubit_equality', () => {
    let p = new XY(1, 2);
    let q = new XY(3, 4);
    let r = new XY(5, 6);
    let a = new DoubleDefectQubit(p, q);
    assertThat(a).isEqualTo(a);
    assertThat(a).isEqualTo(new DoubleDefectQubit(p, q));
    assertThat(a).isNotEqualTo(new DoubleDefectQubit(p, r));
    assertThat(a).isNotEqualTo(new DoubleDefectQubit(r, q));
    assertThat(a).isNotEqualTo(new DoubleDefectQubit(q, p));
    assertThat(a).isNotEqualTo('');
    assertThat(a).isNotEqualTo(undefined);
});

suite.test('doubleDefectQubit_toString', () => {
    assertThat(new DoubleDefectQubit(new XY(1, 2), new XY(3, 4)).toString()).isEqualTo('(1, 2) : (3, 4)');
});

const STATES_WITH_BLOCH_VECTORS = [
    {state: STATE_ZERO, vector: {x: 0, y: 0, z: 1}},
    {state: STATE_ONE, vector: {x: 0, y: 0, z: -1}},
    {state: STATE_PLUS, vector: {x: +1, y: 0, z: 0}},
    {state: STATE_MINUS, vector: {x: -1, y: 0, z: 0}},
];

/**
 * @param {!string} name
 * @param {!int} w
 * @param {!int} h
 * @param {!function(!SurfaceLogical)} callback
 */
function sim_test(name, w, h, callback) {
    suite.test(name, () => {
        for (let i = 0; i < 3; i++) {
            let sim = new SurfaceLogical(new Surface(w, h));
            sim.clear_x_stabilizers();
            try {
                callback(sim);
            } finally {
                sim.destruct();
            }
        }
    });
}

/**
 * @param {!string} name
 * @param {!function(!SurfaceLogical, !DoubleDefectQubit, !{x: !int, y: !int, z: !int})} callback
 * @param {!boolean=} include_primal
 * @param {!boolean=} include_dual
 */
function qubit_state_test(name, callback, include_primal=true, include_dual=true) {
    let primal = new DoubleDefectQubit(new XY(3, 3), new XY(7, 3));
    let dual = new DoubleDefectQubit(new XY(4, 4), new XY(8, 4));
    let qs = [];
    if (include_primal) {
        qs.push(primal);
    }
    if (include_dual) {
        qs.push(dual);
    }
    for (let q of qs) {
        for (let {state, vector} of STATES_WITH_BLOCH_VECTORS) {
            sim_test(`${name}_${q === primal ? 'primal' : 'dual'}_${state}`, 11, 11, sim => {
                sim.init_logical(q, state);
                callback(sim, q, vector);
            });
        }
    }
}

sim_test('toString', 11, 11, sim => {
    let q1 = new DoubleDefectQubit(new XY(3, 3), new XY(7, 3));
    sim.init_logical(q1, STATE_PLUS);

    let q2 = new DoubleDefectQubit(new XY(4, 8), new XY(8, 8));
    sim.init_logical(q2, STATE_PLUS);

    sim.measure_all_stabilizers();
    assertThat(normalize_diagram(sim.toString())).isEqualTo(normalize_diagram(`
         ########### 
        #           #
        #           #
        #           #
        #   #       #
        #        @  #
        #           #
        #           #
        #   #       #
        #        @  #
        #           #
        #           #
         ########### `));
});

qubit_state_test('init_logical', (sim, q, vec) => {
    assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo(vec);
});

qubit_state_test('measure_logical_x', (sim, q, vec) => {
    let m = sim.measure_logical_x(q);
    if (vec.x !== 0) {
        assertThat(m).isEqualTo(new Measurement(vec.x === -1, false));
    } else {
        assertTrue(m.random);
    }
});

qubit_state_test('measure_logical_z', (sim, q, vec) => {
    let m = sim.measure_logical_z(q);
    if (vec.z !== 0) {
        assertThat(m).isEqualTo(new Measurement(vec.z === -1, false));
    } else {
        assertTrue(m.random);
    }
});

qubit_state_test('logical_x', (sim, q, {x, y, z}) => {
    z *= -1;
    y *= -1;
    sim.logical_x(q);
    assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x, y, z});
});

qubit_state_test('logical_z', (sim, q, {x, y, z}) => {
    x *= -1;
    y *= -1;
    sim.logical_z(q);
    assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x, y, z});
});

qubit_state_test('logical_z', (sim, q, {x, y, z}) => {
    x *= -1;
    y *= -1;
    sim.logical_z(q);
    assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x, y, z});
});

qubit_state_test('inject_s', (sim, q, {x, y, z}) => {
    if (sim.is_dual(q)) {
        assertThrows(() => sim.inject_s(q.a, q.b));
    } else {
        for (let i = 0; i < 4; i++) {
            sim.inject_s(q.a, q.b);
            [x, y] = [-y, x];
            assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x, y, z});
        }
    }
});
