import {Point} from "src/geo/Point.js";


class RenderData {
    /**
     * @param {!Array.<!Point>} points
     * @param {!Array.<![!number, !number, !number, !number]>} colors
     * @param {!Array.<!int>} indices
     * @param {!RenderData} wireframe
     */
    constructor(points, colors, indices, wireframe) {
        this.points = points;
        this.colors = colors;
        this.indices = indices;
        this.wireframe = wireframe === undefined ? this : wireframe;
    }

    /**
     * @param {![!number, !number, !number, !number]} color1
     * @param {![!number, !number, !number, !number]} color2
     * @param {!Point} pt1
     * @param {!Point} pt2
     * @returns {!RenderData}
     */
    withColorsReplacedByGradient(color1, color2, pt1, pt2) {
        let colors = [];
        for (let i = 0; i < this.points.length; i++) {
            colors.push(color_lerp_points(this.points[i], color1, color2, pt1, pt2));
        }
        if (this === this.wireframe) {
            return new RenderData(this.points, colors, this.indices, undefined);
        } else {
            return new RenderData(
                this.points,
                colors,
                this.indices,
                this.wireframe.withColorsReplacedByGradient(color1, color2, pt1, pt2));
        }
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
