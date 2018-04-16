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

export {RenderData}
