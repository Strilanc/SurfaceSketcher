import {DetailedError} from "src/base/DetailedError.js";
import {createTextureByDrawingToCanvas} from "src/draw/util.js";
import {Rect} from "src/geo/Rect.js";

// Work around WebStorm not recognizing some WebGL types.
//noinspection ConstantIfStatementJS
if (false) {
    //noinspection JSUnusedLocalSymbols
    function WebGLBuffer() {}
    //noinspection JSUnusedLocalSymbols
    function WebGLProgram() {}
    //noinspection JSUnusedLocalSymbols
    function WebGLShader() {}
    //noinspection JSUnusedLocalSymbols
    function WebGLTexture() {}
}

/**
 * @param {!WebGLRenderingContext} gl
 */
const VERTEX_SHADER_SOURCE = `
    attribute vec4 aVertexPosition;
    attribute vec4 aVertexColor;
    attribute vec2 aTextureCoord;

    uniform mat4 uMatrix;

    varying lowp vec4 vColor;
    varying highp vec2 vTextureCoord;

    void main(void) {
        gl_Position = uMatrix * aVertexPosition;
        vColor = aVertexColor;
        vTextureCoord = aTextureCoord;
    }`;

const FRAGMENT_SHADER_SOURCE = `
    precision highp float;

    varying lowp vec4 vColor;
    varying highp vec2 vTextureCoord;
    uniform sampler2D uSampler;

    void main(void) {
        vec4 pixel = texture2D(uSampler, vTextureCoord);
        gl_FragColor = (pixel * pixel.a) + vColor * (1.0 - pixel.a);
        gl_FragColor.a = 1.0;
    }`;

/**
 * @param {!WebGLRenderingContext} gl
 * @returns {{
 *     programInfo: {
 *         program: *,
 *         attribLocations: !{
 *             vertexPosition: *,
 *             vertexColor: *
 *         },
 *         uniformLocations: !{
 *             matrix: *
 *         }
 *     },
 *     buffers: !{
 *         position: !WebGLBuffer,
 *         color: !WebGLBuffer,
 *         indices: !WebGLBuffer,
 *         textureCoords: !WebGLBuffer
 *     },
 *     arrowTexture: !WebGLTexture
 * }}
 */
function initShaders(gl) {
    let shaderProgram = createShaderProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);

    let programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
            textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
            matrix: gl.getUniformLocation(shaderProgram, 'uMatrix'),
            texture: gl.getUniformLocation(shaderProgram, 'uSampler'),
        },
    };

    let buffers = createBuffers(gl);

    let arrowTexture = createArrowTexture(gl);

    return {programInfo, buffers, arrowTexture};
}

/**
 * @param {!WebGLRenderingContext} gl
 * @returns {!{position: !WebGLBuffer, color: !WebGLBuffer, indices: !WebGLBuffer, textureCoords: !WebGLBuffer}}
 */
function createBuffers(gl) {
    const positionBuffer = gl.createBuffer();
    const colorBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    const textureCoordBuffer = gl.createBuffer();
    return {
        position: positionBuffer,
        color: colorBuffer,
        indices: indexBuffer,
        textureCoords: textureCoordBuffer,
    };
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!string} vertexShaderSource
 * @param {!string} fragmentShaderSource
 * @returns {!WebGLProgram}
 */
function createShaderProgram(gl, vertexShaderSource, fragmentShaderSource) {
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
        let info = gl.getProgramInfoLog(shaderProgram);
        throw new DetailedError('Unable to initialize the shader program.',
            {info, vertexShaderSource, fragmentShaderSource});
    }

    return shaderProgram;
}

/**
 * @param {!WebGLRenderingContext} gl
 * @param {!int} type
 * @param {!string} source
 * @returns {WebGLShader}
 */
function createShader(gl, type, source) {
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

/**
 * @param {!WebGLRenderingContext} gl
 * @returns {!WebGLTexture}
 */
function createArrowTexture(gl) {
    let r = 128;
    return createTextureByDrawingToCanvas(gl, 8*r, 8*r, ctx => {
        ctx.save();
        drawArrow(ctx, r);
        ctx.translate(r*4, 0);
        ctx.rotate(Math.PI/2);
        drawArrow(ctx, r);
        ctx.restore();

        ctx.save();
        ctx.translate(0, r*2);
        ctx.translate(0, r/2);
        drawArrow(ctx, r/2);
        ctx.translate(r*2, r);
        drawArrow(ctx, -r/2);
        ctx.restore();

        ctx.save();
        ctx.translate(r*2, r*2);
        ctx.beginPath();
        ctx.arc(r, r, r/2, 0, 2*Math.PI);
        ctx.fillStyle = 'green';
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.font = '120px monospace';
        ctx.fillText('S', r, r);
        ctx.restore();

        ctx.translate(r*4, 0);
        ctx.beginPath();
        ctx.arc(r, r, r/2, 0, 2*Math.PI);
        ctx.fillStyle = 'red';
        ctx.fill();
    });
}

/**
 * @param {!CanvasRenderingContext2D} ctx
 * @param {!number} r
 */
function drawArrow(ctx, r) {
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(r, r/2);
    ctx.lineTo(2*r, r/2);
    ctx.lineTo(2*r, 3*r/2);
    ctx.lineTo(r, 3*r/2);
    ctx.lineTo(r, 2*r);
    ctx.lineTo(0, r);
    ctx.lineTo(r, 0);
    ctx.fillStyle = 'blue';
    ctx.fill();
}

/**
 * @param {!int} x
 * @param {!int} y
 * @returns {!Rect}
 */
function textureCell(x, y) {
    return new Rect(x, y, 1, 1).scaledBy(0.25);
}

/** @type {!Rect} */
const H_ARROW_TEXTURE_RECT = textureCell(0, 0);
/** @type {!Rect} */
const V_ARROW_TEXTURE_RECT = textureCell(1, 0);
/** @type {!Rect} */
const S_TEXTURE_RECT = textureCell(1, 1);
/** @type {!Rect} */
const H_INIT_TEXTURE_RECT = textureCell(0, 1);
/** @type {!Rect} */
const DISPLAY_TEXTURE_RECT = textureCell(2, 0);

export {
    initShaders,
    H_ARROW_TEXTURE_RECT,
    V_ARROW_TEXTURE_RECT,
    S_TEXTURE_RECT,
    H_INIT_TEXTURE_RECT,
    DISPLAY_TEXTURE_RECT,
}
