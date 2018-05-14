import {seq} from "src/base/Seq.js";
import {XY} from "src/sim/util/XY.js";
import {Axis} from "src/sim/util/Axis.js";
import {GeneralSet} from "src/base/GeneralSet.js"
import {GeneralMap} from "src/base/GeneralMap.js"
import {DetailedError} from "src/base/DetailedError.js";
import {setMembershipInOfTo, xorSetInto, makeArrayGrid} from "src/sim/util/Util.js";
import {PauliMap} from "src/sim/util/PauliMap.js";
import {indent} from "src/base/Util.js";


class ControlledPauliMaps {
    /**
     * @param {!GeneralMap.<!XYT, !PauliMap>} pauliMaps
     */
    constructor(pauliMaps=new GeneralMap()) {
        /**
         * @type {!GeneralMap.<!XYT, !PauliMap>}
         * @private
         */
        this._pauliMaps = pauliMaps;

        /**
         * An index that allows fast lookup of the controls operating on a given target.
         * @type {GeneralMap.<!XY, !GeneralSet.<!XYT>>}
         * @private
         */
        this._targetToControls = this._regeneratedTargetToControlsMap();
    }

    /**
     * @returns {!Iterator.<![!XYT, !PauliMap]>}
     */
    entries() {
        return this._pauliMaps.entries();
    }

    /**
     * @returns {!ControlledPauliMaps}
     */
    clone() {
        return new ControlledPauliMaps(this._pauliMaps.mapValues(e => e.clone()));
    }

    /**
     * @param {!XY} control
     * @param {!XY} target
     */
    cnot(control, target) {
        for (let k of this.controlsAffecting(control, target)) {
            this._pauliMaps.get(k).cnot(control, target);
            this._syncTargetToControlsFor(control, k);
            this._syncTargetToControlsFor(target, k);
        }
    }

    /**
     * @param {!XY} target
     */
    hadamard(target) {
        for (let k of this.controlsAffecting(target)) {
            this._pauliMaps.get(k).hadamard(target);
            this._syncTargetToControlsFor(target, k);
        }
    }

    /**
     * @param {!XYT} control
     * @returns {undefined|!PauliMap}
     */
    pauliMapForControl(control) {
        return this._pauliMaps.get(control);
    }

    /**
     * @param {!XYT} control
     * @param {!XY} target
     */
    feedforward_x(control, target) {
        this._pauliMaps.getOrInsert(control, () => new PauliMap()).x(target);
        this._syncTargetToControlsFor(target, control);
    }

    /**
     * @param {!XYT} control
     * @param {!XY} target
     */
    feedforward_z(control, target) {
        this._pauliMaps.getOrInsert(control, () => new PauliMap()).z(target);
        this._syncTargetToControlsFor(target, control);
    }

    /**
     * @param {!function(control: !XYT) : !XYT} controlFunc
     * @returns {!ControlledPauliMaps}
     */
    mapControls(controlFunc) {
        return new ControlledPauliMaps(this._pauliMaps.mapKeys(controlFunc));
    }

    /**
     * @param {!ControlledPauliMaps} other
     * @returns {!ControlledPauliMaps}
     */
    union(other) {
        return this.clone().inline_union(other);
    }

    /**
     * @param {!ControlledPauliMaps} other
     * @returns {!ControlledPauliMaps}
     */
    inline_union(other) {
       for (let [control, map] of other._pauliMaps.entries()) {
           this._pauliMaps.getOrInsert(control, () => new PauliMap()).inline_union(map);
       }
       return this;
    }

    /**
     * @returns {!GeneralMap.<!XY, !GeneralSet.<!XYT>>}
     * @private
     */
    _regeneratedTargetToControlsMap() {
        let result = new GeneralMap();
        for (let [xyt, pauliMap] of this._pauliMaps.entries()) {
            for (let xy of pauliMap.targets()) {
                result.getOrInsert(xy, () => new GeneralSet()).add(xyt);
            }
        }
        return result;
    }

    /**
     * Performs an incremental update of the target-to-control map, focused on the given pair.
     * @param {!XY} target
     * @param {!XYT} control
     * @private
     */
    _syncTargetToControlsFor(target, control) {
        let controlsForTarget = this._targetToControls.getOrInsert(target, () => new GeneralSet());
        let targetsForControl = this._pauliMaps.get(control);
        setMembershipInOfTo(
            controlsForTarget,
            control,
            targetsForControl !== undefined && targetsForControl.get(target) !== 0);
    }

    /**
     * Looks up controls that operate on the given target.
     * @param {...!XY} xy
     * @returns {!Array.<!XYT>}
     */
    controlsAffecting(...xy) {
        return seq(xy).flatMap(k => this._targetToControls.get(k, [])).distinct().toArray();
    }

    /**
     * @param {*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof ControlledPauliMaps &&
            this._pauliMaps.isEqualTo(other._pauliMaps);
    }

    /**
     * @returns {!string}
     */
    toString() {
        let rows = [];
        for (let [k, v] of this._pauliMaps.entries()) {
            rows.push(`IF ${k} THEN ${v}`);
        }
        return `ControlledPauliMaps {\n${indent(rows.join('\n'))}\n}`
    }
}

export {ControlledPauliMaps}
