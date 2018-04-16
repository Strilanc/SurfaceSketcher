window.onerror = function(msg, url, line, col, error) {
    document.getElementById('err_msg').textContent = describe(msg);
    document.getElementById('err_line').textContent = describe(line);
    document.getElementById('err_time').textContent = '' + new Date().getMilliseconds();
    if (error instanceof DetailedError) {
        document.getElementById('err_gen').textContent = describe(error.details);
    }
};

import {DetailedError} from 'src/base/DetailedError.js'
import {describe} from "src/base/Describe.js";
import {Box, BOX_TRIANGLE_INDICES} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {Camera} from "src/camera.js";
import {RenderData} from "src/geo/RenderData.js";
import {UnitCellMap} from "src/UnitCell.js";
import {ALL_PLUMBING_PIECES, PLUMBING_PIECE_MAP} from "src/PlumbingPieces.js";


let camera = new Camera(new Point(0, 0, 0), 7, -Math.PI/3, Math.PI/4);

let cellMap = new UnitCellMap();
cellMap.cell(new Point(0, 0, 0)).piece_names.add('XPrimal');
cellMap.cell(new Point(0, 0, 1)).piece_names.add('XPrimal');
cellMap.cell(new Point(0, 0, 1)).piece_names.add('YPrimal');
cellMap.cell(new Point(0, 1, 0)).piece_names.add('ZPrimal');
cellMap.cell(new Point(0, 1, 0)).piece_names.add('ZDual');

/**
 * @returns {!Array.<!RenderData>}
 */
function makeRenderData() {
    let result = cellMap.renderData();

    // let d = new Vector(1, 1, 1).scaledBy(0.1);
    // result.push(new Box(camera.focus_point, d));

    if (selectedPlumbingPiece !== undefined) {
        result.push(selectedPlumbingPiece.boxAt(selectedCell).toRenderData([1, 0, 0, 1]));
    }

    return result;
}

const canvas = /** @type {!HTMLCanvasElement} */ document.getElementById('main-canvas');
function main() {
    const canvasDiv = /** @type {!HTMLDivElement} */ document.getElementById('canvasDiv');
    canvas.width = 1000;
    canvas.height = 500;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec4 aVertexColor;

        uniform mat4 uMatrix;

        varying lowp vec4 vColor;

        void main(void) {
            gl_Position = uMatrix * aVertexPosition;
            vColor = aVertexColor;
        }
    `;

    const fsSource = `
        precision highp float;

        varying lowp vec4 vColor;

        void main(void) {
            gl_FragColor = vColor;
        }
    `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
        },
        uniformLocations: {
            matrix: gl.getUniformLocation(shaderProgram, 'uMatrix'),
        },
    };

    const buffers = initBuffers(gl);

    function render() {
        drawScene(gl, programInfo, buffers);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function initBuffers(gl) {
    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    return {
        position: positionBuffer,
        color: colorBuffer,
        indices: indexBuffer,
    };
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {*} programInfo
 * @param {*} buffers
 */
function drawScene(gl, programInfo, buffers) {
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.matrix,
        false,
        camera.worldToScreenMatrix(canvas).transpose().raw);

    let allRenderData = makeRenderData();
    _drawSceneHelper(gl, programInfo, buffers, allRenderData, gl.TRIANGLES);
    _drawSceneHelper(gl, programInfo, buffers, RenderData.allWireframes(allRenderData), gl.LINES);
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {*} programInfo
 * @param {*} buffers
 * @param {!Array.<!RenderData>} allRenderData
 * @param {!number} mode
 */
function _drawSceneHelper(gl, programInfo, buffers, allRenderData, mode) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.bufferData(gl.ARRAY_BUFFER, RenderData.allCoordinateData(allRenderData), gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.bufferData(gl.ARRAY_BUFFER, RenderData.allColorData(allRenderData), gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

    let indexData = RenderData.allIndexData(allRenderData);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

    gl.drawElements(mode, indexData.length, gl.UNSIGNED_SHORT, 0);
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    }

    return shaderProgram;
}

function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        let info = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new DetailedError('Bad shader', {type, source, info});
    }
    return shader;
}

main();

canvas.addEventListener('click', ev => {
    if (selectedPlumbingPiece === undefined || selectedDir === undefined) {
        return;
    }

    // let {x, y, z} = selectedBox.baseCorner;
    // x = Math.round(x);
    // y = Math.round(y);
    // z = Math.round(z);
    // let cell = cellMap.cell(new Point(x, y, z));
    //

    if (!selectedPlumbingPiece.onlyImplied) {
        cellMap.cell(selectedCell).piece_names.delete(selectedPlumbingPiece.name);
        return;
    }

    for (let pp of ALL_PLUMBING_PIECES) {
        for (let imp of pp.implies) {
            if (imp.name === selectedPlumbingPiece.name) {
                let d = pp.box.center().minus(selectedPlumbingPiece.box.center()).minus(imp.offset).unit();
                if (d.isApproximatelyEqualTo(selectedDir, 0.001)) {
                    cellMap.cell(selectedCell.plus(imp.offset.scaledBy(-1))).piece_names.add(pp.name);
                    return;
                }
            }
        }
    }
});

let prevMouse = [0, 0];
/** @type {undefined|!Point} */
let selectedCell = undefined;
/** @type {undefined|!PlumbingPiece} */
let selectedPlumbingPiece = undefined;
/** @type {undefined|!Vector} */
let selectedDir = undefined;
canvas.addEventListener('mousemove', ev => {
    let b = canvas.getBoundingClientRect();
    let curMouse = [ev.clientX - b.left, ev.clientY - b.top];

    if (ev.which === 2) {
        let dx = curMouse[0] - prevMouse[0];
        let dy = curMouse[1] - prevMouse[1];
        if (ev.shiftKey) {
            step(dx * -0.01, dy * 0.01, 0);
        } else {
            camera.yaw += dx * 0.004;
            camera.pitch += dy * 0.004;
            camera.pitch = Math.max(Math.min(camera.pitch, Math.PI/2), -Math.PI/2);
        }
    }
    prevMouse = curMouse;

    let ray = camera.screenPosToWorldRay(canvas, curMouse[0], curMouse[1]).ray;
    let collision = cellMap.intersect(ray);
    if (collision === undefined) {
        selectedPlumbingPiece = undefined;
        selectedCell = undefined;
        selectedDir = undefined;
    } else {
        selectedPlumbingPiece = collision.plumbingPiece;
        selectedCell = collision.cell;
        let box = selectedPlumbingPiece.boxAt(selectedCell);
        selectedDir = box.facePointToDirection(collision.collisionPoint);
    }
});

function step(dx, dy, dz) {
    let viewMatrix = camera.rotationMatrix();
    let d = viewMatrix.transformVector(new Vector(dx, dy, dz));
    camera.focus_point = camera.focus_point.plus(d);
}

canvas.addEventListener('mousewheel', ev => {
    let factor = Math.exp(-ev.wheelDelta / 1000.0);
    let scalarJump = camera.distance * (factor - 1);
    let canvasBox = canvas.getBoundingClientRect();
    let curMouse = [ev.clientX - canvasBox.left, ev.clientY - canvasBox.top];
    let focusDir = camera.screenPosToWorldRay(canvas, curMouse[0], curMouse[1]).ray.direction;
    let displacement = focusDir.scaledBy(scalarJump);
    let strafe = displacement.perpOnto(camera.direction()).scaledBy(-1);
    camera.distance += displacement.scalarProjectOnto(camera.direction());
    camera.focus_point = camera.focus_point.plus(strafe);
});

document.addEventListener('keydown', ev => {
    if (ev.keyCode === 'A'.charCodeAt(0) || ev.keyCode === 37) {
        step(-0.1, 0, 0);
        ev.preventDefault();
    }
    if (ev.keyCode === 'D'.charCodeAt(0) || ev.keyCode === 39) {
        step(0.1, 0, 0);
        ev.preventDefault();
    }

    if (ev.keyCode === 'S'.charCodeAt(0) || ev.keyCode === 40) {
        step(0, -0.1, 0);
        ev.preventDefault();
    }
    if (ev.keyCode === 'W'.charCodeAt(0) || ev.keyCode === 38) {
        step(0, 0.1, 0);
        ev.preventDefault();
    }
});
