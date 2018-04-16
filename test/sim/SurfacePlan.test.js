import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {SurfaceLogical, DoubleDefectQubit} from "src/sim/SurfaceLogical.js"
import {Surface, XY, Measurement} from "src/sim/Surface.js"
import {SurfacePlan, SurfacePlanLayer} from "src/sim/SurfacePlan.js"

let suite = new Suite("SurfacePlan");

function normalize_diagram(text) {
    return text.split('\n').map(e => e.trim()).join('\n').trim();
}

function assertSameDiagram(a, b) {
    assertThat(normalize_diagram(a)).isEqualTo(normalize_diagram(b));
}

suite.test('empty_plan', () => {
    let diagram = `
        ###########
        #, , , , ,#
        # . . . . #
        #, , , , ,#
        # . . . . #
        #, , , , ,#
        ###########
    `;
    let plan = SurfacePlanLayer.parseFrom(diagram);
    let sim = new SurfaceLogical(new Surface(plan.width, plan.height));
    sim.clear_x_stabilizers();
    plan.apply_to(sim);
    assertSameDiagram(sim.toString(), `
        ###########
        #, , , , ,#
        # . . . . #
        #, , , , ,#
        # . . . . #
        #, , , , ,#
        ###########`);
});

suite.test('toggle', () => {
    let diagram = `
        ###########
        #, , , , ,#
        # . . . . #
        #, ,x,z, ,#
        # . . . . #
        #, , , , ,#
        ###########
    `;
    let plan = SurfacePlanLayer.parseFrom(diagram);
    let sim = new SurfaceLogical(new Surface(plan.width, plan.height));
    sim.clear_x_stabilizers();
    plan.apply_to(sim);
    assertSameDiagram(sim.toString(), `
        ###########
        #, , , , ,#
        # . . X . #
        #, Z Z , ,#
        # . . X . #
        #, , , , ,#
        ###########`);
});

suite.test('draw_hole', () => {
    let diagram = `
        ###########
        #, , , , ,#
        # . 0 ^ . #
        #, ,v,^, ,#
        # . >>^ . #
        #, , , , ,#
        ###########
    `;
    let plan = SurfacePlanLayer.parseFrom(diagram);
    let sim = new SurfaceLogical(new Surface(plan.width, plan.height));
    sim.clear_x_stabilizers();
    plan.apply_to(sim);
    assertSameDiagram(sim.toString(), `
        ###########
        #, , , , ,#
        # . # # . #
        #, ,#,#, ,#
        # . ### . #
        #, , , , ,#
        ###########`);
});

suite.test('init_separately_and_merge', () => {
    let diagrams = [`
        ###########
        #, , , , ,#
        # . 0 . . #
        #, , , , ,#
        # . . 0 . #
        #, , , , ,#
        ###########
    `, `
        ###########
        #, , , , ,#
        # . #>V . #
        #, , ,V, ,#
        # . . # . #
        #, , , , ,#
        ###########
    `];
    let plan = diagrams.map(e => SurfacePlanLayer.parseFrom(e));
    let sim = new SurfaceLogical(new Surface(plan[0].width, plan[0].height));
    sim.clear_x_stabilizers();
    let results = plan.map(e => e.apply_to(sim));
    assertTrue(results[1].get(new XY(5, 2).toString()).random);
    assertSameDiagram(sim.toString(), `
        ###########
        #, , , , ,#
        # . ### . #
        #, , ,#, ,#
        # . . # . #
        #, , , , ,#
        ###########`);
});

suite.test('init_separately_and_flip_and_measure', () => {
    let diagrams = [`
        ###########
        #, , , , ,#
        # . 0 . . #
        #, ,z, , ,#
        # . .z0 . #
        #, , , , ,#
        ###########
    `, `
        ###########
        #, , , , ,#
        # . M . . #
        #, , , , ,#
        # . . M . #
        #, , , , ,#
        ###########
    `];
    let plan = diagrams.map(e => SurfacePlanLayer.parseFrom(e));
    let sim = new SurfaceLogical(new Surface(plan[0].width, plan[0].height));
    sim.clear_x_stabilizers();
    let results = plan.map(e => e.apply_to(sim));
    assertSameDiagram(sim.toString(), `
        ###########
        #, , , , ,#
        # . X . . #
        #, , , , ,#
        # . . X . #
        #, , , , ,#
        ###########`);
    assertThat(results[1].get(new XY(3, 1).toString())).isEqualTo(new Measurement(true, false));
    assertThat(results[1].get(new XY(5, 3).toString())).isEqualTo(new Measurement(true, false));
});

suite.test('split_and_flip_and_merge', () => {
    let diagrams = [`
        ###########
        #, , , , ,#
        # . 0 . . #
        #, ,v, , ,#
        # . >>> . #
        #, , , , ,#
        ###########
    `, `
        ###########
        #, , , , ,#
        # . # . . #
        #, ,0, , ,#
        # . ### . #
        #, , , , ,#
        ###########
    `, `
        ###########
        #, ,x, , ,#
        # .x#x. . #
        #, ,x, , ,#
        # . >># . #
        #, , , , ,#
        ###########
    `, `
        ###########
        #, , , , ,#
        # . #<< . #
        #, , ,^, ,#
        # . . # . #
        #, , , , ,#
        ###########
    `];
    let plan = diagrams.map(e => SurfacePlanLayer.parseFrom(e));
    let sim = new SurfaceLogical(new Surface(plan[0].width, plan[0].height));
    sim.clear_x_stabilizers();
    let results = plan.map(e => e.apply_to(sim));
    assertSameDiagram(sim.toString(), `
        ###########
        #, , , , ,#
        # . ### . #
        #, , ,#, ,#
        # . . # . #
        #, , , , ,#
        ###########`);
    assertThat(results[3].get(new XY(4, 1).toString())).isEqualTo(new Measurement(true, false));
});

suite.test('wrap_sqrt_x_gate', () => {
    let diagrams = [`
        #################
        #, , , , , , , ,#
        # 0 . . . . . . #
        #,v, , , , , , ,#
        # >>>>>>> . . . #
        #, , , , , , , ,#
        # . . . . . . . #
        #, , , , , , , ,#
        #################
    `, `
        #################
        #, , , , , , , ,#
        # # . . . . . . #
        #,^, , , , , , ,#
        # ^0>>>># . . . #
        #, , , , , , , ,#
        # . . . . . . . #
        #, , , , , , , ,#
        #################
    `, `
        #################
        #, , , , , , , ,#
        # # . . . . . . #
        #, , , , , , , ,#
        # . . . # . . . #
        #, , , , , , , ,#
        # . . . . . . . #
        #, , , , , , , ,#
        #################
    `, `
        #################
        #, , V<<<<<< , ,#
        # # .V. . .^. . #
        #, , V , , ^ , ,#
        # . . . # .^. . #
        #, , ^ , , 0 , ,#
        # . .^. . .v. . #
        #, , ^<<<<<< , ,#
        #################
    `, `
        #################
        #, , @@@@@@@ , ,#
        # # .@. . .@. . #
        #, , @ , , @ , ,#
        # . ./. # .@. . #
        #, , @ , , @ , ,#
        # . .@. . .@. . #
        #, , @@@@@@@ , ,#
        #################
    `, `
        #################
        #, , >>>>>>V , ,#
        # # .^. . .V. . #
        #, , ^ , , @ , ,#
        # . . . # .^. . #
        #, , V , , ^ , ,#
        # . .V. . .^. . #
        #, , >>>>>>^ , ,#
        #################
    `, `
        #################
        #, , , , , , , ,#
        # # . . . . . . #
        #, , , , , M , ,#
        # . . . # . . . #
        #, , , , , , , ,#
        # . . . . . . . #
        #, , , , , , , ,#
        #################
    `];
    let plan = diagrams.map(e => SurfacePlanLayer.parseFrom(e));
    let sim = new SurfaceLogical(new Surface(plan[0].width, plan[0].height));
    sim.clear_x_stabilizers();
    let q = new DoubleDefectQubit(new XY(1, 1), new XY(7, 3));
    for (let i = 0; i < plan.length; i++) {
        if (i === 1) {
            assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x: 0, y: 0, z: 1});
        }
        plan[i].apply_to(sim);
    }
    assertSameDiagram(sim.toString(), `
        #################
        #, , , , , , , ,#
        # # . . . . . . #
        #, , , , , , , ,#
        # . . . # . . . #
        #, , , , , , , ,#
        # . . . . . . . #
        #, , , , , , , ,#
        #################
    `);
    assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x: 0, y: -1, z: 0});
});

suite.test('inject_s_gate', () => {
    let diagrams = [`
        #########
        #, , , ,#
        # 0 . . #
        #, , , ,#
        # . . 0 #
        #, , , ,#
        #########
    `, `
        #########
        #, , , ,#
        # # . . #
        #,v, , ,#
        # v <<# #
        #, , , ,#
        #########
    `, `
        #########
        #, , , ,#
        # # . . #
        #,#, , ,#
        # #S### #
        #, , , ,#
        #########
    `, `
        #########
        #, , , ,#
        # # . . #
        #,^, , ,#
        # ^ >># #
        #, , , ,#
        #########
    `, `
        #########
        #, , , ,#
        # # . . #
        #, , , ,#
        # . . # #
        #, , , ,#
        #########
    `];
    let plan = diagrams.map(e => SurfacePlanLayer.parseFrom(e));
    let sim = new SurfaceLogical(new Surface(plan[0].width, plan[0].height));
    sim.clear_x_stabilizers();
    let q = new DoubleDefectQubit(new XY(1, 1), new XY(5, 3));
    for (let i = 0; i < plan.length; i++) {
        if (i === 1) {
            assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x: 1, y: 0, z: 0});
        }
        plan[i].apply_to(sim);
    }
    assertSameDiagram(sim.toString(), `
        #########
        #, , , ,#
        # # . . #
        #, , , ,#
        # . . # #
        #, , , ,#
        #########
    `);
    assertThat(sim.peek_logical_bloch_vector(q)).isEqualTo({x: 0, y: 1, z: 0});
});
