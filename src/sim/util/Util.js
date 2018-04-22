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
 * @param {!Set.<T>} set The set the caller wants to contain (or not contain) the given item.
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
 * @param {!Set.<T>} set The set to update.
 * @param {T} item The item to add xor remove from the set.
 * @template T
 */
function toggleMembership(set, item) {
    setMembershipInOfTo(set, item, !set.has(item));
}

/**
 * @param {!Set.<T>} src
 * @param {!Set.<T>} dst
 * @template T
 */
function xorSetInto(src, dst) {
    for (let e of src) {
        toggleMembership(dst, e);
    }
}

export {setMembershipInOfTo, toggleMembership, xorSetInto, makeArrayGrid}
