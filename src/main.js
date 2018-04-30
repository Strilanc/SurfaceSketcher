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
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";
import {Camera} from "src/geo/Camera.js";
import {RenderData} from "src/geo/RenderData.js";
import {UnitCellMap} from "src/braid/UnitCellMap.js";
import {ALL_PLUMBING_PIECES, PLUMBING_PIECE_MAP} from "src/braid/PlumbingPieces.js";
import {simulate_map} from "src/braid/SimulateUnitCellMap.js"


let camera = new Camera(new Point(0, 0, 0), 7, -Math.PI/3, Math.PI/4);
const codeDistance = 5;

let cellMap = new UnitCellMap();
cellMap.cell(new Point(0, 0, 0)).piece_names.add('XPrimal');
cellMap.cell(new Point(0, 0, 1)).piece_names.add('XPrimal');
cellMap.cell(new Point(0, 0, 1)).piece_names.add('YPrimal');
cellMap.cell(new Point(0, 1, 0)).piece_names.add('ZPrimal');
cellMap.cell(new Point(0, 1, 0)).piece_names.add('ZDual');

let drawBraids = true;
let drawOps = false;

/**
 * @returns {!Array.<!RenderData>}
 */
function makeRenderData() {
    let result = [];

    if (drawBraids) {
        result.push(...cellMap.renderData());

    }

    if (!drawOps && drawBraids) {
        if (selectedPiece !== undefined) {
            result.push(selectedPiece.toRenderData([1, 0, 0, 1]));
        }
    }

    // let d = new Vector(1, 1, 1).scaledBy(0.1);
    // result.push(new Box(camera.focus_point, d));


    if (drawOps) {
        for (let i = 0; i < simulated_layers.length; i++) {
            for (let j = 0; j < simulated_layers[i].grid.length; j++) {
                result.push(...simulated_layers[i].toIntraLayerRenderDatas(j, i, codeDistance));
            }
            result.push(...simulated_layers[i].toInterLayerRenderDatas(i, codeDistance));
        }
    }

    return result;
}

let last_simulation_map = new UnitCellMap();

const canvas = /** @type {!HTMLCanvasElement} */ document.getElementById('main-canvas');
function main() {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    document.body.style.overflow = "hidden";

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

let simulated_layers = /** @type {!Array.<!LockstepSurfaceLayer>} */ [];
/**
 * @param {!WebGLRenderingContext} gl
 * @param {*} programInfo
 * @param {*} buffers
 */
function drawScene(gl, programInfo, buffers) {
    if (!last_simulation_map.isEqualTo(cellMap)) {
        last_simulation_map = cellMap.clone();
        simulated_layers = simulate_map(codeDistance, last_simulation_map);
        for (let e of simulated_layers) {
            console.log(e.toString());
        }
    }

    let w = window.innerWidth;
    let h = window.innerHeight;
    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
    }

    gl.clearColor(1, 1, 1, 1);
    gl.clearDepth(1);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    // gl.enable(gl.BLEND);
    // gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

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
    for (let chunk of RenderData.splitIntoCallsThatFit(allRenderData)) {
        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, RenderData.allCoordinateData(chunk), gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
        gl.bufferData(gl.ARRAY_BUFFER, RenderData.allColorData(chunk), gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

        let indexData = RenderData.allIndexData(chunk);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

        gl.drawElements(mode, indexData.length, gl.UNSIGNED_SHORT, 0);
    }
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
    if (selectedPiece === undefined || selectedDir === undefined) {
        return;
    }

    if (!selectedPiece.plumbingPiece.onlyImplied) {
        let s = cellMap.cell(selectedPiece.cell).piece_names;
        if (s.has(selectedPiece.plumbingPiece.name)) {
            s.delete(selectedPiece.plumbingPiece.name);
        } else {
            s.add(selectedPiece.plumbingPiece.name);
        }
        selectedPiece = undefined;
        selectedDir = undefined;
        return;
    }

    for (let pp of ALL_PLUMBING_PIECES) {
        for (let imp of pp.implies) {
            if (imp.name === selectedPiece.plumbingPiece.name) {
                let d = pp.box.center().minus(selectedPiece.plumbingPiece.box.center()).minus(imp.offset).unit();
                if (d.isApproximatelyEqualTo(selectedDir, 0.001)) {
                    cellMap.cell(selectedPiece.cell.plus(imp.offset.scaledBy(-1))).piece_names.add(pp.name);
                    selectedPiece = undefined;
                    selectedDir = undefined;
                    return;
                }
            }
        }
    }
});

let prevMouse = [0, 0];
/** @type {undefined|!LocalizedPlumbingPiece} */
let selectedPiece = undefined;
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
        selectedPiece = undefined;
        selectedDir = undefined;
    } else {
        selectedPiece = collision.piece;
        let box = selectedPiece.toBox(true);
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
    if (ev.keyCode === '1'.charCodeAt(0)) {
        drawBraids = true;
        drawOps = false;
    }

    if (ev.keyCode === '2'.charCodeAt(0)) {
        drawBraids = false;
        drawOps = true;
    }

    if (ev.keyCode === '3'.charCodeAt(0)) {
        drawBraids = true;
        drawOps = true;
    }

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
