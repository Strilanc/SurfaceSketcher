/**
 * Creates a 2d array with elements initialized using the given generator function.
 *
 * The inner arrays are the rows (constant y).
 *
 * @param {!int} width
 * @param {!int} height
 * @param {!function(x: !int, y: !int): T} generator
 * @returns {!Array.<!Array.<T>>}
 * @template T
 */
import {seq, Seq} from "src/base/Seq.js";

function makeArrayGrid(width, height, generator) {
    let result = [];
    for (let y = 0; y < height; y++) {
        let rowEntries = [];
        for (let x = 0; x < width; x++) {
            rowEntries.push(generator(x, y));
        }
        result.push(rowEntries);
    }
    return result;
}

/**
 * Forces a set to contain or not contain an item, based on a boolean parameter.
 * @param {!Set.<T>|!GeneralSet.<T>} set The set the caller wants to contain (or not contain) the given item.
 * @param {T} item The item that the caller wants to be in (or not in) the given set.
 * @param {!boolean} membership Whether or not to include the item in the set.
 * @template T
 */
function setMembershipInOfTo(set, item, membership) {
    if (membership) {
        set.add(item);
    } else {
        set.delete(item);
    }
}

/**
 * Flips whether or not a set contains an item.
 * @param {!Set.<T>|!GeneralSet.<T>} set The set to update.
 * @param {T} item The item to add xor remove from the set.
 * @template T
 */
function toggleMembership(set, item) {
    setMembershipInOfTo(set, item, !set.has(item));
}

/**
 * @param {!Set.<T>|!!GeneralSet.<T>} src
 * @param {!Set.<T>|!!GeneralSet.<T>} dst
 * @template T
 */
function xorSetInto(src, dst) {
    for (let e of src) {
        toggleMembership(dst, e);
    }
}

/**
 * @param {!int} minRow
 * @param {!int} maxRow
 * @param {!int} minCol
 * @param {!int} maxCol
 * @param {!function(row: !int, col: !int): !string} func
 * @returns {!string}
 */
function gridRangeToString(minRow, maxRow, minCol, maxCol, func) {
    let w = maxCol - minCol + 1;
    let rail = Seq.repeat('#', w + 2).join('');
    let rows = [rail];
    for (let row = minRow; row <= maxRow; row++) {
        let cells = [];
        for (let col = minCol; col <= maxCol; col++) {
            let r = func(row, col);
            cells.push(r === undefined ? ' ' : r);
        }
        rows.push('#' + cells.join('') + '#');
    }
    rows.push(rail);
    return rows.join('\n');
}

/**
 * @param {!Array.<!string>} planes
 * @param {!int} maxWidth
 * @returns {!string}
 */
function mergeGridRangeStrings(planes, maxWidth) {
    let p = planes[0].split('\n');
    let cellWidth = p[0].length;
    let cellHeight = p.length;
    let done = [];
    let cur = [];
    let w = 0;
    for (let plane of planes) {
        let planeRows = plane.split('\n');
        let d = planeRows[0].length;
        if (w + d + 3 <= maxWidth) {
            w += d + 3;
            cur.push(planeRows);
        } else {
            done.push(cur);
            cur = [];
        }
        w += d;
    }
    if (cur.length > 0) {
        done.push(cur);
    }

    return done.map(rowCells => {
        let rows = [];
        for (let i = 0; i < cellHeight; i++) {
            rows.push(rowCells.map(e => e[i]).join('   '));
        }
        return rows.join('\n');
    }).join('\n\n');
}

export {
    setMembershipInOfTo,
    toggleMembership,
    xorSetInto,
    makeArrayGrid,
    gridRangeToString,
    mergeGridRangeStrings
}
