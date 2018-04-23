import {GeneralSet} from "src/base/GeneralSet.js";
import {xorSetInto} from "src/sim/util/Util.js";

class MeasurementAdjustment {
    /**
     * @param {!boolean} toggleConstant Whether the measurement result should be flipped or not.
     * @param {!GeneralSet.<!XYT>} toggleConditions Measurements that should be xor'd into this one for the true result.
     */
    constructor(toggleConstant=false, toggleConditions=new GeneralSet()) {
        this.toggleConstant = toggleConstant;
        this.toggleConditions = toggleConditions;
    }

    /**
     * @param {!XYT} event
     * @param {!boolean} result
     */
    updateWithMeasurementResult(event, result) {
        if (this.toggleConditions.has(event)) {
            this.toggleConditions.delete(event);
            if (result) {
                this.toggleConstant = !this.toggleConstant;
            }
        }
    }

    /**
     * @param {!MeasurementAdjustment} other
     */
    inline_combine(other) {
        if (other.toggleConstant) {
            this.toggleConstant = !this.toggleConstant;
        }
        xorSetInto(other.toggleConditions, this.toggleConditions);
    }

    /**
     * @param {!MeasurementAdjustment|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof MeasurementAdjustment &&
            this.toggleConstant === other.toggleConstant &&
            this.toggleConditions.isEqualTo(other.toggleConditions);
    }
}

export {MeasurementAdjustment}
