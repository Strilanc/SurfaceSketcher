import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"

/**
 * @param {!Point} tip
 * @param {!Point} base
 * @param {!Point} corner
 * @param {![!number, !number, !number, !number]} color
 * @param {undefined|![!number, !number, !number, !number]} lineColor
 * @returns {!RenderData}
 */
function pyramidRenderData(tip, base, corner, color, lineColor) {
    let dh = tip.minus(base);
    let dc = base.minus(corner);
    let dc2 = dh.unit().cross(dc);
    let points = [
        tip,
        base.plus(dc),
        base.plus(dc2),
        base.plus(dc.scaledBy(-1)),
        base.plus(dc2.scaledBy(-1)),
    ];
    let colors = [color, color, color, color, color];
    let indices = [
        0, 1, 2,
        0, 2, 3,
        0, 3, 4,
        0, 4, 1,
        1, 2, 3,
        1, 4, 3,
    ];

    let lineRenderData = undefined;
    if (lineColor !== undefined) {
        let lineIndices = [
            0, 1,
            0, 2,
            0, 3,
            0, 4,
            1, 2,
            2, 3,
            3, 4,
            4, 1,
        ];
        let lineColors = [lineColor, lineColor, lineColor, lineColor, lineColor];
        lineRenderData = new RenderData(points, lineColors, lineIndices, undefined);
    }
    return new RenderData(points, colors, indices, lineRenderData);
}

/**
 * @param {!Array.<!Point>} points
 * @param {![!number, !number, !number, !number]} color
 * @param {!boolean} closedLoop
 * @returns {!RenderData}
 */
function lineSegmentPathRenderData(points, color=[0, 0, 0, 1], closedLoop=false) {
    let indices = [];
    for (let i = 1; i < points.length; i++) {
        indices.push(i - 1, i);
    }
    if (closedLoop) {
        indices.push(points.length - 1, 0);
    }

    let colors = [];
    while (colors.length < points.length) {
        colors.push(color);
    }
    return new RenderData([], [], [], new RenderData(points, colors, indices, undefined));
}

export {pyramidRenderData, lineSegmentPathRenderData}
