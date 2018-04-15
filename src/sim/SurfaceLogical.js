import {DetailedError} from "src/base/DetailedError.js";
import {Surface, XY, Measurement} from "src/sim/Surface.js";


class Motion {
    /**
     * @param {!XY} start
     * @param {!int} dx
     * @param {!int} dy
     */
    constructor(start, dx, dy) {
        if (Math.abs(dx) + Math.abs(dy) !== 1 || dx * dy !== 0) {
            throw new DetailedError("Invalid direction. Must be an axis-aligned unit vector.", {start, dx, dy});
        }
        this.start = start;
        this.dx = dx;
        this.dy = dy;
    }

    /**
     * @returns {!Motion}
     */
    reverse() {
        return new Motion(new XY(this.start.x + 2*this.dx, this.start.y + 2*this.dy), -this.dx, -this.dy);
    }

    /**
     * If moving off of a measurement qubit, this returns the position of the data qubit to be passed over.
     * @param {!boolean} must_be_active
     * @returns {XY}
     */
    drop(must_be_active=undefined) {
        if (must_be_active === undefined) {
            must_be_active = this.start.must_be_active;
        }
        return new XY(this.start.x + this.dx, this.start.y + this.dy, must_be_active);
    }

    /**
     * @param {!Motion|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof Motion &&
            this.start.isEqualTo(other.start) &&
            this.dx === other.dx &&
            this.dy === other.dy;
    }

    /**
     * @returns {!string}
     */
    toString() {
        let f = v => v === 0 ? '' : v === 1 ? '++' : '--';
        return `(${this.start.x}${f(this.dx)}, ${this.start.y}${f(this.dy)})`;
    }
}

const STATE_ZERO = "|0>";
const STATE_ONE = "|1>";
const STATE_PLUS = "|+>";
const STATE_MINUS = "|->";

class DoubleDefectQubit {
    /**
     * @param {!XY} a
     * @param {!XY} b
     */
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }

    toString() {
        return `${this.a} : ${this.b}`;
    }
}

class SurfaceLogical {
    /**
     * @param {!Surface} sim
     */
    constructor(sim) {
        this.sim = sim;
    }

    /**
     * @returns {!SurfaceLogical}
     */
    clone() {
        return new SurfaceLogical(this.sim.clone());
    }

    destruct() {
        this.sim.destruct();
    }

    /**
     * @param {!DoubleDefectQubit} q
     */
    is_primal(q) {
        return this.is_x_cut(q);
    }

    /**
     * @param {!DoubleDefectQubit} q
     */
    is_dual(q) {
        return this.is_z_cut(q);
    }

    /**
     * @param {!DoubleDefectQubit} q
     */
    is_z_cut(q) {
        return this.sim.is_z(q.a);
    }

    /**
     * @param {!DoubleDefectQubit} q
     */
    is_x_cut(q) {
        return this.sim.is_x(q.a);
    }

    measure_all_stabilizers() {
        for (let i = 0; i < this.sim.width; i++) {
            for (let j = i & 1; j < this.sim.height; j += 2) {
                this.sim.measure_local_stabilizer(new XY(i, j, true));
            }
        }
    }

    clear_x_stabilizers() {
        this.measure_all_stabilizers();
        for (let j = 1; j < this.sim.height; j += 2) {
            let parity = false;
            for (let i = (this.sim.width | 1) - 2; i >= 0; i -= 2) {
                parity ^= this.sim.last_measure(new XY(i, j)).result;
                if (parity) {
                    this.sim.phase_toggle(new XY(i - 1, j));
                }
            }
        }
        this.measure_all_stabilizers();
    }

    /**
     * @returns {!string}
     */
    toString() {
        let x_hole = '#';
        let z_hole = '@';
        let table = [];
        for (let j = 0; j <= this.sim.height + 1; j++) {
            let row = [];
            for (let i = 0; i <= this.sim.width + 1; i++) {
                row.push(' ');
            }
            table.push(row);
        }
        for (let j = 1; j <= this.sim.height; j++) {
            for (let i of [-1, this.sim.width]) {
                table[j][i + 1] = this.sim.is_x_col(i) ? x_hole : z_hole;
            }
        }
        for (let i = 1; i <= this.sim.width; i++) {
            for (let j of [-1, this.sim.height]) {
                table[j + 1][i] = this.sim.is_x_row(j) ? x_hole : z_hole;
            }
        }

        for (let j = 1; j <= this.sim.height; j++) {
            for (let i = 1; i <= this.sim.width; i++) {
                let p = new XY(i - 1, j - 1);
                let in_hole = this.sim.is_disabled(p);
                let is_x = this.sim.is_x(p);
                let is_z = this.sim.is_z(p);
                let m = this.sim.last_measure(p);

                if (in_hole) {
                    if (table[i - 1][j] !== ' ') {
                        table[i][j] = table[i - 1][j];
                    } else if (table[i][j - 1] !== ' ') {
                        table[i][j] = table[i][j - 1];
                    } else if (is_x) {
                        table[i][j] = x_hole;
                    } else if (is_z) {
                        table[i][j] = z_hole;
                    } else {
                        table[i][j] = '?';
                    }
                } else if (is_x || is_z) {
                    if (m.random) {
                        table[i][j] = '!';
                    } else if (m.result) {
                        table[i][j] = is_x ? 'X' : 'Z';
                    }
                }
            }
        }

        return table.map(e => e.join('')).join('\n');
    }

    measure_stabilizers_and_print_state() {
        this.measure_all_stabilizers();
        console.log(this.toString());
    }

    /**
     * @param {!XY} xy
     */
    start_hole(xy) {
        let m = this.sim._qubit_at(new XY(xy.x, xy.y, true));
        if (m === undefined) {
            throw new DetailedError("Can't start a hole there.", {xy});
        }
        this.sim.set_disabled(xy, true);
    }

    /**
     * @param {!XY} xy
     * @returns {!boolean}
     */
    enable_at(xy) {
        return this.sim.set_disabled(xy, false);
    }

    /**
     * @param {!XY} xy
     */
    type_toggle_around_stabilizer(xy) {
        let n = this.sim.neighbors(xy);
        for (let e of n) {
            if (this.sim.is_x(xy)) {
                this.sim.toggle(e);
            }
            if (this.sim.is_z(xy)) {
                this.sim.phase_toggle(e);
            }
        }
    }

    /**
     * @param {!Motion} motion
     * @returns {!Measurement}
     */
    extend_hole(motion) {
        let xy = motion.start;
        let dx = motion.dx;
        let dy = motion.dy;
        if (!this.sim.is_disabled(xy) || this.sim.is_data(xy)) {
            throw new DetailedError("Can't extend hole here.", {xy, dx, dy});
        }
        let x = xy.x;
        let y = xy.y;
        let p2 = new XY(x + dx, y + dy, true);
        let p3 = new XY(x + 2 * dx, y + 2 * dy);
        if (this.sim.is_z(xy)) {
            this.sim.hadamard(p2);
        }
        let m = this.sim.measure_and_reset(p2);
        if (m.result) {
            this.type_toggle_around_stabilizer(p3);
        }
        this.sim.set_disabled(p2, true);
        this.sim.set_disabled(p3, true);
        return m;
    }

    /**
     * @param {!XY} xy
     */
    fill_hole(xy) {
        this.sim.set_disabled(xy, true);
        for (let e of this.sim.neighbors(xy)) {
            this.sim.set_disabled(e, true);
        }
    }

    /**
     * @param {!Motion} motion
     */
    shrink_hole(motion) {
        let xy = motion.start;
        let dx = motion.dx;
        let dy = motion.dy;
        let z_type = this.sim.is_z(xy);
        let x = xy.x;
        let y = xy.y;
        this.sim.set_disabled(xy, false);
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                let p = new XY(x + i, y + j);
                if (this.enable_at(p) && this.sim.is_data(p)) {
                    this.sim.measure_and_reset(p);
                    if (this.sim.is_z(xy)) {
                        this.sim.hadamard(p);
                    }
                }
            }
        }
        let m = this.sim.measure_local_stabilizer(xy);
        if (m.result) {
            if (z_type) {
                this.sim.toggle(new XY(x + dx, y + dy));
            } else {
                this.sim.phase_toggle(new XY(x + dx, y + dy));
            }
        }
    }

    /**
     * @param {!XY} xy
     * @returns {!Measurement}
     */
    end_hole(xy) {
        this.enable_at(xy);
        return this.sim.measure_local_stabilizer(xy);
    }

    /**
     * @param {!XY} xy
     * @param {!int} diameter
     */
    dig_square_hole(xy, diameter) {
        let w = diameter;
        let h = diameter;
        let x = xy.x;
        let y = xy.y;
        this.start_hole(xy);
        for (let i = 0; i < w; i++) {
            if (i < w - 1) {
                this.extend_hole(new Motion(new XY(x + i * 2, y), 1, 0));
            }
            for (let j = 0; j < h; j++) {
                if (j < h - 1) {
                    this.extend_hole(new Motion(new XY(x + i * 2, y + j * 2), 0, 1));
                }

                if (i > 0 && j > 0) {
                    this.fill_hole(new XY(x + i * 2 - 1, y + j * 2 - 1));
                }
            }
        }
    }

    /**
     * @param {!XY} xy
     * @param {!int} diameter
     * @returns {!Measurement}
     */
    fill_square_hole(xy, diameter) {
        let w = diameter;
        let h = diameter;
        let x = xy.x;
        let y = xy.y;
        for (let i = w - 1; i >= 0; i--) {
            for (let j = h - 1; j > 0; j--) {
                this.shrink_hole(new Motion(new XY(x + i * 2, y + j * 2), 0, -1));
            }
            if (i > 0) {
                this.shrink_hole(new Motion(new XY(x + i * 2, y), -1, 0));
            }
        }

        return this.end_hole(xy);
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     * @returns {!Array.<!Motion>}
     */
    path_between(p1, p2) {
        let x = p1.x;
        let y = p1.y;
        let result = [];

        while (x < p2.x) {
            result.push(new Motion(new XY(x, y), 1, 0));
            x += 2;
        }
        while (x > p2.x) {
            result.push(new Motion(new XY(x, y), -1, 0));
            x -= 2;
        }
        while (y < p2.y) {
            result.push(new Motion(new XY(x, y), 0, +1));
            y += 2;
        }
        while (y > p2.y) {
            result.push(new Motion(new XY(x, y), 0, -1));
            y -= 2;
        }

        return result;
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     */
    type_toggle_between(p1, p2) {
        let x_type = this.sim.is_x(p1);
        for (let motion of this.path_between(p1, p2)) {
            let p = motion.drop(true);
            if (x_type) {
                this.sim.phase_toggle(p);
            } else {
                this.sim.toggle(p);
            }
        }
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     */
    extend_between(p1, p2) {
        for (let motion of this.path_between(p1, p2)) {
            this.extend_hole(motion);
        }
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     */
    shrink_between(p1, p2) {
        for (let motion of this.path_between(p1, p2)) {
            this.shrink_hole(motion);
        }
    }

    /**
     * @param {!Array.<!XY>} ps
     */
    extend_segments(ps) {
        for (let i = 0; i + 1 < ps.length; i++) {
            this.extend_between(ps[i], ps[i + 1]);
        }
    }

    /**
     * @param {!Array.<!XY>} ps
     */
    shrink_segments(ps) {
        for (let i = 0; i + 1 < ps.length; i++) {
            this.shrink_between(ps[i], ps[i + 1]);
        }
    }

    /**
     * Cuts a hole into two separate holes.
     * @param {!Motion} motion Indicates the side of the stabilizer to make the cut along.
     * @param {!boolean} toggle
     */
    cut(motion, toggle) {
        let d = motion.drop();
        this.enable_at(d);
        let z_type = this.sim.is_z(motion.start);
        this.sim.measure_and_reset(d);
        if (z_type) {
            this.sim.hadamard(d);
        }
        if (toggle) {
            this.type_toggle_around_stabilizer(motion.start);
        }
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     * @param {!int} diameter
     * @param {!boolean=} toggle_line
     * @param {!int=} diameter2
     */
    create_hole_pair(p1, p2, diameter, toggle_line = false, diameter2 = undefined) {
        this.dig_square_hole(p1, diameter);
        this.dig_square_hole(p2, diameter2 === undefined ? diameter : diameter2);
        if (toggle_line) {
            this.type_toggle_between(p1, p2);
        }
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     * @param {!boolean=} toggle_value
     */
    seed_hole_pair(p1, p2, toggle_value = false) {
        this.dig_square_hole(p1, 1);
        let first = true;
        for (let motion of this.path_between(p1, p2)) {
            this.extend_hole(motion);
            if (first) {
                this.cut(motion, toggle_value);
            } else {
                this.shrink_hole(motion);
            }
            first = false;
        }
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     * @param {!int} diameter
     * @param {!boolean=} clear_line
     * @param {!int=undefined} diameter2
     * @returns {!Measurement}
     */
    drop_hole_into(p1, p2, diameter = 1, clear_line = true, diameter2 = undefined) {
        let m = this.fill_square_hole(p1, diameter);
        let alt_m = this.fill_square_hole(p2, diameter2 === undefined ? diameter : diameter2);
        if (m.result !== alt_m.result || alt_m.random) {
            throw new DetailedError("Redundant measurement wasn't redundant.", {p1, p2, m, alt_m})
        }
        if (clear_line && m.result) {
            this.type_toggle_between(p1, p2);
        }
        return m;
    }

    /**
     * @param {!Array.<!XY>} ps
     */
    move_hole(ps) {
        for (let i = 0; i + 1 < ps.length; i++) {
            this.extend_between(ps[i], ps[i + 1]);
            this.shrink_between(ps[i], ps[i + 1]);
        }
    }

    /**
     * @param {!XY} mover
     * @param {!XY} target
     * @param {!int} diameter
     */
    braid_hole(mover, target, diameter) {
        let x = target.x;
        let y = target.y;
        let d = diameter * 2 + 1;
        let p1 = new XY(x - d, y - d);
        let p2 = new XY(x + d, y - d);
        let p3 = new XY(x + d, y + d);
        let p4 = new XY(x - d, y + d);
        let cycle;
        if (mover.x < target.x && mover.y < target.y) {
            cycle = [p1, p2, p3, p4];
        } else if (mover.x > target.x && mover.y < target.y) {
            cycle = [p2, p3, p4, p1];
        } else if (mover.x > target.x && mover.y > target.y) {
            cycle = [p3, p4, p1, p2];
        } else {
            cycle = [p4, p1, p2, p3];
        }

        this.move_hole([mover, ...cycle, mover]);
    }

    /**
     * @param {!DoubleDefectQubit} control
     * @param {!DoubleDefectQubit} target
     * @param {!boolean=} move_control
     */
    logical_cnot(control, target, move_control = true) {
        if (!this.sim.is_z(control.a)) {
            throw new DetailedError("Wrong CNOT direction for defect types.", {control, target});
        }

        if (move_control) {
            this.braid_hole(control.a, target.a, 1);
        } else {
            this.braid_hole(target.a, control.a, 1);
        }
    }

    /**
     * @param {!DoubleDefectQubit} q
     * @param {!boolean} x_type
     */
    logical_pauli(q, x_type) {
        if (x_type === this.sim.is_x(q.a)) {
            this.type_toggle_around_stabilizer(q.a);
        } else {
            this.type_toggle_between(q.a, q.b);
        }
    }

    /**
     * @param {!DoubleDefectQubit} q
     */
    logical_x(q) {
        this.logical_pauli(q, true);
    }

    /**
     * @param {!DoubleDefectQubit} q
     */
    logical_z(q) {
        this.logical_pauli(q, false);
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     * @returns {!Measurement}
     */
    smash_hole_into(p1, p2) {
        let m = new Measurement(false, false);
        for (let motion of this.path_between(p1, p2)) {
            m = this.extend_hole(motion);
        }
        this.shrink_between(p1, p2);
        this.end_hole(p2);
        return m;
    }

    /**
     * @param {!DoubleDefectQubit} q
     * @param {!boolean} do_x_type
     * @returns {!Measurement}
     */
    measure_logical_axis(q, do_x_type) {
        let x_type = this.sim.is_x(q.a);
        if (x_type !== do_x_type) {
            return this.smash_hole_into(q.a, q.b);
        } else {
            return this.drop_hole_into(q.a, q.b);
        }

    }

    /**
     * @param {!DoubleDefectQubit} q
     * @returns {!Measurement}
     */
    measure_logical_x(q) {
        return this.measure_logical_axis(q, true);
    }

    /**
     * @param {!DoubleDefectQubit} q
     * @returns {!Measurement}
     */
    measure_logical_z(q) {
        return this.measure_logical_axis(q, false);
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     * @param {!boolean} x_type
     */
    inject_sqrt_s_or_sqrt_x(p1, p2, x_type) {
        let r = this.path_between(p1, p2);
        let m = r.pop();
        for (let e of r) {
            this.extend_hole(e);
        }
        let c = new XY(m.start.x + m.dx, m.start.y + m.dy);
        if (this.sim.is_x(p1) !== x_type) {
            throw new DetailedError("randomized sqrt injection", {p1, p2, x_type});
        } else if (x_type) {
            this.sim.hadamard(c);
            this.sim.phase(c);
            this.sim.hadamard(c);
        } else {
            this.sim.phase(c);
        }

        for (let e of reverse_path(r)) {
            this.shrink_hole(e);
        }
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     */
    inject_s(p1, p2) {
        this.inject_sqrt_s_or_sqrt_x(p1, p2, false);
    }

    /**
     * @param {!XY} p1
     * @param {!XY} p2
     */
    inject_sqrt_x(p1, p2) {
        this.inject_sqrt_s_or_sqrt_x(p1, p2, true);
    }

    /**
     * @param {!DoubleDefectQubit} q
     * @returns {!{x: !number, y: !number, z: !number}}
     */
    peek_logical_bloch_vector(q) {
        let copy = this.clone();

        let r = copy.path_between(q.a, q.b);
        let m = r.pop();
        for (let e of r) {
            copy.extend_hole(e);
            copy.shrink_hole(e);
        }
        let s = m.dx + m.dy;
        let c = new XY(m.start.x - s, m.start.y - s);
        copy.dig_square_hole(c, 1);
        copy.extend_hole(new Motion(c, m.dx, m.dy));
        let sx = s * m.dy * m.dy;
        let sy = s * m.dx * m.dx;
        copy.extend_hole(new Motion(c, sx, sy));
        copy.extend_hole(new Motion(new XY(c.x + 2 * sx, c.y + 2 * sy), m.dx, m.dy));
        return copy.sim.peek_bloch_vector(new XY(m.start.x + m.dx, m.start.y + m.dy));
    }

    /**
     * @param {!DoubleDefectQubit} q
     * @param {!string=} state
     */
    init_logical(q, state = STATE_ZERO) {
        let dual_type = this.sim.is_x(q.a);
        let z_axis = state === STATE_ZERO || state === STATE_ONE;
        let toggle_value = state === STATE_ONE || state === STATE_MINUS;
        if (dual_type === z_axis) {
            this.seed_hole_pair(q.a, q.b, toggle_value);
        } else {
            this.create_hole_pair(q.a, q.b, 1, toggle_value);
        }
    }

    /**
     * @param {!Array.<!DoubleDefectQubit>} targets
     */
    dual_logical_s_combo(targets) {
        let y_state = new DoubleDefectQubit(
            new XY(
                targets[0].a.x + 3,
                targets[0].a.y + 3),
            new XY(
                targets[0].a.x + 5,
                targets[0].a.y + 3));
        this.init_logical(y_state, STATE_PLUS);
        this.inject_s(y_state.a, y_state.b);
        for (let target of targets) {
            this.logical_cnot(target, y_state, false);
        }
        if (this.measure_logical_z(y_state).result) {
            for (let target of targets) {
                this.logical_z(target);
            }
        }
    }

    /**
     * @param {!DoubleDefectQubit} target
     */
    dual_logical_s(target) {
        this.dual_logical_s_combo([target]);
    }
}

/**
 * @param {!Array.<!Motion>} path
 * @returns {!Array.<!Motion>}
 */
function reverse_path(path) {
    let result = [];
    for (let i = path.length - 1; i >= 0; i--) {
        result.push(path[i].reverse());
    }
    return result;
}

export {SurfaceLogical, DoubleDefectQubit, Motion, STATE_ZERO, STATE_ONE, STATE_PLUS, STATE_MINUS}
