import {DetailedError} from "src/base/DetailedError.js";
import {Surface, XY, Measurement} from "src/sim/Surface.js";
import {Motion, SurfaceLogical} from "src/sim/SurfaceLogical.js";


class PlanElement {
    /**
     * @param {!SurfaceLogical} sim
     * @param {!XY} xy
     * @returns {undefined|*}
     */
    apply_at(sim, xy) {
        throw new DetailedError(`${this} didn't implement apply_at.`, {sim, xy});
    }

    /**
     * Determines if this element of the plan should happen before the element above/below/right/left of this one.
     *
     * If two elements both say the other should go first, one is picked arbitrarily.
     *
     * @returns {!Array.<!{dx: !int, dy: !int}>}
     */
    effect_directions() {
        return [];
    }
}

class ResizeHole extends PlanElement {
    /**
     * @param {!int} dx
     * @param {!int} dy
     */
    constructor(dx, dy) {
        super();
        this.dx = dx;
        this.dy = dy;
    }

    /**
     * @param {!SurfaceLogical} sim
     * @param {!XY} xy
     * @returns {undefined|!Measurement}
     */
    apply_at(sim, xy) {
        if (!sim.sim.is_data(xy)) {
            return;
        }
        let before = new XY(xy.x - this.dx, xy.y - this.dy);
        if (sim.sim.is_disabled(xy)) {
            sim.shrink_hole(new Motion(before, this.dx, this.dy));
            return undefined;
        } else {
            return sim.extend_hole(new Motion(before, this.dx, this.dy));
        }
    }

    effect_directions() {
        return [{dx: this.dx, dy: this.dy}];
    }
}

class DestroyHole extends PlanElement {
    /**
     * @param {!SurfaceLogical} sim
     * @param {!XY} xy
     * @returns {!Measurement}
     */
    apply_at(sim, xy) {
        if (sim.sim.is_data(xy) || !sim.sim.is_disabled(xy)) {
            throw new DetailedError("Must destroy holes on measurement qubits.", {sim, xy});
        }
        return sim.end_hole(xy);
    }
}

class AssertHole extends PlanElement {
    apply_at(sim, xy) {
        if (!sim.sim.is_disabled(xy)) {
            throw new DetailedError("Missing hole.", {sim, xy});
        }
    }
}

class AssertNotHole extends PlanElement {
    apply_at(sim, xy) {
        if (sim.sim.is_disabled(xy)) {
            throw new DetailedError("Unexpected hole.", {sim, xy});
        }
    }
}

class AssertActiveX extends PlanElement {
    apply_at(sim, xy) {
        if (!sim.sim.is_x(new XY(xy.x, xy.y, true))) {
            throw new DetailedError("Not an active X measurement qubit.", {sim, xy});
        }
    }
}

class AssertActiveZ extends PlanElement {
    apply_at(sim, xy) {
        if (!sim.sim.is_z(new XY(xy.x, xy.y, true))) {
            throw new DetailedError("Not an active Z measurement qubit.", {sim, xy});
        }
    }
}

class IntroduceFreedom extends PlanElement {
    /**
     * @param {!boolean} toggle
     */
    constructor(toggle) {
        super();
        this.toggle = toggle;
    }

    apply_at(sim, xy) {
        if (sim.sim.is_data(xy)) {
            if (!sim.sim.is_disabled(xy)) {
                throw new DetailedError("Already cut.", {xy, sim});
            }
            for (let [dx, dy] of [[0, 1], [1, 0]]) {
                let p1 = new XY(xy.x + dx, xy.y + dy);
                let p2 = new XY(xy.x - dx, xy.y - dy);
                if (sim.sim.is_disabled(p1) && sim.sim.is_disabled(p2)) {
                    sim.cut(new Motion(p2, dx, dy), this.toggle);
                    return;
                }
            }
            throw new DetailedError("Nothing to cut.", {xy, sim});
        } else {
            if (sim.sim.is_disabled(xy)) {
                throw new DetailedError("Already a hole.", {xy, sim});
            }
            sim.start_hole(xy);
            if (this.toggle) {
                sim.type_toggle_around_stabilizer(xy);
            }
        }
    }

    effect_directions() {
        return [
            {dx: 1, dy: 0},
            {dx: -1, dy: 0},
            {dx: 0, dy: 1},
            {dx: 0, dy: -1},
        ];
    }
}

class DoXGate extends PlanElement {
    apply_at(sim, xy) {
        if (!sim.sim.is_data(xy)) {
            throw new DetailedError("Operations must be applied to data qubits.", {xy, sim});
        }
        sim.sim.toggle(xy);
    }

    effect_directions() {
        return [
            {dx: 1, dy: 0},
            {dx: -1, dy: 0},
            {dx: 0, dy: 1},
            {dx: 0, dy: -1},
        ];
    }
}

class DoZGate extends PlanElement {
    apply_at(sim, xy) {
        if (!sim.sim.is_data(xy)) {
            throw new DetailedError("Operations must be applied to data qubits.", {xy, sim});
        }
        sim.sim.phase_toggle(xy);
    }

    effect_directions() {
        return [
            {dx: 1, dy: 0},
            {dx: -1, dy: 0},
            {dx: 0, dy: 1},
            {dx: 0, dy: -1},
        ];
    }
}

class DoSGate extends PlanElement {
    apply_at(sim, xy) {
        if (!sim.sim.is_data(xy)) {
            throw new DetailedError("Operations must be applied to data qubits.", {xy, sim});
        }
        sim.sim.phase(xy);
    }

    effect_directions() {
        return [
            {dx: 1, dy: 0},
            {dx: -1, dy: 0},
            {dx: 0, dy: 1},
            {dx: 0, dy: -1},
        ];
    }
}

class SurfacePlan {
    /**
     * @param {!Array.<!SurfacePlanLayer>} layers
     */
    constructor(layers = []) {
        this.layers = layers;
    }
}

const CHARACTER_ELEMENT_MAP = new Map([
    [' ', new AssertNotHole()],
    ['#', new AssertHole()],
    ['@', new AssertHole()],
    ['.', new AssertActiveX()],
    [',', new AssertActiveZ()],
    ['>', new ResizeHole(1, 0)],
    ['<', new ResizeHole(-1, 0)],
    ['v', new ResizeHole(0, 1)],
    ['^', new ResizeHole(0, -1)],
    ['0', new IntroduceFreedom(false)],
    ['1', new IntroduceFreedom(true)],
    ['x', new DoXGate()],
    ['z', new DoZGate()],
    ['s', new DoSGate()],
    ['m', new DestroyHole()],
]);

class SurfacePlanLayer {
    /**
     * @param {!int} width
     * @param {!int} height
     * @param {!Map.<!string, {xy: !XY, element: !PlanElement}>} elements
     */
    constructor(width, height, elements = new Map()) {
        this.width = width;
        this.height = height;
        this.elements = elements;
    }

    /**
     * @param {!string} text
     * @returns {!SurfacePlanLayer}
     */
    static parseFrom(text) {
        let result = new Map();
        let lines = text.trim().split('\n').map(e => e.trim());
        for (let row = 1; row < lines.length - 1; row++) {
            let line = lines[row];
            for (let col = 1; col < line.length - 1; col++) {
                let element = CHARACTER_ELEMENT_MAP.get(line[col].toLowerCase());
                if (element === undefined) {
                    throw new DetailedError("Unrecognized symbol.", {symbol: line[col]});
                }
                let xy = new XY(col - 1, row - 1);
                result.set(xy.toString(), {xy, element});
            }
        }
        let width = lines[0].length - 2;
        let height = lines.length - 2;
        return new SurfacePlanLayer(width, height, result);
    }

    /**
     * @param {!SurfaceLogical} sim
     * @returns {!Map.<!string, *>}
     */
    apply_to(sim) {
        let order = [];
        let seen = new Set();
        for (let {xy} of this.elements.values()) {
            this._order_helper(xy, seen, order);
        }
        order.reverse();
        let results = new Map();
        for (let e of order) {
            let {xy, element} = this.elements.get(e);
            let r = element.apply_at(sim, xy);
            if (r !== undefined) {
                results.set(e, r);
            }
        }
        sim.measure_all_stabilizers();
        return results;
    }

    /**
     * @param {!XY} xy
     * @param {!Set.<!String>} seen
     * @param {!Array.<!String>} out
     * @private
     */
    _order_helper(xy, seen, out) {
        let key = xy.toString();
        if (!this.elements.has(key) || seen.has(key)) {
            return;
        }
        seen.add(key);


        for (let {dx, dy} of this.elements.get(key).element.effect_directions()) {
            for (let m of [1, 2]) {
                this._order_helper(new XY(xy.x + dx*m, xy.y + dy*m), seen, out);
            }
        }
        out.push(key);
    }
}

export {SurfacePlan, SurfacePlanLayer}
