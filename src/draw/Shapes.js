/**
 * Utility methods related to rendering simple shapes.
 */

import {Point} from "src/geo/Point.js"
import {RenderData} from "src/geo/RenderData.js"
import {Seq} from "src/base/Seq.js";

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
    return new RenderData([], [], [], lineSegmentPathWireframeRenderData(points, color, closedLoop));
}

/**
 * @param {!Array.<!Point>} points
 * @param {undefined|![!number, !number, !number, !number]} color
 * @param {!boolean} closedLoop
 * @returns {!RenderData}
 */
function lineSegmentPathWireframeRenderData(points, color=[0, 0, 0, 1], closedLoop=false) {
    if (color === undefined) {
        return new RenderData([], [], [], undefined);
    }
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
    return new RenderData(points, colors, indices, undefined);
}

/**
 * @param {!Point} rootPoint
 * @param {!Array.<!Point>} points
 * @param {![!number, !number, !number, !number]} fillColor
 * @param {![!number, !number, !number, !number]} lineColor
 * @returns {!RenderData}
 */
function polygonRenderData(rootPoint, points, fillColor, lineColor=[0, 0, 0, 1]) {
    let border = lineSegmentPathWireframeRenderData(points, lineColor, true);

    let trianglePoints = [rootPoint, ...points];
    let indices = [];
    for (let i = 0; i < points.length; i++) {
        indices.push(0, 1 + i, 1 + (i + 1) % points.length);
    }

    let colors = [];
    while (colors.length < trianglePoints.length) {
        colors.push(fillColor);
    }

    return new RenderData(trianglePoints, colors, indices, border);
}

/**
 * @param {!Point} center
 * @param {!Vector} horizontalDelta
 * @param {!Vector} verticalDelta
 * @param {![!number, !number, !number, !number]} fillColor
 * @param {![!number, !number, !number, !number]} lineColor
 * @param {!int} divisions
 * @returns {!RenderData}
 */
function circleRenderData(center, horizontalDelta, verticalDelta, fillColor, lineColor=[0, 0, 0, 1], divisions=16) {
    let perimeterPoints = Seq.range(divisions).map(i => {
        let theta = i / divisions * Math.PI * 2;
        let h = Math.sin(theta);
        let v = Math.cos(theta);
        return center.plus(horizontalDelta.scaledBy(h)).plus(verticalDelta.scaledBy(v));
    }).toArray();
    return polygonRenderData(center, perimeterPoints, fillColor, lineColor);
}

export {pyramidRenderData, lineSegmentPathRenderData, circleRenderData, polygonRenderData}
