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


let camera_x = 2;
let camera_y = 0;
let camera_z = 10;
let camera_yaw = 0;
let camera_pitch = 0;

const squareTriangleIndices = [0, 1, 2, 1, 2, 3];
const boxTriangleIndices = [];
for (let r = 0; r < 3; r++) {
    for (let m of [0, 7]) {
        for (let e of squareTriangleIndices) {
            e = ((e << r) | (e >> (3 - r))) & 7;
            e ^= m;
            boxTriangleIndices.push(e);
        }
    }
}

function main() {
    const canvas = /** @type {!HTMLCanvasElement} */ document.getElementById('main-canvas');
    const canvasDiv = /** @type {!HTMLDivElement} */ document.getElementById('canvasDiv');
    canvas.width = 1000;
    canvas.height = 500;
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec4 aVertexColor;
        attribute vec3 aBaryCoord;

        uniform mat4 uMatrix;

        varying lowp vec4 vColor;
        varying lowp vec3 vBaryCoord;

        void main(void) {
            gl_Position = uMatrix * aVertexPosition;
            vColor = aVertexColor;
            vBaryCoord = aBaryCoord;
        }
    `;

    const fsSource = `
        precision highp float;

        varying lowp vec4 vColor;
        varying lowp vec3 vBaryCoord;

        void main(void) {
            float dx = float(abs(vBaryCoord.x - 0.5) > 0.49);
            float dy = float(abs(vBaryCoord.y - 0.5) > 0.49);
            float dz = float(abs(vBaryCoord.z - 0.5) > 0.49);
            float edge = float(dx + dy + dz >= 2.0);
            vec4 e = vec4(vec3(1.0, 1.0, 1.0) - edge*0.5, 1.0);
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
        },
        uniformLocations: {
            matrix: gl.getUniformLocation(shaderProgram, 'uMatrix'),
        },
    };

    // Here's where we call the routine that builds all the
    // objects we'll be drawing.
    const buffers = initBuffers(gl);

    function render(now) {
        drawScene(gl, programInfo, buffers);
        requestAnimationFrame(render);
    }
    requestAnimationFrame(render);
}

function boxVertices(x0, y0, z0, dx, dy, dz) {
    let corners = [];
    for (let x of [x0, x0 + dx]) {
        for (let y of [y0, y0 + dy]) {
            for (let z of [z0, z0 + dz]) {
                corners.push(x, y, z);
            }
        }
    }
    return corners;
}

function initBuffers(gl) {

    const positions = boxVertices(-1, -1, -1, 2, 2, 2);
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const faceColors = [
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
        ...[0.8,  0.8,  0.8,  1.0],
    ];
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(faceColors), gl.STATIC_DRAW);

    let baryData = new Float32Array(8*3);
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 3; j++) {
            baryData[i*3 + j] = (i >> j) & 1;
        }
    }
    const barycentricIndexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, barycentricIndexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, baryData, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(boxTriangleIndices), gl.STATIC_DRAW);

    return {
        position: positionBuffer,
        color: colorBuffer,
        indices: indexBuffer,
        baryCoords: barycentricIndexBuffer,
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
        inline_rotate(camera_pitch, [0, 1, 0]).
        inline_rotate(camera_yaw, [1, 0, 0]).
        inline_translate(-camera_x, -camera_y, -camera_z);
    gl.uniformMatrix4fv(
        programInfo.uniformLocations.matrix,
        false,
        viewMatrix.raw);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.baryCoords);
    gl.vertexAttribPointer(programInfo.attribLocations.baryCoord, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.baryCoord);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
    gl.drawElements(gl.TRIANGLES, boxTriangleIndices.length, gl.UNSIGNED_SHORT, 0);
}

function initShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

    // Create the shader program

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    // If creating the shader program failed, alert

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
        return null;
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

document.onkeydown = ev => {
    if (ev.keyCode === 'A'.charCodeAt(0)) {
        camera_x -= 0.1;
    }
    if (ev.keyCode === 'D'.charCodeAt(0)) {
        camera_x += 0.1;
    }
    if (ev.keyCode === 'S'.charCodeAt(0)) {
        camera_y -= 0.1;
    }
    if (ev.keyCode === 'W'.charCodeAt(0)) {
        camera_y += 0.1;
    }
    if (ev.keyCode === 'Q'.charCodeAt(0)) {
        camera_z -= 0.1;
    }
    if (ev.keyCode === 'E'.charCodeAt(0)) {
        camera_z += 0.1;
    }
    if (ev.keyCode === 'R'.charCodeAt(0)) {
        camera_yaw -= 0.1;
    }
    if (ev.keyCode === 'T'.charCodeAt(0)) {
        camera_yaw += 0.1;
    }
    if (ev.keyCode === 'F'.charCodeAt(0)) {
        camera_pitch -= 0.1;
    }
    if (ev.keyCode === 'G'.charCodeAt(0)) {
        camera_pitch += 0.1;
    }
};
