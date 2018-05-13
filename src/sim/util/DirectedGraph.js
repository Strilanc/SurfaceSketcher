import {seq} from "src/base/Seq.js";
import {DetailedError} from "src/base/DetailedError.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {GeneralSet} from "src/base/GeneralSet.js";
import {equate} from "src/base/Equate.js";
import {describe} from "src/base/Describe.js";


class DirectedNode {
    /**
     * @param {*} key
     * @param {!GeneralSet.<*>} ins
     * @param {!GeneralSet.<*>} outs
     */
    constructor(key, ins=new GeneralSet(), outs=new GeneralSet()) {
        this.key = key;
        this.ins = ins;
        this.outs = outs;
    }

    /**
     * @param {!function(key: *): *} keyTransformer
     * @returns {!DirectedNode}
     */
    map(keyTransformer) {
        return new DirectedNode(
            keyTransformer(this.key),
            new GeneralSet(...seq(this.ins).map(keyTransformer)),
            new GeneralSet(...seq(this.outs).map(keyTransformer)));
    }

    /**
     * @returns {!DirectedNode}
     */
    clone() {
        return new DirectedNode(this.key, new GeneralSet(...this.ins), new GeneralSet(...this.outs));
    }

    /**
     * @param {*|!DirectedNode} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof DirectedNode &&
            equate(this.key, other.key) &&
            this.ins.isEqualTo(other.ins) &&
            this.outs.isEqualTo(other.outs);
    }

    /**
     * @returns {!string}
     */
    toString() {
        return `${this.ins.toString()} -> ${describe(this.key)} -> ${this.outs.toString()}`;
    }
}

/**
 * It's a directed graph.
 */
class DirectedGraph {
    /**
     * @param {!GeneralMap.<*, !DirectedNode>} nodes
     */
    constructor(nodes = new GeneralMap()) {
        this.nodes = nodes;
    }

    /**
     * @param {!Array.<[*]|[*, *]>} nodesOrEdges
     * @returns {!DirectedGraph}
     */
    static fromEdgeList(nodesOrEdges) {
        let result = new DirectedGraph();
        for (let nodeOrEdge of nodesOrEdges) {
            if (nodeOrEdge.length === 2) {
                result.includeEdge(nodeOrEdge[0], nodeOrEdge[1]);
            } else if (nodeOrEdge.length === 1) {
                result.includeNode(nodeOrEdge[0]);
            } else {
                throw new DetailedError("Not a node or an edge.", {nodeOrEdge});
            }
        }
        return result;
    }

    /**
     * @param {!DirectedGraph} other
     * @returns {!DirectedGraph}
     */
    inline_union(other) {
        for (let n of other.nodes.values()) {
            this.includeNode(n.key);
            for (let dst of n.outs) {
                this.includeEdge(n.key, dst);
            }
        }
        return this;
    }

    /**
     * @param {!DirectedGraph} other
     * @returns {!DirectedGraph}
     */
    union(other) {
        return this.clone().inline_union(other);
    }

    /**
     * @param {!function(key: *): *} keyTransformer
     * @returns {!DirectedGraph}
     */
    mapKeys(keyTransformer) {
        let nodes = new GeneralMap();
        for (let node of this.nodes.values()) {
            let mappedNode = node.map(keyTransformer);
            nodes.set(mappedNode.key, mappedNode);
        }
        return new DirectedGraph(nodes);
    }

    /**
     * @param {*} key
     */
    includeNode(key) {
        this._forceGetNode(key);
    }

    /**
     * @param {*} key
     * @returns {!Iterable.<*>}
     */
    outEdges(key) {
        let node = this.nodes.get(key);
        if (node === undefined) {
            return [];
        }
        return node.outs;
    }

    /**
     * @returns {!DirectedGraph}
     */
    clone() {
        let nodeClones = new GeneralMap();
        for (let node of this.nodes.values()) {
            nodeClones.set(node.key, node.clone());
        }
        return new DirectedGraph(nodeClones);
    }

    /**
     * @param {*} srcKey
     * @param {*} dstKey
     * @returns {!boolean}
     */
    hasEdge(srcKey, dstKey) {
        let src = this.nodes.get(srcKey);
        let dst = this.nodes.get(dstKey);
        if (src === undefined || dst === undefined) {
            return false;
        }
        return src.outs.has(dstKey);
    }

    /**
     * @param {*} srcKey
     * @param {*} dstKey
     */
    toggleEdge(srcKey, dstKey) {
        if (this.hasEdge(srcKey, dstKey)) {
            this.deleteEdge(srcKey, dstKey);
        } else {
            this.includeEdge(srcKey, dstKey);
        }
    }

    /**
     * @param {*} srcKey
     * @param {*} dstKey
     */
    includeEdge(srcKey, dstKey) {
        let src = this._forceGetNode(srcKey);
        let dst = this._forceGetNode(dstKey);
        src.outs.add(dstKey);
        dst.ins.add(srcKey);
    }

    /**
     * @param {*} srcKey
     * @param {*} dstKey
     */
    deleteEdge(srcKey, dstKey) {
        let src = this.nodes.get(srcKey);
        let dst = this.nodes.get(dstKey);
        if (src === undefined || dst === undefined) {
            return; // Already doesn't exist.
        }
        src.outs.delete(dstKey);
        dst.ins.delete(srcKey);
    }

    //noinspection ReservedWordAsName
    /**
     * Removes a node, and all its edges, from the graph.
     *
     * @param {*} key
     */
    deleteNode(key) {
        let src = this.nodes.get(key);
        if (src === undefined) {
            return; // Already doesn't exist.
        }
        for (let k2 of src.outs) {
            this.deleteEdge(key, k2);
        }
        for (let k2 of src.ins) {
            this.deleteEdge(k2, key);
        }
        this.nodes.delete(key);
    }

    /**
     * Retrieves a node for the given key, bringing it into being if there is no associated node.
     * @param {*} key
     */
    _forceGetNode(key) {
        if (!this.nodes.has(key)) {
            this.nodes.set(key, new DirectedNode(key));
        }
        return this.nodes.get(key);
    }

    /**
     * @returns {!Array.<*>}
     */
    topologicalOrder() {
        let clone = this.clone();
        let result = [];
        for (let node of clone.nodes.values()) {
            if (node.ins.size === 0) {
                result.push(node.key);
            }
        }
        result.sort();
        for (let i = 0; i < result.length; i++) {
            let k = result[i];
            let n = clone.nodes.get(k);
            let outs = [...n.outs];
            outs.sort();
            for (let k2 of outs) {
                let n2 = clone.nodes.get(k2);
                if (n2.ins.size === 1) {
                    result.push(k2);
                }
            }
            clone.deleteNode(k);
        }
        if (clone.nodes.size > 0) {
            throw new DetailedError('Not a directed acyclic graph.', {cycle: clone});
        }
        return result;
    }

    /**
     * @param {*|!DirectedGraph} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof DirectedGraph && this.nodes.isEqualTo(other.nodes);
    }

    /**
     * @returns {!Array.<[*]|[*, *]>}
     */
    toEdgeList() {
        let result = [];
        for (let n of this.nodes.values()) {
            if (n.outs.size === 0 && n.ins.size === 0) {
                result.push([n.key]);
            }
            for (let k2 of n.outs) {
                result.push([n.key, this.nodes.get(k2).key]);
            }
        }
        return result;
    }

    /**
     * @returns {!string}
     */
    toString() {
        let describeEdgeOrNode = e => {
            if (e.length === 1) {
                return `\n    ${describe(e[0])}`;
            } else {
                return `\n    ${describe(e[0])} -> ${describe(e[1])}`
            }
        };

        let edges = this.toEdgeList().map(describeEdgeOrNode);
        edges.sort();
        return `DirectedGraph {${edges.join('')}\n}`;
    }
}

export {DirectedGraph, DirectedNode}
