import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"
import {LockstepSurfaceLayer} from "src/sim/LockstepSurfaceLayer.js"
import {FixupLayer} from "src/sim/FixupLayer.js"
import {XY} from "src/sim/util/XY.js"

let suite = new Suite("LockstepSurfaceLayer");

function normalize_diagram(text) {
    return text.split('\n').map(e => e.trim()).join('\n').trim();
}

suite.test('multiple', () => {
    let layer = new LockstepSurfaceLayer(new FixupLayer(6, 6));
    let xStabilizers = [];
    let zStabilizers = [];
    for (let i = 0; i < layer.width; i+= 2) {
        for (let j = 0; j < layer.width; j+= 2) {
            xStabilizers.push(new XY(i, j));
        }
    }
    for (let i = 1; i < layer.width; i+= 2) {
        for (let j = 1; j < layer.width; j+= 2) {
            zStabilizers.push(new XY(i, j));
        }
    }
    layer.measureStabilizers(xStabilizers, zStabilizers);
    assertThat(normalize_diagram(layer.toString())).isEqualTo(normalize_diagram(`
        LockstepSurfaceLayer(grid=
            ########
            #+ + + #
            # 0 0 0#
            #+ + + #
            # 0 0 0#
            #+ + + #
            # 0 0 0#
            ########
            
            ########
            #C>C>C>#
            #      #
            #C>C>C>#
            #      #
            #C>C>C>#
            #      #
            ########
            
            ########
            # <C<C #
            #      #
            # <C<C #
            #      #
            # <C<C #
            #      #
            ########
            
            ########
            #C C C #
            #v^v^v^#
            #CCCCCC#
            #v^v^v^#
            #CCCCCC#
            #v v v #
            ########
            
            ########
            # C C C#
            #^v^v^v#
            #CCCCCC#
            #^v^v^v#
            #CCCCCC#
            # v v v#
            ########
            
            ########
            #      #
            # <C<C #
            #      #
            # <C<C #
            #      #
            # <C<C #
            ########
            
            ########
            #      #
            #C>C>C>#
            #      #
            #C>C>C>#
            #      #
            #C>C>C>#
            ########
            
            ########
            #E E E #
            # M M M#
            #E E E #
            # M M M#
            #E E E #
            # M M M#
            ########,
        
            fixup=FixupLayer(size=6x6, t=0, ops=[
            ]))
    `));
});
