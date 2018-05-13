/**
 * Entry point for the whole program.
 */

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
import {PlumbingPieces} from "src/braid/PlumbingPieces.js";
import {Sockets} from "src/braid/Sockets.js";
import {simulateMap, runSimulation} from "src/braid/SimulateUnitCellMap.js"
import {equate} from "src/base/Equate.js";
import {LocalizedPlumbingPiece} from "src/braid/LocalizedPlumbingPiece.js";
import {Revision} from "src/base/Revision.js";
import {Reader, Writer} from "src/base/Serialize.js";
import {DrawState} from "src/DrawState.js";
import {initShaders} from "src/draw/shader.js";
import {GeneralMap} from "src/base/GeneralMap.js";
import {SimulationResults} from "src/braid/SimulateUnitCellMap.js";
import {tileStackToRenderData} from "src/draw/TileDrawing.js";

let drawState = DrawState.defaultValue();
let lastDrawnState = undefined;
let lastSimState = undefined;
let simResults = undefined;
let prevMouse = [0, 0];
let loadCamera = true;

let revision = new Revision([document.location.hash.substr(1)], 0, false);
revision.latestActiveCommit().subscribe(hex => {
    let preCamera = drawState.camera;
    drawState = DrawState.read(Reader.fromHex(hex));
    if (loadCamera) {
        loadCamera = false;
    } else {
        drawState.camera = preCamera;
    }
    document.location.hash = hex;
});

/**
 * @returns {!Array.<!RenderData>}
 */
function makeRenderData() {
    let result = [];

    let simResultsDef = simResults;
    if (simResults === undefined) {
        simResultsDef = new SimulationResults(new GeneralMap());
    }
    if (drawState.drawBraids) {
        result.push(...drawState.cellMap.renderData(simResultsDef));
    }

    if (!drawState.drawOps && drawState.drawBraids) {
        if (drawState.selectedPiece !== undefined) {
            let unitCell = drawState.cellMap.cell(drawState.selectedPiece.loc);
            let curPiece = unitCell.pieces.get(drawState.selectedPiece.socket);
            let hasPiece = curPiece === drawState.selectedPiece.piece;
            let color = hasPiece ? [1, 0, 0, 1] : [0, 1, 0, 1];
            result.push(drawState.selectedPiece.toRenderData(color));
        }
    }

    if (drawState.drawOps) {
        let tileIndex = 0;
        for (let i = 0; i < simLayers.length; i++) {
            let tileStack = simLayers[i];
            result.push(...tileStackToRenderData(tileStack, tileIndex, drawState.codeDistance));
            tileIndex += tileStack.tiles.length;
        }
    }

    return result;
}


const canvas = /** @type {!HTMLCanvasElement} */ document.getElementById('main-canvas');
function main() {
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    document.body.style.overflow = "hidden";  // Don't show scroll bars just because the canvas fills the screen.

    let {programInfo, buffers, arrowTexture} = initShaders(gl);

    function render() {
        drawScene(gl, programInfo, buffers, arrowTexture);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

let simLayers = /** @type {!Array.<!TileStack>} */ [];
/**
 * @param {!WebGLRenderingContext} gl
 * @param {*} programInfo
 * @param {*} buffers
 * @param {!WebGLTexture} arrowTexture
 */
function drawScene(gl, programInfo, buffers, arrowTexture) {
    if (drawState.isEqualTo(lastDrawnState)) {
        return;
    }
    lastDrawnState = drawState.clone();
    if (!drawState.cellMap.isEqualTo(lastSimState)) {
        lastSimState = drawState.cellMap.clone();
        simLayers = simulateMap(drawState.codeDistance, lastSimState);
        simResults = runSimulation(simLayers);

        let writer = new Writer();
        drawState.write(writer);
        revision.commit(writer.toHex());
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
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, arrowTexture);
    gl.uniform1i(programInfo.uniformLocations.texture, 0);

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

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoords);
        gl.bufferData(gl.ARRAY_BUFFER, RenderData.allUvData(chunk), gl.STATIC_DRAW);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        let indexData = RenderData.allIndexData(chunk);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.STATIC_DRAW);

        gl.drawElements(mode, indexData.length, gl.UNSIGNED_SHORT, 0);
    }
}

main();

canvas.addEventListener('click', ev => {
    if (drawState.selectedPiece === undefined) {
        return;
    }

    let {loc, piece, socket} = drawState.selectedPiece;
    let unitCell = drawState.cellMap.cell(loc);
    let curPiece = unitCell.pieces.get(socket);
    if (piece === curPiece) {
        if (ev.shiftKey) {
            let possiblePieces = PlumbingPieces.BySocket.get(socket);
            let k = possiblePieces.indexOf(piece);
            k += 1;
            k %= possiblePieces.length;
            unitCell.pieces.set(socket, possiblePieces[k]);
        } else {
            unitCell.pieces.delete(socket);
        }
        for (let n of socket.impliedNeighbors) {
            drawState.removeIfLonely(n.inNextCell ? loc.plus(n.dir) : loc, n.socket);
        }
    } else {
        unitCell.pieces.set(socket, piece);
        drawState.addImpliedNeighbors(loc, socket);
    }
});

canvas.addEventListener('mousemove', ev => {
    let b = canvas.getBoundingClientRect();
    let curMouse = [ev.clientX - b.left, ev.clientY - b.top];

    if (ev.which === 2) {
        // Middle button drag.
        let dx = curMouse[0] - prevMouse[0];
        let dy = curMouse[1] - prevMouse[1];
        if (ev.shiftKey) {
            moveCameraRelativeToFacing(dx * -0.01, dy * 0.01, 0);
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
        drawState.selectedPiece = undefined;
        drawState.selectedDir = undefined;
    } else {
        drawState.selectedPiece = collision.piece;
        let box = drawState.selectedPiece.toBox();
        drawState.selectedDir = box.facePointToDirection(collision.collisionPoint);
    }
});

function moveCameraRelativeToFacing(dx, dy, dz) {
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

let keyListeners = /** @type {!Map.<!int, !Array.<!function(!KeyboardEvent)>>} */ new Map();

/**
 * @param {!string|!int} keyOrCode
 * @param {!function(!KeyboardEvent)} func
 */
function addKeyListener(keyOrCode, func) {
    if (!Number.isInteger(keyOrCode)) {
        keyOrCode = keyOrCode.charCodeAt(0);
    }

    if (!keyListeners.has(keyOrCode)) {
        keyListeners.set(keyOrCode, []);
    }
    keyListeners.get(keyOrCode).push(func);
}

addKeyListener('1', () => {
    drawState.drawBraids = true;
    drawState.drawOps = false;
});

addKeyListener('2', () => {
    drawState.drawBraids = false;
    drawState.drawOps = true;
});

addKeyListener('3', () => {
    drawState.drawBraids = true;
    drawState.drawOps = true;
});

addKeyListener(187, () => {
    drawState.codeDistance += 1;
    lastSimState = new UnitCellMap();
});

addKeyListener(189, () => {
    drawState.codeDistance = Math.max(drawState.codeDistance - 1, 1);
    lastSimState = new UnitCellMap();
});

addKeyListener('Z', ev => {
    if (ev.ctrlKey && !ev.shiftKey) {
        revision.undo();
    } else if (ev.ctrlKey && ev.shiftKey) {
        revision.redo();
    }
});

addKeyListener('Y', ev => {
    if (ev.ctrlKey && !ev.shiftKey) {
        revision.redo();
    }
});

document.addEventListener('keydown', ev => {
    let handlers = keyListeners.get(ev.keyCode);
    if (handlers !== undefined) {
        ev.preventDefault();
        for (let handler of handlers) {
            handler(ev);
        }
    }
});
