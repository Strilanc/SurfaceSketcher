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


class DrawState {
    /**
     * @param {!Camera} camera
     * @param {!int} codeDistance
     * @param {!UnitCellMap} cellMap
     * @param {!boolean} drawBraids
     * @param {!boolean} drawOps
     */
    constructor(camera, codeDistance, cellMap, drawBraids, drawOps) {
        /** @type {!Camera} */
        this.camera = camera;
        /** @type {!int} */
        this.codeDistance = codeDistance;
        /** @type {!UnitCellMap} */
        this.cellMap = cellMap;
        /** @type {!boolean} */
        this.drawBraids = drawBraids;
        /** @type {!boolean} */
        this.drawOps = drawOps;
    }

    /**
     * @returns {!DrawState}
     */
    static defaultValue() {
        let result = new DrawState(
            new Camera(new Point(0, 0, 0), 7, -Math.PI/3, Math.PI/4),
            1,
            new UnitCellMap(),
            true,
            false);
        result.cellMap.cell(new Point(0, 0, 0)).piece_names.add('XPrimal');
        result.cellMap.cell(new Point(0, 0, 1)).piece_names.add('XPrimal');
        result.cellMap.cell(new Point(0, 0, 1)).piece_names.add('YPrimal');
        result.cellMap.cell(new Point(0, 1, 0)).piece_names.add('ZPrimal');
        result.cellMap.cell(new Point(0, 1, 0)).piece_names.add('ZDual');
        return result;
    }

    /**
     * @returns {!DrawState}
     */
    clone() {
        return new DrawState(
            this.camera.clone(),
            this.codeDistance,
            this.cellMap.clone(),
            this.drawBraids,
            this.drawOps);
    }

    /**
     * @param {*|!DrawState} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        return other instanceof DrawState &&
            this.camera.isEqualTo(other.camera) &&
            this.codeDistance === other.codeDistance &&
            this.cellMap.isEqualTo(other.cellMap) &&
            this.drawBraids === other.drawBraids &&
            this.drawOps === other.drawOps;
    }
}

let drawState = DrawState.defaultValue();
let lastDrawnState = undefined;

/**
 * @returns {!Array.<!RenderData>}
 */
function makeRenderData() {
    let result = [];

    if (drawState.drawBraids) {
        result.push(...drawState.cellMap.renderData());
    }

    if (!drawState.drawOps && drawState.drawBraids) {
        if (selectedPiece !== undefined) {
            result.push(selectedPiece.toRenderData([1, 0, 0, 1]));
        }
    }

    // let d = new Vector(1, 1, 1).scaledBy(0.1);
    // result.push(new Box(camera.focus_point, d));


    if (drawState.drawOps) {
        for (let i = 0; i < simulated_layers.length; i++) {
            for (let j = 0; j < simulated_layers[i].grid.length; j++) {
                result.push(...simulated_layers[i].toIntraLayerRenderDatas(j, i, drawState.codeDistance));
            }
            result.push(...simulated_layers[i].toInterLayerRenderDatas(i, drawState.codeDistance));
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
    if (drawState.isEqualTo(lastDrawnState)) {
        return;
    }
    lastDrawnState = drawState.clone();
    if (!last_simulation_map.isEqualTo(drawState.cellMap)) {
        last_simulation_map = drawState.cellMap.clone();
        simulated_layers = simulate_map(drawState.codeDistance, last_simulation_map);
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
        drawState.camera.worldToScreenMatrix(canvas).transpose().raw);

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
        let s = drawState.cellMap.cell(selectedPiece.cell).piece_names;
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
                    drawState.cellMap.cell(selectedPiece.cell.plus(imp.offset.scaledBy(-1))).piece_names.add(pp.name);
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
            drawState.camera.yaw += dx * 0.004;
            drawState.camera.pitch += dy * 0.004;
            drawState.camera.pitch = Math.max(Math.min(drawState.camera.pitch, Math.PI/2), -Math.PI/2);
        }
    }
    prevMouse = curMouse;

    let ray = drawState.camera.screenPosToWorldRay(canvas, curMouse[0], curMouse[1]).ray;
    let collision = drawState.cellMap.intersect(ray);
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
    let viewMatrix = drawState.camera.rotationMatrix();
    let d = viewMatrix.transformVector(new Vector(dx, dy, dz));
    drawState.camera.focus_point = drawState.camera.focus_point.plus(d);
}

canvas.addEventListener('mousewheel', ev => {
    let factor = Math.exp(-ev.wheelDelta / 1000.0);
    let scalarJump = drawState.camera.distance * (factor - 1);
    let canvasBox = canvas.getBoundingClientRect();
    let curMouse = [ev.clientX - canvasBox.left, ev.clientY - canvasBox.top];
    let focusDir = drawState.camera.screenPosToWorldRay(canvas, curMouse[0], curMouse[1]).ray.direction;
    let displacement = focusDir.scaledBy(scalarJump);
    let strafe = displacement.perpOnto(drawState.camera.direction()).scaledBy(-1);
    drawState.camera.distance += displacement.scalarProjectOnto(drawState.camera.direction());
    drawState.camera.focus_point = drawState.camera.focus_point.plus(strafe);
});

document.addEventListener('keydown', ev => {
    if (ev.keyCode === '1'.charCodeAt(0)) {
        drawState.drawBraids = true;
        drawState.drawOps = false;
    }

    if (ev.keyCode === '2'.charCodeAt(0)) {
        drawState.drawBraids = false;
        drawState.drawOps = true;
    }

    if (ev.keyCode === '3'.charCodeAt(0)) {
        drawState.drawBraids = true;
        drawState.drawOps = true;
    }

    if (ev.keyCode === 187) {
        drawState.codeDistance += 1;
        last_simulation_map = new UnitCellMap();
        ev.preventDefault();
    }

    if (ev.keyCode === 189) {
        drawState.codeDistance = Math.max(drawState.codeDistance - 1, 1);
        last_simulation_map = new UnitCellMap();
        ev.preventDefault();
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
