/**
 * A Map that can use keys that aren't primitives. Assumes that the key's toString method returns an
 * appropriate key that respects the desired equality.
 */
import {equate_Maps} from "src/base/Equate.js";
import {seq} from "src/base/Seq.js";
import {DetailedError} from "src/base/DetailedError.js";

class GeneralMap {
    /**
     * @param {...[*, *]} entries
     */
    constructor(...entries) {
        this._items = /** @type {!Map.<!string, *>} */ new Map();
        for (let [key, val] of entries) {
            this.set(key, val);
        }
    }

    /**
     * @returns {!Iterator.<*>}
     */
    entries() {
        return this._items.values();
    }

    /**
     * @returns {!Iterable.<*>}
     */
    keys() {
        return seq(this._items.values()).map(e => e[0])._iterable;
    }

    /**
     * @returns {!Iterable.<*>}
     */
    values() {
        return seq(this._items.values()).map(e => e[1])._iterable;
    }

    /**
     * @param {*} key
     * @param {*} value
     */
    set(key, value) {
        this._items.set(key.toString(), [key, value]);
    }

    /**
     * @param {*} key
     * @returns {!boolean}
     */
    has(key) {
        return this._items.has(key.toString());
    }

    /**
     * @param {*} key
     * @param {*} notPresentValue
     * @returns {undefined|*}
     */
    get(key, notPresentValue=undefined) {
        let entry = this._items.get(key.toString());
        return entry !== undefined ? entry[1] : notPresentValue;
    }

    /**
     * @param {*} key
     * @param {!function(): *} defaultValueProducer
     * @returns {*}
     */
    getOrInsert(key, defaultValueProducer) {
        let entry = this._items.get(key.toString());
        if (entry !== undefined) {
            return entry[1];
        }

        let val = defaultValueProducer();
        this.set(key, val);
        return val;
    }

    /**
     * @returns {!int}
     */
    get size() {
        return this._items.size;
    }

    //noinspection ReservedWordAsName
    /**
     * @param {*} key
     */
    delete(key) {
        this._items.delete(key.toString());
    }

    clear() {
        this._items.clear();
    }

    /**
     * @param {!GeneralSet|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof GeneralMap && equate_Maps(this._items, other._items);
    }

    /**
     * @param {!function(value: *): *} valueFunc
     * @returns {!GeneralMap}
     */
    mapValues(valueFunc) {
        let result = new GeneralMap();
        for (let [k, v] of this.entries()) {
            result.set(k, valueFunc(v));
        }
        return result;
    }

    /**
     * @param {!function(value: *): *} valueFunc
     * @returns {!GeneralMap}
     */
    mapKeys(keyFunc) {
        let result = new GeneralMap();
        for (let [k, v] of this.entries()) {
            result.set(keyFunc(k), v);
        }
        if (result.size !== this.size) {
            throw new DetailedError('Irreversible key mapping.', {keyFunc, n1: this.size, n2: result.size});
        }
        return result;
    }

    /**
     * @returns {!string}
     */
    toString() {
        let vals = [...this._items.values()].map(e => `${e[0]}: ${e[1]}`);
        vals.sort();
        return '{' + vals.join(', ') + '}';
    }
}

export {GeneralMap}
