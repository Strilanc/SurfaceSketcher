import {Box} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";

/**
 * @param {!int} codeDistance
 * @returns {{w: !int, h: !int}}
 */
function codeDistanceToPipeSize(codeDistance) {
    let w = Math.ceil(codeDistance / 4);
    let h = Math.ceil((codeDistance - 2) / 4);
    w = Math.max(w*2 - 1, 1);
    h = Math.max(h*2 - 1, 1);
    return {w, h};
}

/**
 * @param {!int} codeDistance
 * @returns {!int}
 */
function codeDistanceToPipeSeparation(codeDistance) {
    return codeDistance * 2 - 1;
}

/**
 * @param {!int} codeDistance
 * @returns {{w: !int, h: !int}}
 */
function codeDistanceUnitCellSize(codeDistance) {
    let {w, h} = codeDistanceToPipeSize(codeDistance);
    let s = codeDistanceToPipeSeparation(codeDistance);
    w += s;
    h += s;
    return {w, h};
}

/**
 * @param {!int} codeDistance
 * @returns {!{dx: !int, dy: !int}}
 */
function dualOffset(codeDistance) {
    let unitSize = codeDistanceUnitCellSize(codeDistance);
    return {
        dx: Math.floor((unitSize.w - 1) / 4) * 2 + 1,
        dy: Math.floor((unitSize.h - 1) / 4) * 2 + 1
    };
}

/**
 * @param {!Box} box
 * @returns {!Box}
 */
function primalBoxToDualBox(box) {
    return new Box(box.baseCorner.plus(new Vector(0.5, 0.5, 0.5)), box.diagonal);
}

/**
 * @param {!function(codeDistance: !int): !UnitCellSocketFootprint} footprintFunc
 * @returns {!function(codeDistance: !int): !UnitCellSocketFootprint}
 */
function primalFootprintToDualFootprint(footprintFunc) {
    return d => {
        let {dx, dy} = dualOffset(d);
        return footprintFunc(d).offsetBy(dx, dy);
    };
}

const SMALL_DIAMETER = 0.2;
const LONG_DIAMETER = 0.8;

export {
    codeDistanceToPipeSize,
    codeDistanceToPipeSeparation,
    codeDistanceUnitCellSize,
    dualOffset,
    primalBoxToDualBox,
    primalFootprintToDualFootprint,
    SMALL_DIAMETER,
    LONG_DIAMETER,
}
