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
import {Mat4} from "src/base/Mat4.js";
import {Box, BOX_TRIANGLE_INDICES} from "src/geo/Box.js";
import {Vector} from "src/geo/Vector.js";
import {Point} from "src/geo/Point.js";


let camera_x = 2.2;
let camera_y = 0.3;
let camera_z = 0.8;
let camera_yaw = -Math.PI/2;
let camera_pitch = 0;

class UnitCell {
    constructor() {
        this.x_piece = false;
        this.y_piece = false;
        this.z_piece = false;
    }
}

let cells = /** @type {!Map.<!string, !UnitCell>} */ new Map();
cells.set("0,0,0", new UnitCell());
cells.get("0,0,0").x_piece = true;

cells.set("0,0,1", new UnitCell());
cells.get("0,0,1").x_piece = true;
cells.get("0,0,1").y_piece = true;

cells.set("0,1,0", new UnitCell());
cells.get("0,1,0").z_piece = true;

function boxesFromUnitCells() {
    let result = [];
    let centers = new Set();
    for (let key of cells.keys()) {
        let [x, y, z] = key.split(",");
        x = parseInt(x);
        y = parseInt(y);
        z = parseInt(z);

        let val = cells.get(key);
        if (val.x_piece) {
            result.push(new Box(new Point(x + 0.1, y, z), new Vector(0.9, 0.1, 0.1)));
            centers.add(key);
            centers.add(`${x+1},${y},${z}`);
        }
        if (val.y_piece) {
            result.push(new Box(new Point(x, y + 0.1, z), new Vector(0.1, 0.9, 0.1)));
            centers.add(key);
            centers.add(`${x},${y+1},${z}`);
        }
        if (val.z_piece) {
            result.push(new Box(new Point(x, y, z + 0.1), new Vector(0.1, 0.1, 0.9)));
            centers.add(key);
            centers.add(`${x},${y},${z+1}`);
        }
    }
    for (let key of centers) {
        let [x, y, z] = key.split(",");
        x = parseInt(x);
        y = parseInt(y);
        z = parseInt(z);
        result.push(new Box(new Point(x, y, z), new Vector(0.1, 0.1, 0.1)));
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
        attribute vec3 aBaryCoord;
        attribute vec3 aSize;

        uniform mat4 uMatrix;

        varying lowp vec4 vColor;
        varying lowp vec3 vBaryCoord;
        varying lowp vec3 vSize;

        void main(void) {
            gl_Position = uMatrix * aVertexPosition;
            vColor = aVertexColor;
            vBaryCoord = aBaryCoord;
            vSize = aSize;
        }
    `;

    const fsSource = `
        precision highp float;

        varying lowp vec4 vColor;
        varying lowp vec3 vBaryCoord;
        varying lowp vec3 vSize;

        void main(void) {
            vec3 b = min(vBaryCoord, 1.0 - vBaryCoord) * vSize;
            if (b.x > b.y) {
                b = vec3(b.y, b.x, b.z);
            }
            if (b.y > b.z) {
                b = vec3(b.x, b.z, b.y);
            }
            if (b.x > b.y) {
                b = vec3(b.y, b.x, b.z);
            }
            
            float y = 2.0 - b.y * 750.0;
            float edge = max(0.0, y);
            vec4 e = vec4(vec3(1.0, 1.0, 1.0) - edge, 1.0);
            gl_FragColor = vColor * e;
        }
    `;

    // Initialize a shader program; this is where all the lighting
    // for the vertices and so forth is established.
    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

    // Collect all the info needed to use the shader program.
    // Look up which attributes our shader program is using
    // for aVertexPosition, aVevrtexColor and also
    // look up uniform locations.
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
            baryCoord: gl.getAttribLocation(shaderProgram, 'aBaryCoord'),
            size: gl.getAttribLocation(shaderProgram, 'aSize'),
        },
        uniformLocations: {
            matrix: gl.getUniformLocation(shaderProgram, 'uMatrix'),
        },
    };

    // Here's where we call the routine that builds all the
    // objects we'll be drawing.
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
    const barycentricIndexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const sizeBuffer = gl.createBuffer();
    return {
        position: positionBuffer,
        color: colorBuffer,
        indices: indexBuffer,
        baryCoords: barycentricIndexBuffer,
        size: sizeBuffer,
    };
}

function drawScene(gl, programInfo, buffers) {
    gl.clearColor(1.0, 1.0, 1.0, 1.0);
    gl.clearDepth(1.0);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(programInfo.program);
    let viewMatrix = Mat4.perspective(Math.PI/4, gl.canvas.clientWidth/gl.canvas.clientHeight, 0.1, 100).
        inline_rotate(camera_pitch, [1, 0, 0]).
        inline_rotate(camera_yaw, [0, 1, 0]).
        inline_translate(-camera_x, -camera_y, -camera_z);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.matrix,
        false,
        viewMatrix.raw);

    let boxes = boxesFromUnitCells();

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    let positions = [];
    for (let box of boxes) {
        positions.push(...box.cornerCoords());
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.baryCoords);
    let baryData = new Float32Array(boxes.length*8*3);
    for (let i = 0; i < boxes.length*8; i++) {
        for (let j = 0; j < 3; j++) {
            baryData[i*3 + j] = (i >> j) & 1;
        }
    }
    gl.bufferData(gl.ARRAY_BUFFER, baryData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.baryCoord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.baryCoord);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.size);
    let sizeData = new Float32Array(boxes.length*8*3);
    for (let i = 0; i < boxes.length*8; i++) {
        sizeData[i*3] = boxes[i >> 3].diagonal.z;
        sizeData[i*3 + 1] = boxes[i >> 3].diagonal.y;
        sizeData[i*3 + 2] = boxes[i >> 3].diagonal.x;
    }
    gl.bufferData(gl.ARRAY_BUFFER, sizeData, gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.size, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.size);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    const faceColors = [0.8,  0.8,  0.8,  1.0];
    let colorData = [];
    for (let i = 0; i < boxes.length * 8; i++) {
        colorData.push(...faceColors);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colorData), gl.STATIC_DRAW);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    let indexData = [];
    for (let i = 0; i < boxes.length; i++) {
        for (let e of BOX_TRIANGLE_INDICES) {
            indexData.push(8*i + e);
        }
    }
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indexData), gl.STATIC_DRAW);

    gl.drawElements(gl.TRIANGLES, indexData.length, gl.UNSIGNED_SHORT, 0);
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

let prevMouse = [0, 0];
canvas.addEventListener('mousemove', ev => {
    let b = canvas.getBoundingClientRect();
    let curMouse = [ev.clientX - b.left, ev.clientY - b.top];
    if (ev.which === 1) {
        camera_yaw -= (curMouse[0] - prevMouse[0]) * 0.002;
        camera_pitch -= (curMouse[1] - prevMouse[1]) * 0.002;
        camera_pitch = Math.max(Math.min(camera_pitch, Math.PI/2), -Math.PI/2);
    }
    prevMouse = curMouse;
});

function step(dx, dy, dz) {
    let viewMatrix = Mat4.rotation(-camera_yaw, [0, 1, 0]).times(Mat4.rotation(-camera_pitch, [1, 0, 0]));
    let [x, y ,z] = viewMatrix.transformVector(dx, dy, dz);
    camera_x += x;
    camera_y += y;
    camera_z += z;
}
canvas.addEventListener('mousewheel', ev => {
    let d = -ev.wheelDelta / 500.0;
    step((prevMouse[0] / canvas.clientWidth - 0.5) * -2 * d,
         (prevMouse[1] / canvas.clientHeight - 0.5) * d,
         d);
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
