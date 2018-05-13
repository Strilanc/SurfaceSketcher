import {seq} from "src/base/Seq.js";
import {Point} from "src/geo/Point.js";
import {DetailedError} from "src/base/DetailedError.js";


class RenderData {
    /**
     * @param {!Array.<!Point>} points Point data that the indices list indexes into.
     * @param {!Array.<![!number, !number, !number, !number]>} colors
     *     Each entry in this list specifies the color to of a point in the points list.
     * @param {!Array.<!Array.<!int>>} indices Points identified by index from the points list.
     * @param {undefined|!RenderData} wireframe
     *     Render data for the same thing, but reformated for drawing wireframes.
     * @param {undefined|!Array.<![!number, !number]>} uv
     *     Render data for the same thing, but reformated for drawing wireframes.
     */
    constructor(points, colors, indices, wireframe, uv=undefined) {
        if (!Array.isArray(points) || (points.length > 0 && !(points[0] instanceof Point))) {
            throw new DetailedError('Not an array of points.', {points});
        }
        this.points = points;
        this.colors = colors;
        this.indices = indices;
        if (uv === undefined) {
            uv = [];
            while (uv.length < colors.length) {
                uv.push([0, 0]);
            }
        }
        this.uv = uv;

        if (points.length !== colors.length) {
            throw new DetailedError("Number of colors doesn't match number of points.",
                {colorCount: this.colors.length, pointCount: this.points.length});
        }
        if (uv.length !== colors.length) {
            throw new DetailedError("Number of uvs doesn't match number of points.",
                {uvCount: uv.length, pointCount: this.points.length});
        }
        for (let index of this.indices) {
            if (!Number.isInteger(index) || index < 0 || index >= this.points.length) {
                throw new DetailedError("Out of range vertex index.", {index, pointLen: 3 * this.points.length});
            }
        }

        this.wireframe = wireframe === undefined ? this : wireframe;
    }

    /**
     * @param {!Array.<!RenderData>} renderData
     * @returns {!Float32Array}
     */
    static allCoordinateData(renderData) {
        let coords = [];
        for (let e of renderData) {
            for (let pt of e.points) {
                coords.push(pt.x, pt.y, pt.z);
            }
        }
        return new Float32Array(coords);
    }

    /**
     * @param {!Array.<!RenderData>} renderData
     * @returns {!Array.<!Array.<!RenderData>>}
     */
    static splitIntoCallsThatFit(renderData) {
        let results = [];
        let curChunk = [];
        let n = 0;
        for (let dat of renderData) {
            if (!(dat instanceof RenderData)) {
                throw new DetailedError('Not a RenderData.', {dat})
            }
            let d = dat.points.length;
            if (n + d >= (1 << 16)) {
                results.push(curChunk);
                n = 0;
                curChunk = [];
            }
            curChunk.push(dat);
            n += d;
        }
        if (curChunk.length > 0) {
            results.push(curChunk);
        }
        return results;
    }

    /**
     * @param {!Array.<!RenderData>} renderData
     * @returns {!Array.<!RenderData>}
     */
    static allWireframes(renderData) {
        return renderData.map(e => e.wireframe);
    }

    /**
     * @param {!Array.<!RenderData>} renderData
     * @returns {!Float32Array}
     */
    static allColorData(renderData) {
        let colors = [];
        for (let e of renderData) {
            for (let color of e.colors) {
                colors.push(...color);
            }
        }
        return new Float32Array(colors);
    }

    /**
     * @param {!Array.<!RenderData>} renderData
     * @returns {!Float32Array}
     */
    static allUvData(renderData) {
        let uvData = [];
        for (let e of renderData) {
            for (let uv of e.uv) {
                uvData.push(...uv);
            }
        }
        return new Float32Array(uvData);
    }

    /**
     * @param {!Array.<!RenderData>} renderData
     * @returns {!Uint16Array}
     */
    static allIndexData(renderData) {
        let indices = [];
        let offset = 0;
        for (let e of renderData) {
            for (let c of e.indices) {
                indices.push(c + offset);
            }
            offset += e.points.length;
        }
        return new Uint16Array(indices);
    }
}

/**
 * @param {!number} a
 * @param {!number} b
 * @param {!number} t
 * @returns {!number}
 */
function lerp(a, b, t) {
    return a * (1 - t) + b * t;
}

/**
 * @param {!Array.<!number>} a
 * @param {!Array.<!number>} b
 * @param {!number} t
 * @returns {!Array.<!number>}
 */
function lerp_all(a, b, t) {
    let result = [];
    for (let i = 0; i < a.length; i++) {
        result.push(lerp(a[i], b[i], t));
    }
    return result;
}

/**
 * @param {!Point} target
 * @param {![!number, !number, !number, !number]} color1
 * @param {![!number, !number, !number, !number]} color2
 * @param {!Point} pt1
 * @param {!Point} pt2
 * @returns {![!number, !number, !number, !number]}
 */
function color_lerp_points(target, color1, color2, pt1, pt2) {
    let d = pt2.minus(pt1);
    let n = d.length();
    let t = target.minus(pt1).scalarProjectOnto(d) / n;
    return lerp_all(color1, color2, t);
}

export {RenderData}
