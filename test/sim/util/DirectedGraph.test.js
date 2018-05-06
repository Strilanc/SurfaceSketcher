import {Suite, assertThat, assertThrows, assertTrue, assertFalse, EqualsTester} from "test/TestUtil.js"
import {PauliMap} from "src/sim/util/PauliMap.js"
import {Axis} from "src/sim/util/Axis.js"
import {GeneralMap} from "src/base/GeneralMap.js"
import {GeneralSet} from "src/base/GeneralSet.js"
import {DirectedGraph, DirectedNode} from "src/sim/util/DirectedGraph.js"
import {XY} from "src/sim/util/XY.js"

let suite = new Suite("DirectedGraph");

suite.test("node_constructor", () => {
    let ins = new GeneralSet();
    let outs = new GeneralSet();
    let n = new DirectedNode('a', ins, outs);
    assertThat(n.key).isEqualTo('a');
    assertThat(n.ins).is(ins);
    assertThat(n.outs).is(outs);
});

suite.test("node_isEqualTo", () => {
    let eq = new EqualsTester();
    eq.assertAddGeneratedPair(() => new DirectedNode('a'));
    eq.assertAddGroup(new DirectedNode('b'), new DirectedNode('b', new GeneralSet(), new GeneralSet()));
    eq.assertAddGroup(new DirectedNode('b', new GeneralSet('a')));
    eq.assertAddGroup(new DirectedNode('b', new GeneralSet(), new GeneralSet('a')));
    eq.assertAddGroup(new DirectedNode('b', new GeneralSet('a'), new GeneralSet('a')));
    eq.assertAddGroup(new DirectedNode('b', new GeneralSet('b'), new GeneralSet('a')));
});

suite.test("node_toString", () => {
    assertThat(new DirectedNode('a').toString()).isEqualTo('{} -> "a" -> {}');
    assertThat(new DirectedNode('b', new GeneralSet(1, 2), new GeneralSet(2, 3)).toString()).isEqualTo(
        '{1, 2} -> "b" -> {2, 3}');
});

suite.test("node_clone", () => {
    let ins = new GeneralSet('b');
    let outs = new GeneralSet('c');
    let n = new DirectedNode('a', ins, outs);
    let c = n.clone();
    assertThat(c).isEqualTo(n);
    assertTrue(c !== n);
    assertTrue(c.ins !== n.ins);
    assertTrue(c.outs !== n.outs);
});

suite.test("graph_constructor", () => {
    let ns = new GeneralMap(['a', new DirectedNode('a')]);
    let g = new DirectedGraph(ns);
    assertThat(g.nodes).is(ns);
});

suite.test("graph_fromEdgeList", () => {
    let g = DirectedGraph.fromEdgeList([
        ['a', 'b'],
        ['b', 'c'],
        ['c', 'a'],
        [3, 'a'],
    ]);
    assertThat(g.nodes).isEqualTo(new GeneralMap(
        ['a', new DirectedNode('a', new GeneralSet('c', 3), new GeneralSet('b'))],
        ['b', new DirectedNode('b', new GeneralSet('a'), new GeneralSet('c'))],
        ['c', new DirectedNode('c', new GeneralSet('b'), new GeneralSet('a'))],
        [3, new DirectedNode(3, new GeneralSet(), new GeneralSet('a'))],
    ));
});

suite.test("graph_fromEdgeList_withNodes", () => {
    let g = DirectedGraph.fromEdgeList([
        ['c'],
        ['b', 'c'],
        [3],
    ]);
    assertThat(g.nodes).isEqualTo(new GeneralMap(
        ['b', new DirectedNode('b', new GeneralSet(), new GeneralSet('c'))],
        ['c', new DirectedNode('c', new GeneralSet('b'), new GeneralSet())],
        [3, new DirectedNode(3)],
    ));
});

suite.test("graph_isEqualTo", () => {
    let eq = new EqualsTester();
    eq.assertAddGroup(new DirectedGraph(), new DirectedGraph(), DirectedGraph.fromEdgeList([]));
    eq.assertAddGeneratedPair(() => DirectedGraph.fromEdgeList([['a', 'b']]));
    eq.assertAddGroup(DirectedGraph.fromEdgeList([['a', 'c']]), DirectedGraph.fromEdgeList([['a', 'c'], ['a', 'c']]));
    eq.assertAddGroup(DirectedGraph.fromEdgeList([['b', 'a']]));
    eq.assertAddGroup(DirectedGraph.fromEdgeList([['b', 'b']]));
    eq.assertAddGroup(DirectedGraph.fromEdgeList([['a', 'b'], ['b', 'a']]));
});

suite.test("graph_toString", () => {
    assertThat(DirectedGraph.fromEdgeList([]).toString()).isEqualTo(`DirectedGraph {\n}`);
    assertThat(DirectedGraph.fromEdgeList([['a', 'b'], ['b', 'a']]).toString()).isEqualTo(`DirectedGraph {
    "a" -> "b"
    "b" -> "a"
}`);
});


suite.test("graph_toEdgeList", () => {
    let g = DirectedGraph.fromEdgeList([['a', 'b'], ['c', 'a'], ['b', 'a']]);
    assertThat(g.toEdgeList()).isEqualTo([['a', 'b'], ['b', 'a'], ['c', 'a']]);

    let g2 = DirectedGraph.fromEdgeList([[2], [2, 3], [5]]);
    assertThat(g2.toEdgeList()).isEqualTo([[2, 3], [5]]);
});

suite.test("graph_hasIncludeDeleteToggleEdge", () => {
    let g = new DirectedGraph();

    assertFalse(g.hasEdge('a', 'b'));
    g.includeEdge('a', 'b');
    assertTrue(g.hasEdge('a', 'b'));
    assertThat(g.toEdgeList()).isEqualTo([['a', 'b']]);
    g.includeEdge('a', 'b');
    assertTrue(g.hasEdge('a', 'b'));
    assertThat(g.toEdgeList()).isEqualTo([['a', 'b']]);

    g.includeEdge('a', 'c');
    assertTrue(g.hasEdge('a', 'c'));
    assertThat(g.toEdgeList()).isEqualTo([['a', 'b'], ['a', 'c']]);

    g.deleteEdge('a', 'b');
    assertTrue(g.hasEdge('a', 'c'));
    assertFalse(g.hasEdge('a', 'b'));
    assertThat(g.toEdgeList()).isEqualTo([['a', 'c'], ['b']]);
    g.deleteEdge('a', 'b');
    assertTrue(g.hasEdge('a', 'c'));
    assertFalse(g.hasEdge('a', 'b'));
    assertThat(g.toEdgeList()).isEqualTo([['a', 'c'], ['b']]);
    g.deleteNode('b');
    assertThat(g.toEdgeList()).isEqualTo([['a', 'c']]);

    g.toggleEdge(1, 3);
    assertTrue(g.hasEdge(1, 3));
    g.toggleEdge(1, 3);
    assertFalse(g.hasEdge(1, 3));
});

suite.test("graph_topologicalOrder", () => {
    let g = new DirectedGraph();
    assertThat(g.topologicalOrder()).isEqualTo([]);
    g.includeNode('r');
    assertThat(g.topologicalOrder()).isEqualTo(['r']);
    g.includeNode('a');
    assertThat(g.topologicalOrder()).isEqualTo(['a', 'r']);
    g.includeEdge('r', 'a');
    assertThat(g.topologicalOrder()).isEqualTo(['r', 'a']);
    g.includeEdge('a', 'r');
    assertThrows(() => g.topologicalOrder());

    assertThat(DirectedGraph.fromEdgeList([
        ['r', 'f'],
        ['a', 'b'],
        ['a', 'c'],
        ['b', 'd'],
        ['d', 'c'],
        ['c', 'e'],
    ]).topologicalOrder()).isEqualTo(['a', 'r', 'b', 'f', 'd', 'c', 'e']);
});

suite.test("map", () => {
    assertThat(new DirectedGraph().mapKeys(e => undefined)).isEqualTo(new DirectedGraph());

    let g = DirectedGraph.fromEdgeList([
        [1, 2],
        [3, 4],
        [2, 1],
        [5, 4],
        [6],
    ]);
    let g2 = DirectedGraph.fromEdgeList([
        [11, 12],
        [13, 14],
        [12, 11],
        [15, 14],
        [16],
    ]);
    assertThat(g.mapKeys(e => e + 10)).isEqualTo(g2);
    assertThat(g).isNotEqualTo(g2);
});

suite.test("union", () => {
    let g = DirectedGraph.fromEdgeList([
        [0],
        [1],
        ['a', 'b'],
        ['c', 'd'],
        ['c', 'e'],
    ]);
    let g2 = DirectedGraph.fromEdgeList([
        [1],
        [2],
        ['e', 'f'],
        ['c', 'd'],
        ['x', 'e'],
    ]);
    let g3 = DirectedGraph.fromEdgeList([
        [0],
        [1],
        [2],
        ['a', 'b'],
        ['c', 'd'],
        ['c', 'e'],
        ['e', 'f'],
        ['x', 'e'],
    ]);
    let gb = g.clone();
    assertThat(g.union(g2)).isEqualTo(g3);
    assertThat(g).isEqualTo(gb);
    assertThat(g.inline_union(g2)).is(g);
    assertThat(g).isEqualTo(g3);
});
