import {DetailedError} from "src/base/DetailedError.js"

/**
 * @param {!WebGLRenderingContext} gl The webgl rendering context.
 * @param {!int} width Desired texture width. Should be a power of 2.
 * @param {!int} height Desired texture height. Should be a power of 2.
 * @param {!function(!CanvasRenderingContext2D)} drawer A user-provided function that will draw on a canvas we create.
 * @returns {!WebGLTexture}
 */
function createTextureByDrawingToCanvas(gl, width, height, drawer) {
    if ((width & (width - 1)) !== 0 || (height & (height - 1)) !== 0) {
        throw new DetailedError("Expected power of 2 texture sizes.", {width, height});
    }

    // Create a canvas and call the given drawer to draw stuff to it.
    let canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    let ctx = canvas.getContext('2d');
    drawer(ctx);
    let data = ctx.getImageData(0, 0, width, height);

    // Transfer canvas contents onto a texture.
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.generateMipmap(gl.TEXTURE_2D);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return texture;
}

export {createTextureByDrawingToCanvas}
