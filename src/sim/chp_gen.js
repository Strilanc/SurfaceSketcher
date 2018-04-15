// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
    if (Module.hasOwnProperty(key)) {
        moduleOverrides[key] = Module[key];
    }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
    throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
    if (Module['ENVIRONMENT'] === 'WEB') {
        ENVIRONMENT_IS_WEB = true;
    } else if (Module['ENVIRONMENT'] === 'WORKER') {
        ENVIRONMENT_IS_WORKER = true;
    } else if (Module['ENVIRONMENT'] === 'NODE') {
        ENVIRONMENT_IS_NODE = true;
    } else if (Module['ENVIRONMENT'] === 'SHELL') {
        ENVIRONMENT_IS_SHELL = true;
    } else {
        throw new Error('Module[\'ENVIRONMENT\'] value is not valid. must be one of: WEB|WORKER|NODE|SHELL.');
    }
} else {
    ENVIRONMENT_IS_WEB = typeof window === 'object';
    ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
    ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
    ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
    // Expose functionality in the same simple way that the shells work
    // Note that we pollute the global namespace here, otherwise we break in node
    var nodeFS;
    var nodePath;

    Module['read'] = function shell_read(filename, binary) {
        var ret;
        ret = tryParseAsDataURI(filename);
        if (!ret) {
            if (!nodeFS) nodeFS = require('fs');
            if (!nodePath) nodePath = require('path');
            filename = nodePath['normalize'](filename);
            ret = nodeFS['readFileSync'](filename);
        }
        return binary ? ret : ret.toString();
    };

    Module['readBinary'] = function readBinary(filename) {
        var ret = Module['read'](filename, true);
        if (!ret.buffer) {
            ret = new Uint8Array(ret);
        }
        assert(ret.buffer);
        return ret;
    };

    if (process['argv'].length > 1) {
        Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    }

    Module['arguments'] = process['argv'].slice(2);

    if (typeof module !== 'undefined') {
        module['exports'] = Module;
    }

    process['on']('uncaughtException', function(ex) {
        // suppress ExitStatus exceptions from showing an error
        if (!(ex instanceof ExitStatus)) {
            throw ex;
        }
    });
    // Currently node will swallow unhandled rejections, but this behavior is
    // deprecated, and in the future it will exit with error status.
    process['on']('unhandledRejection', function(reason, p) {
        process['exit'](1);
    });

    Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
    if (typeof read != 'undefined') {
        Module['read'] = function shell_read(f) {
            var data = tryParseAsDataURI(f);
            if (data) {
                return intArrayToString(data);
            }
            return read(f);
        };
    }

    Module['readBinary'] = function readBinary(f) {
        var data;
        data = tryParseAsDataURI(f);
        if (data) {
            return data;
        }
        if (typeof readbuffer === 'function') {
            return new Uint8Array(readbuffer(f));
        }
        data = read(f, 'binary');
        assert(typeof data === 'object');
        return data;
    };

    if (typeof scriptArgs != 'undefined') {
        Module['arguments'] = scriptArgs;
    } else if (typeof arguments != 'undefined') {
        Module['arguments'] = arguments;
    }

    if (typeof quit === 'function') {
        Module['quit'] = function(status, toThrow) {
            quit(status);
        }
    }
}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module['read'] = function shell_read(url) {
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, false);
            xhr.send(null);
            return xhr.responseText;
        } catch (err) {
            var data = tryParseAsDataURI(url);
            if (data) {
                return intArrayToString(data);
            }
            throw err;
        }
    };

    if (ENVIRONMENT_IS_WORKER) {
        Module['readBinary'] = function readBinary(url) {
            try {
                var xhr = new XMLHttpRequest();
                xhr.open('GET', url, false);
                xhr.responseType = 'arraybuffer';
                xhr.send(null);
                return new Uint8Array(xhr.response);
            } catch (err) {
                var data = tryParseAsDataURI(url);
                if (data) {
                    return data;
                }
                throw err;
            }
        };
    }

    Module['readAsync'] = function readAsync(url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function xhr_onload() {
            if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
                onload(xhr.response);
                return;
            }
            var data = tryParseAsDataURI(url);
            if (data) {
                onload(data.buffer);
                return;
            }
            onerror();
        };
        xhr.onerror = onerror;
        xhr.send(null);
    };

    if (typeof arguments != 'undefined') {
        Module['arguments'] = arguments;
    }

    Module['setWindowTitle'] = function(title) { document.title = title };
}

// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
Module['print'] = typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null);
Module['printErr'] = typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || Module['print']);

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Merge back in the overrides
for (key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
        Module[key] = moduleOverrides[key];
    }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;


function staticAlloc(size) {
    assert(!staticSealed);
    var ret = STATICTOP;
    STATICTOP = (STATICTOP + size + 15) & -16;
    return ret;
}

function dynamicAlloc(size) {
    assert(DYNAMICTOP_PTR);
    var ret = HEAP32[DYNAMICTOP_PTR>>2];
    var end = (ret + size + 15) & -16;
    HEAP32[DYNAMICTOP_PTR>>2] = end;
    if (end >= TOTAL_MEMORY) {
        var success = enlargeMemory();
        if (!success) {
            HEAP32[DYNAMICTOP_PTR>>2] = ret;
            return 0;
        }
    }
    return ret;
}

function alignMemory(size, factor) {
    if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
    var ret = size = Math.ceil(size / factor) * factor;
    return ret;
}

function getNativeTypeSize(type) {
    switch (type) {
        case 'i1': case 'i8': return 1;
        case 'i16': return 2;
        case 'i32': return 4;
        case 'i64': return 8;
        case 'float': return 4;
        case 'double': return 8;
        default: {
            if (type[type.length-1] === '*') {
                return 4; // A pointer
            } else if (type[0] === 'i') {
                var bits = parseInt(type.substr(1));
                assert(bits % 8 === 0);
                return bits / 8;
            } else {
                return 0;
            }
        }
    }
}

function warnOnce(text) {
    if (!warnOnce.shown) warnOnce.shown = {};
    if (!warnOnce.shown[text]) {
        warnOnce.shown[text] = 1;
        Module.printErr(text);
    }
}



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
    var base = 0;
    for (var i = base; i < base + 0; i++) {
        if (!functionPointers[i]) {
            functionPointers[i] = func;
            return jsCallStartIndex + i;
        }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
    functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
    if (!func) return; // on null pointer, return undefined
    assert(sig);
    if (!funcWrappers[sig]) {
        funcWrappers[sig] = {};
    }
    var sigCache = funcWrappers[sig];
    if (!sigCache[func]) {
        // optimize away arguments usage in common cases
        if (sig.length === 1) {
            sigCache[func] = function dynCall_wrapper() {
                return dynCall(sig, func);
            };
        } else if (sig.length === 2) {
            sigCache[func] = function dynCall_wrapper(arg) {
                return dynCall(sig, func, [arg]);
            };
        } else {
            // general case
            sigCache[func] = function dynCall_wrapper() {
                return dynCall(sig, func, Array.prototype.slice.call(arguments));
            };
        }
    }
    return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
    return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
    if (args && args.length) {
        return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
        return Module['dynCall_' + sig].call(null, ptr);
    }
}



var Runtime = {
    // FIXME backwards compatibility layer for ports. Support some Runtime.*
    //       for now, fix it there, then remove it from here. That way we
    //       can minimize any period of breakage.
    dynCall: dynCall, // for SDL2 port
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;



// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
    if (!condition) {
        abort('Assertion failed: ' + text);
    }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
    var func = Module['_' + ident]; // closure exported function
    assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
    return func;
}

var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
        stackSave()
    },
    'stackRestore': function() {
        stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
        var ret = stackAlloc(arr.length);
        writeArrayToMemory(arr, ret);
        return ret;
    },
    'stringToC' : function(str) {
        var ret = 0;
        if (str !== null && str !== undefined && str !== 0) { // null string
            // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
            var len = (str.length << 2) + 1;
            ret = stackAlloc(len);
            stringToUTF8(str, ret, len);
        }
        return ret;
    }
};
// For fast lookup of conversion functions
var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

// C calling interface.
function ccall (ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    if (args) {
        for (var i = 0; i < args.length; i++) {
            var converter = toC[argTypes[i]];
            if (converter) {
                if (stack === 0) stack = stackSave();
                cArgs[i] = converter(args[i]);
            } else {
                cArgs[i] = args[i];
            }
        }
    }
    var ret = func.apply(null, cArgs);
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
        stackRestore(stack);
    }
    return ret;
}

function cwrap (ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = returnType !== 'string';
    if (numericRet && numericArgs) {
        return cfunc;
    }
    return function() {
        return ccall(ident, returnType, argTypes, arguments);
    }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
    type = type || 'i8';
    if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
        case 'i1': HEAP8[((ptr)>>0)]=value; break;
        case 'i8': HEAP8[((ptr)>>0)]=value; break;
        case 'i16': HEAP16[((ptr)>>1)]=value; break;
        case 'i32': HEAP32[((ptr)>>2)]=value; break;
        case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
        case 'float': HEAPF32[((ptr)>>2)]=value; break;
        case 'double': HEAPF64[((ptr)>>3)]=value; break;
        default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
    type = type || 'i8';
    if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
        case 'i1': return HEAP8[((ptr)>>0)];
        case 'i8': return HEAP8[((ptr)>>0)];
        case 'i16': return HEAP16[((ptr)>>1)];
        case 'i32': return HEAP32[((ptr)>>2)];
        case 'i64': return HEAP32[((ptr)>>2)];
        case 'float': return HEAPF32[((ptr)>>2)];
        case 'double': return HEAPF64[((ptr)>>3)];
        default: abort('invalid type for getValue: ' + type);
    }
    return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === 'number') {
        zeroinit = true;
        size = slab;
    } else {
        zeroinit = false;
        size = slab.length;
    }

    var singleType = typeof types === 'string' ? types : null;

    var ret;
    if (allocator == ALLOC_NONE) {
        ret = ptr;
    } else {
        ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
    }

    if (zeroinit) {
        var stop;
        ptr = ret;
        assert((ret & 3) == 0);
        stop = ret + (size & ~3);
        for (; ptr < stop; ptr += 4) {
            HEAP32[((ptr)>>2)]=0;
        }
        stop = ret + size;
        while (ptr < stop) {
            HEAP8[((ptr++)>>0)]=0;
        }
        return ret;
    }

    if (singleType === 'i8') {
        if (slab.subarray || slab.slice) {
            HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
        } else {
            HEAPU8.set(new Uint8Array(slab), ret);
        }
        return ret;
    }

    var i = 0, type, typeSize, previousType;
    while (i < size) {
        var curr = slab[i];

        type = singleType || types[i];
        if (type === 0) {
            i++;
            continue;
        }

        if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

        setValue(ret+i, curr, type);

        // no need to look up size unless type changes, so cache it
        if (previousType !== type) {
            typeSize = getNativeTypeSize(type);
            previousType = type;
        }
        i += typeSize;
    }

    return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
    if (!staticSealed) return staticAlloc(size);
    if (!runtimeInitialized) return dynamicAlloc(size);
    return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
    if (length === 0 || !ptr) return '';
    // TODO: use TextDecoder
    // Find the length, and check for UTF while doing so
    var hasUtf = 0;
    var t;
    var i = 0;
    while (1) {
        t = HEAPU8[(((ptr)+(i))>>0)];
        hasUtf |= t;
        if (t == 0 && !length) break;
        i++;
        if (length && i == length) break;
    }
    if (!length) length = i;

    var ret = '';

    if (hasUtf < 128) {
        var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
        var curr;
        while (length > 0) {
            curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
            ret = ret ? ret + curr : curr;
            ptr += MAX_CHUNK;
            length -= MAX_CHUNK;
        }
        return ret;
    }
    return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
    var str = '';
    while (1) {
        var ch = HEAP8[((ptr++)>>0)];
        if (!ch) return str;
        str += String.fromCharCode(ch);
    }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
    return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
    var endPtr = idx;
    // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
    // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
    while (u8Array[endPtr]) ++endPtr;

    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
    } else {
        var u0, u1, u2, u3, u4, u5;

        var str = '';
        while (1) {
            // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
            u0 = u8Array[idx++];
            if (!u0) return str;
            if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
            u1 = u8Array[idx++] & 63;
            if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
            u2 = u8Array[idx++] & 63;
            if ((u0 & 0xF0) == 0xE0) {
                u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
            } else {
                u3 = u8Array[idx++] & 63;
                if ((u0 & 0xF8) == 0xF0) {
                    u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
                } else {
                    u4 = u8Array[idx++] & 63;
                    if ((u0 & 0xFC) == 0xF8) {
                        u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
                    } else {
                        u5 = u8Array[idx++] & 63;
                        u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
                    }
                }
            }
            if (u0 < 0x10000) {
                str += String.fromCharCode(u0);
            } else {
                var ch = u0 - 0x10000;
                str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
            }
        }
    }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
    return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
        return 0;

    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
    for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
        var u = str.charCodeAt(i); // possibly a lead surrogate
        if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
        if (u <= 0x7F) {
            if (outIdx >= endIdx) break;
            outU8Array[outIdx++] = u;
        } else if (u <= 0x7FF) {
            if (outIdx + 1 >= endIdx) break;
            outU8Array[outIdx++] = 0xC0 | (u >> 6);
            outU8Array[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0xFFFF) {
            if (outIdx + 2 >= endIdx) break;
            outU8Array[outIdx++] = 0xE0 | (u >> 12);
            outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
            outU8Array[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0x1FFFFF) {
            if (outIdx + 3 >= endIdx) break;
            outU8Array[outIdx++] = 0xF0 | (u >> 18);
            outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
            outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
            outU8Array[outIdx++] = 0x80 | (u & 63);
        } else if (u <= 0x3FFFFFF) {
            if (outIdx + 4 >= endIdx) break;
            outU8Array[outIdx++] = 0xF8 | (u >> 24);
            outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
            outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
            outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
            outU8Array[outIdx++] = 0x80 | (u & 63);
        } else {
            if (outIdx + 5 >= endIdx) break;
            outU8Array[outIdx++] = 0xFC | (u >> 30);
            outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
            outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
            outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
            outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
            outU8Array[outIdx++] = 0x80 | (u & 63);
        }
    }
    // Null-terminate the pointer to the buffer.
    outU8Array[outIdx] = 0;
    return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var u = str.charCodeAt(i); // possibly a lead surrogate
        if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
        if (u <= 0x7F) {
            ++len;
        } else if (u <= 0x7FF) {
            len += 2;
        } else if (u <= 0xFFFF) {
            len += 3;
        } else if (u <= 0x1FFFFF) {
            len += 4;
        } else if (u <= 0x3FFFFFF) {
            len += 5;
        } else {
            len += 6;
        }
    }
    return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
    var endPtr = ptr;
    // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
    // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
    var idx = endPtr >> 1;
    while (HEAP16[idx]) ++idx;
    endPtr = idx << 1;

    if (endPtr - ptr > 32 && UTF16Decoder) {
        return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
    } else {
        var i = 0;

        var str = '';
        while (1) {
            var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
            if (codeUnit == 0) return str;
            ++i;
            // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
            str += String.fromCharCode(codeUnit);
        }
    }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
    // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
    if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 0x7FFFFFFF;
    }
    if (maxBytesToWrite < 2) return 0;
    maxBytesToWrite -= 2; // Null terminator.
    var startPtr = outPtr;
    var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
    for (var i = 0; i < numCharsToWrite; ++i) {
        // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
        var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
        HEAP16[((outPtr)>>1)]=codeUnit;
        outPtr += 2;
    }
    // Null-terminate the pointer to the HEAP.
    HEAP16[((outPtr)>>1)]=0;
    return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
    return str.length*2;
}

function UTF32ToString(ptr) {
    var i = 0;

    var str = '';
    while (1) {
        var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
        if (utf32 == 0)
            return str;
        ++i;
        // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        if (utf32 >= 0x10000) {
            var ch = utf32 - 0x10000;
            str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
        } else {
            str += String.fromCharCode(utf32);
        }
    }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
    // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
    if (maxBytesToWrite === undefined) {
        maxBytesToWrite = 0x7FFFFFFF;
    }
    if (maxBytesToWrite < 4) return 0;
    var startPtr = outPtr;
    var endPtr = startPtr + maxBytesToWrite - 4;
    for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
        if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
            var trailSurrogate = str.charCodeAt(++i);
            codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
        }
        HEAP32[((outPtr)>>2)]=codeUnit;
        outPtr += 4;
        if (outPtr + 4 > endPtr) break;
    }
    // Null-terminate the pointer to the HEAP.
    HEAP32[((outPtr)>>2)]=0;
    return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
        // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
        // See http://unicode.org/faq/utf_bom.html#utf16-3
        var codeUnit = str.charCodeAt(i);
        if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
        len += 4;
    }

    return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = _malloc(size);
    if (ret) stringToUTF8Array(str, HEAP8, ret, size);
    return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
    var size = lengthBytesUTF8(str) + 1;
    var ret = stackAlloc(size);
    stringToUTF8Array(str, HEAP8, ret, size);
    return ret;
}

function demangle(func) {
    return func;
}

function demangleAll(text) {
    var regex =
        /__Z[\w\d_]+/g;
    return text.replace(regex,
        function(x) {
            var y = demangle(x);
            return x === y ? x : (x + ' [' + y + ']');
        });
}

function jsStackTrace() {
    var err = new Error();
    if (!err.stack) {
        // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
        // so try that as a special-case.
        try {
            throw new Error(0);
        } catch(e) {
            err = e;
        }
        if (!err.stack) {
            return '(no stack trace available)';
        }
    }
    return err.stack.toString();
}

function stackTrace() {
    var js = jsStackTrace();
    if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
    return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
    if (x % multiple > 0) {
        x += multiple - (x % multiple);
    }
    return x;
}

var HEAP,
    /** @type {ArrayBuffer} */
    buffer,
    /** @type {Int8Array} */
    HEAP8,
    /** @type {Uint8Array} */
    HEAPU8,
    /** @type {Int16Array} */
    HEAP16,
    /** @type {Uint16Array} */
    HEAPU16,
    /** @type {Int32Array} */
    HEAP32,
    /** @type {Uint32Array} */
    HEAPU32,
    /** @type {Float32Array} */
    HEAPF32,
    /** @type {Float64Array} */
    HEAPF64;

function updateGlobalBuffer(buf) {
    Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
    Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
    Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
    Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
    Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
    Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
    Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
    Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
    Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
staticSealed = false;



function abortOnCannotGrowMemory() {
    abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
    abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
    buffer = Module['buffer'];
} else {
    // Use a WebAssembly memory where available
    {
        buffer = new ArrayBuffer(TOTAL_MEMORY);
    }
    Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
    return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
    while(callbacks.length > 0) {
        var callback = callbacks.shift();
        if (typeof callback == 'function') {
            callback();
            continue;
        }
        var func = callback.func;
        if (typeof func === 'number') {
            if (callback.arg === undefined) {
                Module['dynCall_v'](func);
            } else {
                Module['dynCall_vi'](func, callback.arg);
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg);
        }
    }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
    // compatibility - merge in anything from Module['preRun'] at this time
    if (Module['preRun']) {
        if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
        while (Module['preRun'].length) {
            addOnPreRun(Module['preRun'].shift());
        }
    }
    callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
    if (runtimeInitialized) return;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
    runtimeExited = true;
}

function postRun() {
    // compatibility - merge in anything from Module['postRun'] at this time
    if (Module['postRun']) {
        if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
        while (Module['postRun'].length) {
            addOnPostRun(Module['postRun'].shift());
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
    __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
    __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
    warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

    var /** @type {number} */ lastChar, /** @type {number} */ end;
    if (dontAddNull) {
        // stringToUTF8Array always appends null. If we don't want to do that, remember the
        // character that existed at the location where the null will be placed, and restore
        // that after the write (below).
        end = buffer + lengthBytesUTF8(string);
        lastChar = HEAP8[end];
    }
    stringToUTF8(string, buffer, Infinity);
    if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
        HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
    }
    // Null-terminate the pointer to the HEAP.
    if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
    if (value >= 0) {
        return value;
    }
    return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
        : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
    if (value <= 0) {
        return value;
    }
    var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
        : Math.pow(2, bits-1);
    if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
        // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
        // TODO: In i64 mode 1, resign the two parts separately and safely
        value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
    }
    return value;
}


var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled

function getUniqueRunDependency(id) {
    return id;
}

function addRunDependency(id) {
    runDependencies++;
    if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
    }
}

function removeRunDependency(id) {
    runDependencies--;
    if (Module['monitorRunDependencies']) {
        Module['monitorRunDependencies'](runDependencies);
    }
    if (runDependencies == 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null;
        }
        if (dependenciesFulfilled) {
            var callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback(); // can add another dependenciesFulfilled
        }
    }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;






// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
    return String.prototype.startsWith ?
        filename.startsWith(dataURIPrefix) :
        filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 3056;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_chp_src_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });


memoryInitializer = "data:application/octet-stream;base64,HAIAAAkDAACIAgAAEQMAAAAAAAAIAAAAiAIAABoDAAABAAAACAAAABwCAABcBQAAHAIAAJsFAAAcAgAA2QUAABwCAAAfBgAAHAIAAFwGAAAcAgAAewYAABwCAACaBgAAHAIAALkGAAAcAgAA2AYAABwCAAD3BgAAHAIAABYHAAAcAgAAUwcAABwCAAByBwAApAIAAIUHAAAAAAAAAQAAALAAAAAAAAAAHAIAAMQHAACkAgAA6gcAAAAAAAABAAAAsAAAAAAAAACkAgAAKQgAAAAAAAABAAAAsAAAAAAAAABEAgAAIAkAAPgAAAAAAAAARAIAAM0IAAAIAQAAAAAAABwCAADuCAAARAIAAPsIAADoAAAAAAAAAEQCAABmCQAA+AAAAAAAAABEAgAAQgkAACABAAAAAAAARAIAAIgJAAD4AAAAAAAAAGwCAACwCQAAbAIAALIJAABsAgAAtQkAAGwCAAC3CQAAbAIAALkJAABsAgAAuwkAAGwCAAC9CQAAbAIAAL8JAABsAgAAwQkAAGwCAADDCQAAbAIAAMUJAABsAgAAxwkAAGwCAADJCQAAbAIAAMsJAABEAgAAzQkAAOgAAAAAAAAAEAAAAFABAAAIAAAAoAEAAFABAAAIAAAAoAEAAKABAACQAQAACAAAAKABAACQAQAAYAEAAFABAAAIAAAACAAAAAgAAAAAAAAA6AAAAAEAAAACAAAAAwAAAAQAAAABAAAAAQAAAAEAAAABAAAAAAAAABABAAABAAAABQAAAAMAAAAEAAAAAQAAAAIAAAACAAAAAgAAAAAAAABAAQAAAQAAAAYAAAADAAAABAAAAAIAAAAAAAAAMAEAAAEAAAAHAAAAAwAAAAQAAAADAAAAAAAAAMABAAABAAAACAAAAAMAAAAEAAAAAQAAAAMAAAADAAAAAwAAAFFTdGF0ZQBpbml0X3N0YXRlAGNub3QAaGFkYW1hcmQAcGhhc2UAbWVhc3VyZQBmcmVlX3N0YXRlAGNsb25lX3N0YXRlADZRU3RhdGUAUDZRU3RhdGUAUEs2UVN0YXRlAGlpAHYAdmkAdmlpaQB2aWlpaQBpaWlpaWkAdmlpAGlpaQB2b2lkAGJvb2wAc3RkOjpzdHJpbmcAc3RkOjpiYXNpY19zdHJpbmc8dW5zaWduZWQgY2hhcj4Ac3RkOjp3c3RyaW5nAGVtc2NyaXB0ZW46OnZhbABlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxzaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dW5zaWduZWQgY2hhcj4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8c2hvcnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIHNob3J0PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQ+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PHVuc2lnbmVkIGludD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50OF90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzxpbnQxNl90PgBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1aW50MTZfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8aW50MzJfdD4AZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8dWludDMyX3Q+AGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGxvbmcgZG91YmxlPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0llRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZG91YmxlPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lkRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8ZmxvYXQ+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWZFRQBlbXNjcmlwdGVuOjptZW1vcnlfdmlldzx1bnNpZ25lZCBsb25nPgBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0ltRUUAZW1zY3JpcHRlbjo6bWVtb3J5X3ZpZXc8bG9uZz4ATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJbEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWpFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0lpRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJdEVFAE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SXNFRQBOMTBlbXNjcmlwdGVuMTFtZW1vcnlfdmlld0loRUUATjEwZW1zY3JpcHRlbjExbWVtb3J5X3ZpZXdJYUVFAGVtc2NyaXB0ZW46Om1lbW9yeV92aWV3PGNoYXI+AE4xMGVtc2NyaXB0ZW4xMW1lbW9yeV92aWV3SWNFRQBOMTBlbXNjcmlwdGVuM3ZhbEUATlN0M19fMjEyYmFzaWNfc3RyaW5nSXdOU18xMWNoYXJfdHJhaXRzSXdFRU5TXzlhbGxvY2F0b3JJd0VFRUUATlN0M19fMjIxX19iYXNpY19zdHJpbmdfY29tbW9uSUxiMUVFRQBOU3QzX18yMTJiYXNpY19zdHJpbmdJaE5TXzExY2hhcl90cmFpdHNJaEVFTlNfOWFsbG9jYXRvckloRUVFRQBOU3QzX18yMTJiYXNpY19zdHJpbmdJY05TXzExY2hhcl90cmFpdHNJY0VFTlNfOWFsbG9jYXRvckljRUVFRQBkb3VibGUAZmxvYXQAdW5zaWduZWQgbG9uZwBsb25nAHVuc2lnbmVkIGludABpbnQAdW5zaWduZWQgc2hvcnQAc2hvcnQAdW5zaWduZWQgY2hhcgBzaWduZWQgY2hhcgBjaGFyAE4xMF9fY3h4YWJpdjExNl9fc2hpbV90eXBlX2luZm9FAFN0OXR5cGVfaW5mbwBOMTBfX2N4eGFiaXYxMjBfX3NpX2NsYXNzX3R5cGVfaW5mb0UATjEwX19jeHhhYml2MTE3X19jbGFzc190eXBlX2luZm9FAE4xMF9fY3h4YWJpdjExOV9fcG9pbnRlcl90eXBlX2luZm9FAE4xMF9fY3h4YWJpdjExN19fcGJhc2VfdHlwZV9pbmZvRQBOMTBfX2N4eGFiaXYxMjNfX2Z1bmRhbWVudGFsX3R5cGVfaW5mb0UAdgBEbgBiAGMAaABhAHMAdABpAGoAbABtAGYAZABOMTBfX2N4eGFiaXYxMjFfX3ZtaV9jbGFzc190eXBlX2luZm9F";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

    HEAP8[tempDoublePtr] = HEAP8[ptr];

    HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

    HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

    HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

    HEAP8[tempDoublePtr] = HEAP8[ptr];

    HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

    HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

    HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

    HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

    HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

    HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

    HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}



function getShiftFromSize(size) {
    switch (size) {
        case 1: return 0;
        case 2: return 1;
        case 4: return 2;
        case 8: return 3;
        default:
            throw new TypeError('Unknown type size: ' + size);
    }
}



function embind_init_charCodes() {
    var codes = new Array(256);
    for (var i = 0; i < 256; ++i) {
        codes[i] = String.fromCharCode(i);
    }
    embind_charCodes = codes;
}var embind_charCodes=undefined;function readLatin1String(ptr) {
    var ret = "";
    var c = ptr;
    while (HEAPU8[c]) {
        ret += embind_charCodes[HEAPU8[c++]];
    }
    return ret;
}


var awaitingDependencies={};

var registeredTypes={};

var typeDependencies={};






var char_0=48;

var char_9=57;function makeLegalFunctionName(name) {
    if (undefined === name) {
        return '_unknown';
    }
    name = name.replace(/[^a-zA-Z0-9_]/g, '$');
    var f = name.charCodeAt(0);
    if (f >= char_0 && f <= char_9) {
        return '_' + name;
    } else {
        return name;
    }
}function createNamedFunction(name, body) {
    name = makeLegalFunctionName(name);
    /*jshint evil:true*/
    return new Function(
        "body",
        "return function " + name + "() {\n" +
        "    \"use strict\";" +
        "    return body.apply(this, arguments);\n" +
        "};\n"
    )(body);
}function extendError(baseErrorType, errorName) {
    var errorClass = createNamedFunction(errorName, function(message) {
        this.name = errorName;
        this.message = message;

        var stack = (new Error(message)).stack;
        if (stack !== undefined) {
            this.stack = this.toString() + '\n' +
                stack.replace(/^Error(:[^\n]*)?\n/, '');
        }
    });
    errorClass.prototype = Object.create(baseErrorType.prototype);
    errorClass.prototype.constructor = errorClass;
    errorClass.prototype.toString = function() {
        if (this.message === undefined) {
            return this.name;
        } else {
            return this.name + ': ' + this.message;
        }
    };

    return errorClass;
}var BindingError=undefined;function throwBindingError(message) {
    throw new BindingError(message);
}



var InternalError=undefined;function throwInternalError(message) {
    throw new InternalError(message);
}function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
    myTypes.forEach(function(type) {
        typeDependencies[type] = dependentTypes;
    });

    function onComplete(typeConverters) {
        var myTypeConverters = getTypeConverters(typeConverters);
        if (myTypeConverters.length !== myTypes.length) {
            throwInternalError('Mismatched type converter count');
        }
        for (var i = 0; i < myTypes.length; ++i) {
            registerType(myTypes[i], myTypeConverters[i]);
        }
    }

    var typeConverters = new Array(dependentTypes.length);
    var unregisteredTypes = [];
    var registered = 0;
    dependentTypes.forEach(function(dt, i) {
        if (registeredTypes.hasOwnProperty(dt)) {
            typeConverters[i] = registeredTypes[dt];
        } else {
            unregisteredTypes.push(dt);
            if (!awaitingDependencies.hasOwnProperty(dt)) {
                awaitingDependencies[dt] = [];
            }
            awaitingDependencies[dt].push(function() {
                typeConverters[i] = registeredTypes[dt];
                ++registered;
                if (registered === unregisteredTypes.length) {
                    onComplete(typeConverters);
                }
            });
        }
    });
    if (0 === unregisteredTypes.length) {
        onComplete(typeConverters);
    }
}function registerType(rawType, registeredInstance, options) {
    options = options || {};

    if (!('argPackAdvance' in registeredInstance)) {
        throw new TypeError('registerType registeredInstance requires argPackAdvance');
    }

    var name = registeredInstance.name;
    if (!rawType) {
        throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
    }
    if (registeredTypes.hasOwnProperty(rawType)) {
        if (options.ignoreDuplicateRegistrations) {
            return;
        } else {
            throwBindingError("Cannot register type '" + name + "' twice");
        }
    }

    registeredTypes[rawType] = registeredInstance;
    delete typeDependencies[rawType];

    if (awaitingDependencies.hasOwnProperty(rawType)) {
        var callbacks = awaitingDependencies[rawType];
        delete awaitingDependencies[rawType];
        callbacks.forEach(function(cb) {
            cb();
        });
    }
}function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
    var shift = getShiftFromSize(size);

    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        'fromWireType': function(wt) {
            // ambiguous emscripten ABI: sometimes return values are
            // true or false, and sometimes integers (0 or 1)
            return !!wt;
        },
        'toWireType': function(destructors, o) {
            return o ? trueValue : falseValue;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': function(pointer) {
            // TODO: if heap is fixed (like in asm.js) this could be executed outside
            var heap;
            if (size === 1) {
                heap = HEAP8;
            } else if (size === 2) {
                heap = HEAP16;
            } else if (size === 4) {
                heap = HEAP32;
            } else {
                throw new TypeError("Unknown boolean type size: " + name);
            }
            return this['fromWireType'](heap[pointer >> shift]);
        },
        destructorFunction: null, // This type does not need a destructor
    });
}




function ClassHandle_isAliasOf(other) {
    if (!(this instanceof ClassHandle)) {
        return false;
    }
    if (!(other instanceof ClassHandle)) {
        return false;
    }

    var leftClass = this.$$.ptrType.registeredClass;
    var left = this.$$.ptr;
    var rightClass = other.$$.ptrType.registeredClass;
    var right = other.$$.ptr;

    while (leftClass.baseClass) {
        left = leftClass.upcast(left);
        leftClass = leftClass.baseClass;
    }

    while (rightClass.baseClass) {
        right = rightClass.upcast(right);
        rightClass = rightClass.baseClass;
    }

    return leftClass === rightClass && left === right;
}


function shallowCopyInternalPointer(o) {
    return {
        count: o.count,
        deleteScheduled: o.deleteScheduled,
        preservePointerOnDelete: o.preservePointerOnDelete,
        ptr: o.ptr,
        ptrType: o.ptrType,
        smartPtr: o.smartPtr,
        smartPtrType: o.smartPtrType,
    };
}

function throwInstanceAlreadyDeleted(obj) {
    function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
    }
    throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
}function ClassHandle_clone() {
    if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
    }

    if (this.$$.preservePointerOnDelete) {
        this.$$.count.value += 1;
        return this;
    } else {
        var clone = Object.create(Object.getPrototypeOf(this), {
            $$: {
                value: shallowCopyInternalPointer(this.$$),
            }
        });

        clone.$$.count.value += 1;
        clone.$$.deleteScheduled = false;
        return clone;
    }
}


function runDestructor(handle) {
    var $$ = handle.$$;
    if ($$.smartPtr) {
        $$.smartPtrType.rawDestructor($$.smartPtr);
    } else {
        $$.ptrType.registeredClass.rawDestructor($$.ptr);
    }
}function ClassHandle_delete() {
    if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
    }

    if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError('Object already scheduled for deletion');
    }

    this.$$.count.value -= 1;
    var toDelete = 0 === this.$$.count.value;
    if (toDelete) {
        runDestructor(this);
    }
    if (!this.$$.preservePointerOnDelete) {
        this.$$.smartPtr = undefined;
        this.$$.ptr = undefined;
    }
}

function ClassHandle_isDeleted() {
    return !this.$$.ptr;
}


var delayFunction=undefined;

var deletionQueue=[];

function flushPendingDeletes() {
    while (deletionQueue.length) {
        var obj = deletionQueue.pop();
        obj.$$.deleteScheduled = false;
        obj['delete']();
    }
}function ClassHandle_deleteLater() {
    if (!this.$$.ptr) {
        throwInstanceAlreadyDeleted(this);
    }
    if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
        throwBindingError('Object already scheduled for deletion');
    }
    deletionQueue.push(this);
    if (deletionQueue.length === 1 && delayFunction) {
        delayFunction(flushPendingDeletes);
    }
    this.$$.deleteScheduled = true;
    return this;
}function init_ClassHandle() {
    ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
    ClassHandle.prototype['clone'] = ClassHandle_clone;
    ClassHandle.prototype['delete'] = ClassHandle_delete;
    ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
    ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
}function ClassHandle() {
}

var registeredPointers={};


function ensureOverloadTable(proto, methodName, humanName) {
    if (undefined === proto[methodName].overloadTable) {
        var prevFunc = proto[methodName];
        // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
        proto[methodName] = function() {
            // TODO This check can be removed in -O3 level "unsafe" optimizations.
            if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
            }
            return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
        };
        // Move the previous function into the overload table.
        proto[methodName].overloadTable = [];
        proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
    }
}function exposePublicSymbol(name, value, numArguments) {
    if (Module.hasOwnProperty(name)) {
        if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
            throwBindingError("Cannot register public name '" + name + "' twice");
        }

        // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
        // that routes between the two.
        ensureOverloadTable(Module, name, name);
        if (Module.hasOwnProperty(numArguments)) {
            throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
        }
        // Add the new function into the overload table.
        Module[name].overloadTable[numArguments] = value;
    }
    else {
        Module[name] = value;
        if (undefined !== numArguments) {
            Module[name].numArguments = numArguments;
        }
    }
}

function RegisteredClass(
    name,
    constructor,
    instancePrototype,
    rawDestructor,
    baseClass,
    getActualType,
    upcast,
    downcast
) {
    this.name = name;
    this.constructor = constructor;
    this.instancePrototype = instancePrototype;
    this.rawDestructor = rawDestructor;
    this.baseClass = baseClass;
    this.getActualType = getActualType;
    this.upcast = upcast;
    this.downcast = downcast;
    this.pureVirtualFunctions = [];
}



function upcastPointer(ptr, ptrClass, desiredClass) {
    while (ptrClass !== desiredClass) {
        if (!ptrClass.upcast) {
            throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
        }
        ptr = ptrClass.upcast(ptr);
        ptrClass = ptrClass.baseClass;
    }
    return ptr;
}function constNoSmartPtrRawPointerToWireType(destructors, handle) {
    if (handle === null) {
        if (this.isReference) {
            throwBindingError('null is not a valid ' + this.name);
        }
        return 0;
    }

    if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
    }
    if (!handle.$$.ptr) {
        throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    return ptr;
}

function genericPointerToWireType(destructors, handle) {
    var ptr;
    if (handle === null) {
        if (this.isReference) {
            throwBindingError('null is not a valid ' + this.name);
        }

        if (this.isSmartPointer) {
            ptr = this.rawConstructor();
            if (destructors !== null) {
                destructors.push(this.rawDestructor, ptr);
            }
            return ptr;
        } else {
            return 0;
        }
    }

    if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
    }
    if (!handle.$$.ptr) {
        throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
    }
    if (!this.isConst && handle.$$.ptrType.isConst) {
        throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);

    if (this.isSmartPointer) {
        // TODO: this is not strictly true
        // We could support BY_EMVAL conversions from raw pointers to smart pointers
        // because the smart pointer can hold a reference to the handle
        if (undefined === handle.$$.smartPtr) {
            throwBindingError('Passing raw pointer to smart pointer is illegal');
        }

        switch (this.sharingPolicy) {
            case 0: // NONE
                // no upcasting
                if (handle.$$.smartPtrType === this) {
                    ptr = handle.$$.smartPtr;
                } else {
                    throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                }
                break;

            case 1: // INTRUSIVE
                ptr = handle.$$.smartPtr;
                break;

            case 2: // BY_EMVAL
                if (handle.$$.smartPtrType === this) {
                    ptr = handle.$$.smartPtr;
                } else {
                    var clonedHandle = handle['clone']();
                    ptr = this.rawShare(
                        ptr,
                        __emval_register(function() {
                            clonedHandle['delete']();
                        })
                    );
                    if (destructors !== null) {
                        destructors.push(this.rawDestructor, ptr);
                    }
                }
                break;

            default:
                throwBindingError('Unsupporting sharing policy');
        }
    }
    return ptr;
}

function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
    if (handle === null) {
        if (this.isReference) {
            throwBindingError('null is not a valid ' + this.name);
        }
        return 0;
    }

    if (!handle.$$) {
        throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
    }
    if (!handle.$$.ptr) {
        throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
    }
    if (handle.$$.ptrType.isConst) {
        throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
    }
    var handleClass = handle.$$.ptrType.registeredClass;
    var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
    return ptr;
}


function simpleReadValueFromPointer(pointer) {
    return this['fromWireType'](HEAPU32[pointer >> 2]);
}

function RegisteredPointer_getPointee(ptr) {
    if (this.rawGetPointee) {
        ptr = this.rawGetPointee(ptr);
    }
    return ptr;
}

function RegisteredPointer_destructor(ptr) {
    if (this.rawDestructor) {
        this.rawDestructor(ptr);
    }
}

function RegisteredPointer_deleteObject(handle) {
    if (handle !== null) {
        handle['delete']();
    }
}


function downcastPointer(ptr, ptrClass, desiredClass) {
    if (ptrClass === desiredClass) {
        return ptr;
    }
    if (undefined === desiredClass.baseClass) {
        return null; // no conversion
    }

    var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
    if (rv === null) {
        return null;
    }
    return desiredClass.downcast(rv);
}




function getInheritedInstanceCount() {
    return Object.keys(registeredInstances).length;
}

function getLiveInheritedInstances() {
    var rv = [];
    for (var k in registeredInstances) {
        if (registeredInstances.hasOwnProperty(k)) {
            rv.push(registeredInstances[k]);
        }
    }
    return rv;
}

function setDelayFunction(fn) {
    delayFunction = fn;
    if (deletionQueue.length && delayFunction) {
        delayFunction(flushPendingDeletes);
    }
}function init_embind() {
    Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
    Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
    Module['flushPendingDeletes'] = flushPendingDeletes;
    Module['setDelayFunction'] = setDelayFunction;
}var registeredInstances={};

function getBasestPointer(class_, ptr) {
    if (ptr === undefined) {
        throwBindingError('ptr should not be undefined');
    }
    while (class_.baseClass) {
        ptr = class_.upcast(ptr);
        class_ = class_.baseClass;
    }
    return ptr;
}function getInheritedInstance(class_, ptr) {
    ptr = getBasestPointer(class_, ptr);
    return registeredInstances[ptr];
}

function makeClassHandle(prototype, record) {
    if (!record.ptrType || !record.ptr) {
        throwInternalError('makeClassHandle requires ptr and ptrType');
    }
    var hasSmartPtrType = !!record.smartPtrType;
    var hasSmartPtr = !!record.smartPtr;
    if (hasSmartPtrType !== hasSmartPtr) {
        throwInternalError('Both smartPtrType and smartPtr must be specified');
    }
    record.count = { value: 1 };
    return Object.create(prototype, {
        $$: {
            value: record,
        },
    });
}function RegisteredPointer_fromWireType(ptr) {
    // ptr is a raw pointer (or a raw smartpointer)

    // rawPointer is a maybe-null raw pointer
    var rawPointer = this.getPointee(ptr);
    if (!rawPointer) {
        this.destructor(ptr);
        return null;
    }

    var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
    if (undefined !== registeredInstance) {
        // JS object has been neutered, time to repopulate it
        if (0 === registeredInstance.$$.count.value) {
            registeredInstance.$$.ptr = rawPointer;
            registeredInstance.$$.smartPtr = ptr;
            return registeredInstance['clone']();
        } else {
            // else, just increment reference count on existing object
            // it already has a reference to the smart pointer
            var rv = registeredInstance['clone']();
            this.destructor(ptr);
            return rv;
        }
    }

    function makeDefaultHandle() {
        if (this.isSmartPointer) {
            return makeClassHandle(this.registeredClass.instancePrototype, {
                ptrType: this.pointeeType,
                ptr: rawPointer,
                smartPtrType: this,
                smartPtr: ptr,
            });
        } else {
            return makeClassHandle(this.registeredClass.instancePrototype, {
                ptrType: this,
                ptr: ptr,
            });
        }
    }

    var actualType = this.registeredClass.getActualType(rawPointer);
    var registeredPointerRecord = registeredPointers[actualType];
    if (!registeredPointerRecord) {
        return makeDefaultHandle.call(this);
    }

    var toType;
    if (this.isConst) {
        toType = registeredPointerRecord.constPointerType;
    } else {
        toType = registeredPointerRecord.pointerType;
    }
    var dp = downcastPointer(
        rawPointer,
        this.registeredClass,
        toType.registeredClass);
    if (dp === null) {
        return makeDefaultHandle.call(this);
    }
    if (this.isSmartPointer) {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
            ptrType: toType,
            ptr: dp,
            smartPtrType: this,
            smartPtr: ptr,
        });
    } else {
        return makeClassHandle(toType.registeredClass.instancePrototype, {
            ptrType: toType,
            ptr: dp,
        });
    }
}function init_RegisteredPointer() {
    RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
    RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
    RegisteredPointer.prototype['argPackAdvance'] = 8;
    RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
    RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
    RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
}function RegisteredPointer(
    name,
    registeredClass,
    isReference,
    isConst,

    // smart pointer properties
    isSmartPointer,
    pointeeType,
    sharingPolicy,
    rawGetPointee,
    rawConstructor,
    rawShare,
    rawDestructor
) {
    this.name = name;
    this.registeredClass = registeredClass;
    this.isReference = isReference;
    this.isConst = isConst;

    // smart pointer properties
    this.isSmartPointer = isSmartPointer;
    this.pointeeType = pointeeType;
    this.sharingPolicy = sharingPolicy;
    this.rawGetPointee = rawGetPointee;
    this.rawConstructor = rawConstructor;
    this.rawShare = rawShare;
    this.rawDestructor = rawDestructor;

    if (!isSmartPointer && registeredClass.baseClass === undefined) {
        if (isConst) {
            this['toWireType'] = constNoSmartPtrRawPointerToWireType;
            this.destructorFunction = null;
        } else {
            this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
            this.destructorFunction = null;
        }
    } else {
        this['toWireType'] = genericPointerToWireType;
        // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
        // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
        // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
        //       craftInvokerFunction altogether.
    }
}

function replacePublicSymbol(name, value, numArguments) {
    if (!Module.hasOwnProperty(name)) {
        throwInternalError('Replacing nonexistant public symbol');
    }
    // If there's an overload table for this symbol, replace the symbol in the overload table instead.
    if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
        Module[name].overloadTable[numArguments] = value;
    }
    else {
        Module[name] = value;
        Module[name].argCount = numArguments;
    }
}

function embind__requireFunction(signature, rawFunction) {
    signature = readLatin1String(signature);

    function makeDynCaller(dynCall) {
        var args = [];
        for (var i = 1; i < signature.length; ++i) {
            args.push('a' + i);
        }

        var name = 'dynCall_' + signature + '_' + rawFunction;
        var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
        body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
        body    += '};\n';

        return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
    }

    var fp;
    if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
        fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
    } else if (typeof FUNCTION_TABLE !== "undefined") {
        fp = FUNCTION_TABLE[rawFunction];
    } else {
        // asm.js does not give direct access to the function tables,
        // and thus we must go through the dynCall interface which allows
        // calling into a signature's function table by pointer value.
        //
        // https://github.com/dherman/asm.js/issues/83
        //
        // This has three main penalties:
        // - dynCall is another function call in the path from JavaScript to C++.
        // - JITs may not predict through the function table indirection at runtime.
        var dc = Module["asm"]['dynCall_' + signature];
        if (dc === undefined) {
            // We will always enter this branch if the signature
            // contains 'f' and PRECISE_F32 is not enabled.
            //
            // Try again, replacing 'f' with 'd'.
            dc = Module["asm"]['dynCall_' + signature.replace(/f/g, 'd')];
            if (dc === undefined) {
                throwBindingError("No dynCall invoker for signature: " + signature);
            }
        }
        fp = makeDynCaller(dc);
    }

    if (typeof fp !== "function") {
        throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
    }
    return fp;
}


var UnboundTypeError=undefined;

function getTypeName(type) {
    var ptr = ___getTypeName(type);
    var rv = readLatin1String(ptr);
    _free(ptr);
    return rv;
}function throwUnboundTypeError(message, types) {
    var unboundTypes = [];
    var seen = {};
    function visit(type) {
        if (seen[type]) {
            return;
        }
        if (registeredTypes[type]) {
            return;
        }
        if (typeDependencies[type]) {
            typeDependencies[type].forEach(visit);
            return;
        }
        unboundTypes.push(type);
        seen[type] = true;
    }
    types.forEach(visit);

    throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
}function __embind_register_class(
    rawType,
    rawPointerType,
    rawConstPointerType,
    baseClassRawType,
    getActualTypeSignature,
    getActualType,
    upcastSignature,
    upcast,
    downcastSignature,
    downcast,
    name,
    destructorSignature,
    rawDestructor
) {
    name = readLatin1String(name);
    getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
    if (upcast) {
        upcast = embind__requireFunction(upcastSignature, upcast);
    }
    if (downcast) {
        downcast = embind__requireFunction(downcastSignature, downcast);
    }
    rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
    var legalFunctionName = makeLegalFunctionName(name);

    exposePublicSymbol(legalFunctionName, function() {
        // this code cannot run if baseClassRawType is zero
        throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
    });

    whenDependentTypesAreResolved(
        [rawType, rawPointerType, rawConstPointerType],
        baseClassRawType ? [baseClassRawType] : [],
        function(base) {
            base = base[0];

            var baseClass;
            var basePrototype;
            if (baseClassRawType) {
                baseClass = base.registeredClass;
                basePrototype = baseClass.instancePrototype;
            } else {
                basePrototype = ClassHandle.prototype;
            }

            var constructor = createNamedFunction(legalFunctionName, function() {
                if (Object.getPrototypeOf(this) !== instancePrototype) {
                    throw new BindingError("Use 'new' to construct " + name);
                }
                if (undefined === registeredClass.constructor_body) {
                    throw new BindingError(name + " has no accessible constructor");
                }
                var body = registeredClass.constructor_body[arguments.length];
                if (undefined === body) {
                    throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                }
                return body.apply(this, arguments);
            });

            var instancePrototype = Object.create(basePrototype, {
                constructor: { value: constructor },
            });

            constructor.prototype = instancePrototype;

            var registeredClass = new RegisteredClass(
                name,
                constructor,
                instancePrototype,
                rawDestructor,
                baseClass,
                getActualType,
                upcast,
                downcast);

            var referenceConverter = new RegisteredPointer(
                name,
                registeredClass,
                true,
                false,
                false);

            var pointerConverter = new RegisteredPointer(
                name + '*',
                registeredClass,
                false,
                false,
                false);

            var constPointerConverter = new RegisteredPointer(
                name + ' const*',
                registeredClass,
                false,
                true,
                false);

            registeredPointers[rawType] = {
                pointerType: pointerConverter,
                constPointerType: constPointerConverter
            };

            replacePublicSymbol(legalFunctionName, constructor);

            return [referenceConverter, pointerConverter, constPointerConverter];
        }
    );
}


function heap32VectorToArray(count, firstElement) {
    var array = [];
    for (var i = 0; i < count; i++) {
        array.push(HEAP32[(firstElement >> 2) + i]);
    }
    return array;
}

function runDestructors(destructors) {
    while (destructors.length) {
        var ptr = destructors.pop();
        var del = destructors.pop();
        del(ptr);
    }
}function __embind_register_class_constructor(
    rawClassType,
    argCount,
    rawArgTypesAddr,
    invokerSignature,
    invoker,
    rawConstructor
) {
    var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    invoker = embind__requireFunction(invokerSignature, invoker);

    whenDependentTypesAreResolved([], [rawClassType], function(classType) {
        classType = classType[0];
        var humanName = 'constructor ' + classType.name;

        if (undefined === classType.registeredClass.constructor_body) {
            classType.registeredClass.constructor_body = [];
        }
        if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
            throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
        }
        classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
            throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
        };

        whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
            classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                if (arguments.length !== argCount - 1) {
                    throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                }
                var destructors = [];
                var args = new Array(argCount);
                args[0] = rawConstructor;
                for (var i = 1; i < argCount; ++i) {
                    args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                }

                var ptr = invoker.apply(null, args);
                runDestructors(destructors);

                return argTypes[0]['fromWireType'](ptr);
            };
            return [];
        });
        return [];
    });
}



var emval_free_list=[];

var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
    if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
        emval_handle_array[handle] = undefined;
        emval_free_list.push(handle);
    }
}



function count_emval_handles() {
    var count = 0;
    for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
            ++count;
        }
    }
    return count;
}

function get_first_emval() {
    for (var i = 5; i < emval_handle_array.length; ++i) {
        if (emval_handle_array[i] !== undefined) {
            return emval_handle_array[i];
        }
    }
    return null;
}function init_emval() {
    Module['count_emval_handles'] = count_emval_handles;
    Module['get_first_emval'] = get_first_emval;
}function __emval_register(value) {

    switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
            var handle = emval_free_list.length ?
                emval_free_list.pop() :
                emval_handle_array.length;

            emval_handle_array[handle] = {refcount: 1, value: value};
            return handle;
        }
    }
}function __embind_register_emval(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        'fromWireType': function(handle) {
            var rv = emval_handle_array[handle].value;
            __emval_decref(handle);
            return rv;
        },
        'toWireType': function(destructors, value) {
            return __emval_register(value);
        },
        'argPackAdvance': 8,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: null, // This type does not need a destructor

        // TODO: do we need a deleteObject here?  write a test where
        // emval is passed into JS via an interface
    });
}


function _embind_repr(v) {
    if (v === null) {
        return 'null';
    }
    var t = typeof v;
    if (t === 'object' || t === 'array' || t === 'function') {
        return v.toString();
    } else {
        return '' + v;
    }
}

function floatReadValueFromPointer(name, shift) {
    switch (shift) {
        case 2: return function(pointer) {
            return this['fromWireType'](HEAPF32[pointer >> 2]);
        };
        case 3: return function(pointer) {
            return this['fromWireType'](HEAPF64[pointer >> 3]);
        };
        default:
            throw new TypeError("Unknown float type: " + name);
    }
}function __embind_register_float(rawType, name, size) {
    var shift = getShiftFromSize(size);
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        'fromWireType': function(value) {
            return value;
        },
        'toWireType': function(destructors, value) {
            // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
            // avoid the following if() and assume value is of proper type.
            if (typeof value !== "number" && typeof value !== "boolean") {
                throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
            }
            return value;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': floatReadValueFromPointer(name, shift),
        destructorFunction: null, // This type does not need a destructor
    });
}



function new_(constructor, argumentList) {
    if (!(constructor instanceof Function)) {
        throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
    }

    /*
     * Previously, the following line was just:

     function dummy() {};

     * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
     * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
     * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
     * to write a test for this behavior.  -NRD 2013.02.22
     */
    var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
    dummy.prototype = constructor.prototype;
    var obj = new dummy;

    var r = constructor.apply(obj, argumentList);
    return (r instanceof Object) ? r : obj;
}function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
    // humanName: a human-readable string name for the function to be generated.
    // argTypes: An array that contains the embind type objects for all types in the function signature.
    //    argTypes[0] is the type object for the function return value.
    //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
    //    argTypes[2...] are the actual function parameters.
    // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
    // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
    // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
    var argCount = argTypes.length;

    if (argCount < 2) {
        throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
    }

    var isClassMethodFunc = (argTypes[1] !== null && classType !== null);

    // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
    // TODO: This omits argument count check - enable only at -O3 or similar.
    //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
    //       return FUNCTION_TABLE[fn];
    //    }


    // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
    // TODO: Remove this completely once all function invokers are being dynamically generated.
    var needsDestructorStack = false;

    for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
        if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
            needsDestructorStack = true;
            break;
        }
    }

    var returns = (argTypes[0].name !== "void");

    var argsList = "";
    var argsListWired = "";
    for(var i = 0; i < argCount - 2; ++i) {
        argsList += (i!==0?", ":"")+"arg"+i;
        argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
    }

    var invokerFnBody =
        "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
        "if (arguments.length !== "+(argCount - 2)+") {\n" +
        "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
        "}\n";


    if (needsDestructorStack) {
        invokerFnBody +=
            "var destructors = [];\n";
    }

    var dtorStack = needsDestructorStack ? "destructors" : "null";
    var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
    var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];


    if (isClassMethodFunc) {
        invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
    }

    for(var i = 0; i < argCount - 2; ++i) {
        invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
        args1.push("argType"+i);
        args2.push(argTypes[i+2]);
    }

    if (isClassMethodFunc) {
        argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
    }

    invokerFnBody +=
        (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";

    if (needsDestructorStack) {
        invokerFnBody += "runDestructors(destructors);\n";
    } else {
        for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
            var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
            if (argTypes[i].destructorFunction !== null) {
                invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                args1.push(paramName+"_dtor");
                args2.push(argTypes[i].destructorFunction);
            }
        }
    }

    if (returns) {
        invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
            "return ret;\n";
    } else {
    }
    invokerFnBody += "}\n";

    args1.push(invokerFnBody);

    var invokerFunction = new_(Function, args1).apply(null, args2);
    return invokerFunction;
}function __embind_register_function(name, argCount, rawArgTypesAddr, signature, rawInvoker, fn) {
    var argTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
    name = readLatin1String(name);

    rawInvoker = embind__requireFunction(signature, rawInvoker);

    exposePublicSymbol(name, function() {
        throwUnboundTypeError('Cannot call ' + name + ' due to unbound types', argTypes);
    }, argCount - 1);

    whenDependentTypesAreResolved([], argTypes, function(argTypes) {
        var invokerArgsArray = [argTypes[0] /* return value */, null /* no class 'this'*/].concat(argTypes.slice(1) /* actual params */);
        replacePublicSymbol(name, craftInvokerFunction(name, invokerArgsArray, null /* no class 'this'*/, rawInvoker, fn), argCount - 1);
        return [];
    });
}


function integerReadValueFromPointer(name, shift, signed) {
    // integers are quite common, so generate very specialized functions
    switch (shift) {
        case 0: return signed ?
            function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
            function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
        case 1: return signed ?
            function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
            function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
        case 2: return signed ?
            function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
            function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
        default:
            throw new TypeError("Unknown integer type: " + name);
    }
}function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
    name = readLatin1String(name);
    if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
        maxRange = 4294967295;
    }

    var shift = getShiftFromSize(size);

    var fromWireType = function(value) {
        return value;
    };

    if (minRange === 0) {
        var bitshift = 32 - 8*size;
        fromWireType = function(value) {
            return (value << bitshift) >>> bitshift;
        };
    }

    var isUnsignedType = (name.indexOf('unsigned') != -1);

    registerType(primitiveType, {
        name: name,
        'fromWireType': fromWireType,
        'toWireType': function(destructors, value) {
            // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
            // avoid the following two if()s and assume value is of proper type.
            if (typeof value !== "number" && typeof value !== "boolean") {
                throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
            }
            if (value < minRange || value > maxRange) {
                throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
            }
            return isUnsignedType ? (value >>> 0) : (value | 0);
        },
        'argPackAdvance': 8,
        'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
        destructorFunction: null, // This type does not need a destructor
    });
}

function __embind_register_memory_view(rawType, dataTypeIndex, name) {
    var typeMapping = [
        Int8Array,
        Uint8Array,
        Int16Array,
        Uint16Array,
        Int32Array,
        Uint32Array,
        Float32Array,
        Float64Array,
    ];

    var TA = typeMapping[dataTypeIndex];

    function decodeMemoryView(handle) {
        handle = handle >> 2;
        var heap = HEAPU32;
        var size = heap[handle]; // in elements
        var data = heap[handle + 1]; // byte offset into emscripten heap
        return new TA(heap['buffer'], data, size);
    }

    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        'fromWireType': decodeMemoryView,
        'argPackAdvance': 8,
        'readValueFromPointer': decodeMemoryView,
    }, {
        ignoreDuplicateRegistrations: true,
    });
}

function __embind_register_std_string(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        name: name,
        'fromWireType': function(value) {
            var length = HEAPU32[value >> 2];
            var a = new Array(length);
            for (var i = 0; i < length; ++i) {
                a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
            }
            _free(value);
            return a.join('');
        },
        'toWireType': function(destructors, value) {
            if (value instanceof ArrayBuffer) {
                value = new Uint8Array(value);
            }

            function getTAElement(ta, index) {
                return ta[index];
            }
            function getStringElement(string, index) {
                return string.charCodeAt(index);
            }
            var getElement;
            if (value instanceof Uint8Array) {
                getElement = getTAElement;
            } else if (value instanceof Uint8ClampedArray) {
                getElement = getTAElement;
            } else if (value instanceof Int8Array) {
                getElement = getTAElement;
            } else if (typeof value === 'string') {
                getElement = getStringElement;
            } else {
                throwBindingError('Cannot pass non-string to std::string');
            }

            // assumes 4-byte alignment
            var length = value.length;
            var ptr = _malloc(4 + length);
            HEAPU32[ptr >> 2] = length;
            for (var i = 0; i < length; ++i) {
                var charCode = getElement(value, i);
                if (charCode > 255) {
                    _free(ptr);
                    throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                }
                HEAPU8[ptr + 4 + i] = charCode;
            }
            if (destructors !== null) {
                destructors.push(_free, ptr);
            }
            return ptr;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: function(ptr) { _free(ptr); },
    });
}

function __embind_register_std_wstring(rawType, charSize, name) {
    // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
    name = readLatin1String(name);
    var getHeap, shift;
    if (charSize === 2) {
        getHeap = function() { return HEAPU16; };
        shift = 1;
    } else if (charSize === 4) {
        getHeap = function() { return HEAPU32; };
        shift = 2;
    }
    registerType(rawType, {
        name: name,
        'fromWireType': function(value) {
            var HEAP = getHeap();
            var length = HEAPU32[value >> 2];
            var a = new Array(length);
            var start = (value + 4) >> shift;
            for (var i = 0; i < length; ++i) {
                a[i] = String.fromCharCode(HEAP[start + i]);
            }
            _free(value);
            return a.join('');
        },
        'toWireType': function(destructors, value) {
            // assumes 4-byte alignment
            var HEAP = getHeap();
            var length = value.length;
            var ptr = _malloc(4 + length * charSize);
            HEAPU32[ptr >> 2] = length;
            var start = (ptr + 4) >> shift;
            for (var i = 0; i < length; ++i) {
                HEAP[start + i] = value.charCodeAt(i);
            }
            if (destructors !== null) {
                destructors.push(_free, ptr);
            }
            return ptr;
        },
        'argPackAdvance': 8,
        'readValueFromPointer': simpleReadValueFromPointer,
        destructorFunction: function(ptr) { _free(ptr); },
    });
}

function __embind_register_void(rawType, name) {
    name = readLatin1String(name);
    registerType(rawType, {
        isVoid: true, // void return values can be optimized out sometimes
        name: name,
        'argPackAdvance': 0,
        'fromWireType': function() {
            return undefined;
        },
        'toWireType': function(destructors, o) {
            // TODO: assert if anything else is given?
            return undefined;
        },
    });
}


function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
    return dest;
}




function ___setErrNo(value) {
    if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
    return value;
}
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

var ASSERTIONS = false;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
}

function intArrayToString(array) {
    var ret = [];
    for (var i = 0; i < array.length; i++) {
        var chr = array[i];
        if (chr > 0xFF) {
            if (ASSERTIONS) {
                assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
            }
            chr &= 0xFF;
        }
        ret.push(String.fromCharCode(chr));
    }
    return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
    var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

    var output = '';
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;
    // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
    do {
        enc1 = keyStr.indexOf(input.charAt(i++));
        enc2 = keyStr.indexOf(input.charAt(i++));
        enc3 = keyStr.indexOf(input.charAt(i++));
        enc4 = keyStr.indexOf(input.charAt(i++));

        chr1 = (enc1 << 2) | (enc2 >> 4);
        chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
        chr3 = ((enc3 & 3) << 6) | enc4;

        output = output + String.fromCharCode(chr1);

        if (enc3 !== 64) {
            output = output + String.fromCharCode(chr2);
        }
        if (enc4 !== 64) {
            output = output + String.fromCharCode(chr3);
        }
    } while (i < input.length);
    return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
    if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
        var buf;
        try {
            buf = Buffer.from(s, 'base64');
        } catch (_) {
            buf = new Buffer(s, 'base64');
        }
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }

    try {
        var decoded = decodeBase64(s);
        var bytes = new Uint8Array(decoded.length);
        for (var i = 0 ; i < decoded.length ; ++i) {
            bytes[i] = decoded.charCodeAt(i);
        }
        return bytes;
    } catch (_) {
        throw new Error('Converting base64 string to bytes failed.');
    }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
    if (!isDataURI(filename)) {
        return;
    }

    return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}



function invoke_i(index) {
    try {
        return Module["dynCall_i"](index);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_ii(index,a1) {
    try {
        return Module["dynCall_ii"](index,a1);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_iii(index,a1,a2) {
    try {
        return Module["dynCall_iii"](index,a1,a2);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_iiii(index,a1,a2,a3) {
    try {
        return Module["dynCall_iiii"](index,a1,a2,a3);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_iiiii(index,a1,a2,a3,a4) {
    try {
        return Module["dynCall_iiiii"](index,a1,a2,a3,a4);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_iiiiii(index,a1,a2,a3,a4,a5) {
    try {
        return Module["dynCall_iiiiii"](index,a1,a2,a3,a4,a5);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_v(index) {
    try {
        Module["dynCall_v"](index);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_vi(index,a1) {
    try {
        Module["dynCall_vi"](index,a1);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_vii(index,a1,a2) {
    try {
        Module["dynCall_vii"](index,a1,a2);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_viii(index,a1,a2,a3) {
    try {
        Module["dynCall_viii"](index,a1,a2,a3);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_viiii(index,a1,a2,a3,a4) {
    try {
        Module["dynCall_viiii"](index,a1,a2,a3,a4);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
    try {
        Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
    try {
        Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
    } catch(e) {
        if (typeof e !== 'number' && e !== 'longjmp') throw e;
        Module["setThrew"](1, 0);
    }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iii": invoke_iii, "invoke_iiii": invoke_iiii, "invoke_iiiii": invoke_iiiii, "invoke_iiiiii": invoke_iiiiii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_viii": invoke_viii, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "___setErrNo": ___setErrNo, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_emval": __embind_register_emval, "__embind_register_float": __embind_register_float, "__embind_register_function": __embind_register_function, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_void": __embind_register_void, "__emval_decref": __emval_decref, "__emval_register": __emval_register, "_embind_repr": _embind_repr, "_emscripten_memcpy_big": _emscripten_memcpy_big, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "craftInvokerFunction": craftInvokerFunction, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "ensureOverloadTable": ensureOverloadTable, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "new_": new_, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
    'use asm';


    var HEAP8 = new global.Int8Array(buffer);
    var HEAP16 = new global.Int16Array(buffer);
    var HEAP32 = new global.Int32Array(buffer);
    var HEAPU8 = new global.Uint8Array(buffer);
    var HEAPU16 = new global.Uint16Array(buffer);
    var HEAPU32 = new global.Uint32Array(buffer);
    var HEAPF32 = new global.Float32Array(buffer);
    var HEAPF64 = new global.Float64Array(buffer);

    var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
    var tempDoublePtr=env.tempDoublePtr|0;
    var ABORT=env.ABORT|0;
    var STACKTOP=env.STACKTOP|0;
    var STACK_MAX=env.STACK_MAX|0;

    var __THREW__ = 0;
    var threwValue = 0;
    var setjmpId = 0;
    var undef = 0;
    var nan = global.NaN, inf = global.Infinity;
    var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
    var tempRet0 = 0;

    var Math_floor=global.Math.floor;
    var Math_abs=global.Math.abs;
    var Math_sqrt=global.Math.sqrt;
    var Math_pow=global.Math.pow;
    var Math_cos=global.Math.cos;
    var Math_sin=global.Math.sin;
    var Math_tan=global.Math.tan;
    var Math_acos=global.Math.acos;
    var Math_asin=global.Math.asin;
    var Math_atan=global.Math.atan;
    var Math_atan2=global.Math.atan2;
    var Math_exp=global.Math.exp;
    var Math_log=global.Math.log;
    var Math_ceil=global.Math.ceil;
    var Math_imul=global.Math.imul;
    var Math_min=global.Math.min;
    var Math_max=global.Math.max;
    var Math_clz32=global.Math.clz32;
    var abort=env.abort;
    var assert=env.assert;
    var enlargeMemory=env.enlargeMemory;
    var getTotalMemory=env.getTotalMemory;
    var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
    var invoke_i=env.invoke_i;
    var invoke_ii=env.invoke_ii;
    var invoke_iii=env.invoke_iii;
    var invoke_iiii=env.invoke_iiii;
    var invoke_iiiii=env.invoke_iiiii;
    var invoke_iiiiii=env.invoke_iiiiii;
    var invoke_v=env.invoke_v;
    var invoke_vi=env.invoke_vi;
    var invoke_vii=env.invoke_vii;
    var invoke_viii=env.invoke_viii;
    var invoke_viiii=env.invoke_viiii;
    var invoke_viiiii=env.invoke_viiiii;
    var invoke_viiiiii=env.invoke_viiiiii;
    var ClassHandle=env.ClassHandle;
    var ClassHandle_clone=env.ClassHandle_clone;
    var ClassHandle_delete=env.ClassHandle_delete;
    var ClassHandle_deleteLater=env.ClassHandle_deleteLater;
    var ClassHandle_isAliasOf=env.ClassHandle_isAliasOf;
    var ClassHandle_isDeleted=env.ClassHandle_isDeleted;
    var RegisteredClass=env.RegisteredClass;
    var RegisteredPointer=env.RegisteredPointer;
    var RegisteredPointer_deleteObject=env.RegisteredPointer_deleteObject;
    var RegisteredPointer_destructor=env.RegisteredPointer_destructor;
    var RegisteredPointer_fromWireType=env.RegisteredPointer_fromWireType;
    var RegisteredPointer_getPointee=env.RegisteredPointer_getPointee;
    var ___setErrNo=env.___setErrNo;
    var __embind_register_bool=env.__embind_register_bool;
    var __embind_register_class=env.__embind_register_class;
    var __embind_register_class_constructor=env.__embind_register_class_constructor;
    var __embind_register_emval=env.__embind_register_emval;
    var __embind_register_float=env.__embind_register_float;
    var __embind_register_function=env.__embind_register_function;
    var __embind_register_integer=env.__embind_register_integer;
    var __embind_register_memory_view=env.__embind_register_memory_view;
    var __embind_register_std_string=env.__embind_register_std_string;
    var __embind_register_std_wstring=env.__embind_register_std_wstring;
    var __embind_register_void=env.__embind_register_void;
    var __emval_decref=env.__emval_decref;
    var __emval_register=env.__emval_register;
    var _embind_repr=env._embind_repr;
    var _emscripten_memcpy_big=env._emscripten_memcpy_big;
    var constNoSmartPtrRawPointerToWireType=env.constNoSmartPtrRawPointerToWireType;
    var count_emval_handles=env.count_emval_handles;
    var craftInvokerFunction=env.craftInvokerFunction;
    var createNamedFunction=env.createNamedFunction;
    var downcastPointer=env.downcastPointer;
    var embind__requireFunction=env.embind__requireFunction;
    var embind_init_charCodes=env.embind_init_charCodes;
    var ensureOverloadTable=env.ensureOverloadTable;
    var exposePublicSymbol=env.exposePublicSymbol;
    var extendError=env.extendError;
    var floatReadValueFromPointer=env.floatReadValueFromPointer;
    var flushPendingDeletes=env.flushPendingDeletes;
    var genericPointerToWireType=env.genericPointerToWireType;
    var getBasestPointer=env.getBasestPointer;
    var getInheritedInstance=env.getInheritedInstance;
    var getInheritedInstanceCount=env.getInheritedInstanceCount;
    var getLiveInheritedInstances=env.getLiveInheritedInstances;
    var getShiftFromSize=env.getShiftFromSize;
    var getTypeName=env.getTypeName;
    var get_first_emval=env.get_first_emval;
    var heap32VectorToArray=env.heap32VectorToArray;
    var init_ClassHandle=env.init_ClassHandle;
    var init_RegisteredPointer=env.init_RegisteredPointer;
    var init_embind=env.init_embind;
    var init_emval=env.init_emval;
    var integerReadValueFromPointer=env.integerReadValueFromPointer;
    var makeClassHandle=env.makeClassHandle;
    var makeLegalFunctionName=env.makeLegalFunctionName;
    var new_=env.new_;
    var nonConstNoSmartPtrRawPointerToWireType=env.nonConstNoSmartPtrRawPointerToWireType;
    var readLatin1String=env.readLatin1String;
    var registerType=env.registerType;
    var replacePublicSymbol=env.replacePublicSymbol;
    var runDestructor=env.runDestructor;
    var runDestructors=env.runDestructors;
    var setDelayFunction=env.setDelayFunction;
    var shallowCopyInternalPointer=env.shallowCopyInternalPointer;
    var simpleReadValueFromPointer=env.simpleReadValueFromPointer;
    var throwBindingError=env.throwBindingError;
    var throwInstanceAlreadyDeleted=env.throwInstanceAlreadyDeleted;
    var throwInternalError=env.throwInternalError;
    var throwUnboundTypeError=env.throwUnboundTypeError;
    var upcastPointer=env.upcastPointer;
    var whenDependentTypesAreResolved=env.whenDependentTypesAreResolved;
    var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

    function stackAlloc(size) {
        size = size|0;
        var ret = 0;
        ret = STACKTOP;
        STACKTOP = (STACKTOP + size)|0;
        STACKTOP = (STACKTOP + 15)&-16;

        return ret|0;
    }
    function stackSave() {
        return STACKTOP|0;
    }
    function stackRestore(top) {
        top = top|0;
        STACKTOP = top;
    }
    function establishStackSpace(stackBase, stackMax) {
        stackBase = stackBase|0;
        stackMax = stackMax|0;
        STACKTOP = stackBase;
        STACK_MAX = stackMax;
    }

    function setThrew(threw, value) {
        threw = threw|0;
        value = value|0;
        if ((__THREW__|0) == 0) {
            __THREW__ = threw;
            threwValue = value;
        }
    }

    function setTempRet0(value) {
        value = value|0;
        tempRet0 = value;
    }
    function getTempRet0() {
        return tempRet0|0;
    }

    function __Z4cnotR6QStatell($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$073 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
        var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
        var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
        var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
        var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = $1 >> 5;
        $4 = $2 >> 5;
        $5 = $1 & 31;
        $6 = (((($0)) + 16|0) + ($5<<2)|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = $2 & 31;
        $9 = (((($0)) + 16|0) + ($8<<2)|0);
        $10 = HEAP32[$9>>2]|0;
        $11 = HEAP32[$0>>2]|0;
        $12 = ($11|0)>(0);
        if (!($12)) {
            return;
        }
        $13 = ((($0)) + 4|0);
        $14 = HEAP32[$13>>2]|0;
        $15 = ((($0)) + 8|0);
        $16 = HEAP32[$15>>2]|0;
        $17 = ((($0)) + 12|0);
        $18 = HEAP32[$17>>2]|0;
        $$073 = 0;
        while(1) {
            $19 = (($14) + ($$073<<2)|0);
            $20 = HEAP32[$19>>2]|0;
            $21 = (($20) + ($3<<2)|0);
            $22 = HEAP32[$21>>2]|0;
            $23 = $22 & $7;
            $24 = ($23|0)==(0);
            $25 = (($20) + ($4<<2)|0);
            if (!($24)) {
                $26 = HEAP32[$25>>2]|0;
                $27 = $26 ^ $10;
                HEAP32[$25>>2] = $27;
            }
            $28 = (($16) + ($$073<<2)|0);
            $29 = HEAP32[$28>>2]|0;
            $30 = (($29) + ($4<<2)|0);
            $31 = HEAP32[$30>>2]|0;
            $32 = $31 & $10;
            $33 = ($32|0)==(0);
            $34 = (($29) + ($3<<2)|0);
            if (!($33)) {
                $35 = HEAP32[$34>>2]|0;
                $36 = $35 ^ $7;
                HEAP32[$34>>2] = $36;
            }
            $37 = (($14) + ($$073<<2)|0);
            $38 = HEAP32[$37>>2]|0;
            $39 = (($38) + ($3<<2)|0);
            $40 = HEAP32[$39>>2]|0;
            $41 = $40 & $7;
            $42 = ($41|0)==(0);
            if (!($42)) {
                $43 = (($16) + ($$073<<2)|0);
                $44 = HEAP32[$43>>2]|0;
                $45 = (($44) + ($4<<2)|0);
                $46 = HEAP32[$45>>2]|0;
                $47 = $46 & $10;
                $48 = ($47|0)==(0);
                if (!($48)) {
                    $49 = (($38) + ($4<<2)|0);
                    $50 = HEAP32[$49>>2]|0;
                    $51 = $50 & $10;
                    $52 = ($51|0)==(0);
                    if (!($52)) {
                        $53 = (($44) + ($3<<2)|0);
                        $54 = HEAP32[$53>>2]|0;
                        $55 = $54 & $7;
                        $56 = ($55|0)==(0);
                        if (!($56)) {
                            $57 = (($18) + ($$073<<2)|0);
                            $58 = HEAP32[$57>>2]|0;
                            $59 = (($58) + 2)|0;
                            $60 = (($59|0) % 4)&-1;
                            HEAP32[$57>>2] = $60;
                        }
                    }
                }
            }
            $61 = (($14) + ($$073<<2)|0);
            $62 = HEAP32[$61>>2]|0;
            $63 = (($62) + ($3<<2)|0);
            $64 = HEAP32[$63>>2]|0;
            $65 = $64 & $7;
            $66 = ($65|0)==(0);
            if (!($66)) {
                $67 = (($16) + ($$073<<2)|0);
                $68 = HEAP32[$67>>2]|0;
                $69 = (($68) + ($4<<2)|0);
                $70 = HEAP32[$69>>2]|0;
                $71 = $70 & $10;
                $72 = ($71|0)==(0);
                if (!($72)) {
                    $73 = (($62) + ($4<<2)|0);
                    $74 = HEAP32[$73>>2]|0;
                    $75 = $74 & $10;
                    $76 = ($75|0)==(0);
                    if ($76) {
                        $77 = (($68) + ($3<<2)|0);
                        $78 = HEAP32[$77>>2]|0;
                        $79 = $78 & $7;
                        $80 = ($79|0)==(0);
                        if ($80) {
                            $81 = (($18) + ($$073<<2)|0);
                            $82 = HEAP32[$81>>2]|0;
                            $83 = (($82) + 2)|0;
                            $84 = (($83|0) % 4)&-1;
                            HEAP32[$81>>2] = $84;
                        }
                    }
                }
            }
            $85 = (($$073) + 1)|0;
            $86 = HEAP32[$0>>2]|0;
            $87 = $86 << 1;
            $88 = ($85|0)<($87|0);
            if ($88) {
                $$073 = $85;
            } else {
                break;
            }
        }
        return;
    }
    function __Z8hadamardR6QStatel($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $$045 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
        var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
        var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $2 = $1 >> 5;
        $3 = $1 & 31;
        $4 = (((($0)) + 16|0) + ($3<<2)|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = HEAP32[$0>>2]|0;
        $7 = ($6|0)>(0);
        if (!($7)) {
            return;
        }
        $8 = ((($0)) + 4|0);
        $9 = HEAP32[$8>>2]|0;
        $10 = ((($0)) + 8|0);
        $11 = HEAP32[$10>>2]|0;
        $12 = ((($0)) + 12|0);
        $13 = HEAP32[$12>>2]|0;
        $$045 = 0;
        while(1) {
            $14 = (($9) + ($$045<<2)|0);
            $15 = HEAP32[$14>>2]|0;
            $16 = (($15) + ($2<<2)|0);
            $17 = HEAP32[$16>>2]|0;
            $18 = (($11) + ($$045<<2)|0);
            $19 = HEAP32[$18>>2]|0;
            $20 = (($19) + ($2<<2)|0);
            $21 = HEAP32[$20>>2]|0;
            $22 = $21 ^ $17;
            $23 = $22 & $5;
            $24 = $23 ^ $17;
            HEAP32[$16>>2] = $24;
            $25 = (($11) + ($$045<<2)|0);
            $26 = HEAP32[$25>>2]|0;
            $27 = (($26) + ($2<<2)|0);
            $28 = HEAP32[$27>>2]|0;
            $29 = $28 ^ $17;
            $30 = $29 & $5;
            $31 = $30 ^ $28;
            HEAP32[$27>>2] = $31;
            $32 = (($9) + ($$045<<2)|0);
            $33 = HEAP32[$32>>2]|0;
            $34 = (($33) + ($2<<2)|0);
            $35 = HEAP32[$34>>2]|0;
            $36 = $35 & $5;
            $37 = ($36|0)==(0);
            if (!($37)) {
                $38 = (($11) + ($$045<<2)|0);
                $39 = HEAP32[$38>>2]|0;
                $40 = (($39) + ($2<<2)|0);
                $41 = HEAP32[$40>>2]|0;
                $42 = $41 & $5;
                $43 = ($42|0)==(0);
                if (!($43)) {
                    $44 = (($13) + ($$045<<2)|0);
                    $45 = HEAP32[$44>>2]|0;
                    $46 = (($45) + 2)|0;
                    $47 = (($46|0) % 4)&-1;
                    HEAP32[$44>>2] = $47;
                }
            }
            $48 = (($$045) + 1)|0;
            $49 = HEAP32[$0>>2]|0;
            $50 = $49 << 1;
            $51 = ($48|0)<($50|0);
            if ($51) {
                $$045 = $48;
            } else {
                break;
            }
        }
        return;
    }
    function __Z5phaseR6QStatel($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $$029 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
        var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $5 = 0, $6 = 0;
        var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $2 = $1 >> 5;
        $3 = $1 & 31;
        $4 = (((($0)) + 16|0) + ($3<<2)|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = HEAP32[$0>>2]|0;
        $7 = ($6|0)>(0);
        if (!($7)) {
            return;
        }
        $8 = ((($0)) + 4|0);
        $9 = HEAP32[$8>>2]|0;
        $10 = ((($0)) + 8|0);
        $11 = HEAP32[$10>>2]|0;
        $12 = ((($0)) + 12|0);
        $13 = HEAP32[$12>>2]|0;
        $$029 = 0;
        while(1) {
            $14 = (($9) + ($$029<<2)|0);
            $15 = HEAP32[$14>>2]|0;
            $16 = (($15) + ($2<<2)|0);
            $17 = HEAP32[$16>>2]|0;
            $18 = $17 & $5;
            $19 = ($18|0)==(0);
            if (!($19)) {
                $20 = (($11) + ($$029<<2)|0);
                $21 = HEAP32[$20>>2]|0;
                $22 = (($21) + ($2<<2)|0);
                $23 = HEAP32[$22>>2]|0;
                $24 = $23 & $5;
                $25 = ($24|0)==(0);
                if (!($25)) {
                    $26 = (($13) + ($$029<<2)|0);
                    $27 = HEAP32[$26>>2]|0;
                    $28 = (($27) + 2)|0;
                    $29 = (($28|0) % 4)&-1;
                    HEAP32[$26>>2] = $29;
                }
            }
            $30 = (($9) + ($$029<<2)|0);
            $31 = HEAP32[$30>>2]|0;
            $32 = (($31) + ($2<<2)|0);
            $33 = HEAP32[$32>>2]|0;
            $34 = $33 & $5;
            $35 = (($11) + ($$029<<2)|0);
            $36 = HEAP32[$35>>2]|0;
            $37 = (($36) + ($2<<2)|0);
            $38 = HEAP32[$37>>2]|0;
            $39 = $38 ^ $34;
            HEAP32[$37>>2] = $39;
            $40 = (($$029) + 1)|0;
            $41 = HEAP32[$0>>2]|0;
            $42 = $41 << 1;
            $43 = ($40|0)<($42|0);
            if ($43) {
                $$029 = $40;
            } else {
                break;
            }
        }
        return;
    }
    function __Z7rowcopyR6QStatell($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$018 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
        var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = ((($0)) + 144|0);
        $4 = HEAP32[$3>>2]|0;
        $5 = ($4|0)>(0);
        if (!($5)) {
            $27 = ((($0)) + 12|0);
            $28 = HEAP32[$27>>2]|0;
            $29 = (($28) + ($2<<2)|0);
            $30 = HEAP32[$29>>2]|0;
            $31 = (($28) + ($1<<2)|0);
            HEAP32[$31>>2] = $30;
            return;
        }
        $6 = ((($0)) + 4|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = (($7) + ($2<<2)|0);
        $9 = HEAP32[$8>>2]|0;
        $10 = (($7) + ($1<<2)|0);
        $11 = HEAP32[$10>>2]|0;
        $12 = ((($0)) + 8|0);
        $13 = HEAP32[$12>>2]|0;
        $14 = (($13) + ($2<<2)|0);
        $15 = HEAP32[$14>>2]|0;
        $16 = (($13) + ($1<<2)|0);
        $17 = HEAP32[$16>>2]|0;
        $$018 = 0;
        while(1) {
            $18 = (($9) + ($$018<<2)|0);
            $19 = HEAP32[$18>>2]|0;
            $20 = (($11) + ($$018<<2)|0);
            HEAP32[$20>>2] = $19;
            $21 = (($15) + ($$018<<2)|0);
            $22 = HEAP32[$21>>2]|0;
            $23 = (($17) + ($$018<<2)|0);
            HEAP32[$23>>2] = $22;
            $24 = (($$018) + 1)|0;
            $25 = HEAP32[$3>>2]|0;
            $26 = ($24|0)<($25|0);
            if ($26) {
                $$018 = $24;
            } else {
                break;
            }
        }
        $27 = ((($0)) + 12|0);
        $28 = HEAP32[$27>>2]|0;
        $29 = (($28) + ($2<<2)|0);
        $30 = HEAP32[$29>>2]|0;
        $31 = (($28) + ($1<<2)|0);
        HEAP32[$31>>2] = $30;
        return;
    }
    function __Z6rowsetR6QStatell($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$038 = 0, $$pn = 0, $$pn$in = 0, $$sink = 0, $$sink$in = 0, $$sink33 = 0, $$sink33$v = 0, $$val = 0, $$val37 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
        var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = ((($0)) + 144|0);
        $4 = HEAP32[$3>>2]|0;
        $5 = ($4|0)>(0);
        if ($5) {
            $6 = ((($0)) + 4|0);
            $7 = HEAP32[$6>>2]|0;
            $8 = (($7) + ($1<<2)|0);
            $9 = HEAP32[$8>>2]|0;
            $10 = ((($0)) + 8|0);
            $11 = HEAP32[$10>>2]|0;
            $12 = (($11) + ($1<<2)|0);
            $13 = HEAP32[$12>>2]|0;
            $$038 = 0;
            while(1) {
                $14 = (($9) + ($$038<<2)|0);
                HEAP32[$14>>2] = 0;
                $15 = (($13) + ($$038<<2)|0);
                HEAP32[$15>>2] = 0;
                $16 = (($$038) + 1)|0;
                $17 = HEAP32[$3>>2]|0;
                $18 = ($16|0)<($17|0);
                if ($18) {
                    $$038 = $16;
                } else {
                    break;
                }
            }
        }
        $19 = ((($0)) + 12|0);
        $20 = HEAP32[$19>>2]|0;
        $21 = (($20) + ($1<<2)|0);
        HEAP32[$21>>2] = 0;
        $22 = HEAP32[$0>>2]|0;
        $23 = ($22|0)>($2|0);
        $24 = (($2) - ($22))|0;
        $25 = ((($0)) + 8|0);
        $26 = ((($0)) + 4|0);
        $$sink33$v = $23 ? $2 : $24;
        $$sink33 = $$sink33$v >> 5;
        $$pn$in = $23 ? $2 : $24;
        $$val = HEAP32[$26>>2]|0;
        $$val37 = HEAP32[$25>>2]|0;
        $27 = $23 ? $$val : $$val37;
        $28 = (($27) + ($1<<2)|0);
        $29 = HEAP32[$28>>2]|0;
        $30 = (($29) + ($$sink33<<2)|0);
        $$pn = $$pn$in & 31;
        $$sink$in = (((($0)) + 16|0) + ($$pn<<2)|0);
        $$sink = HEAP32[$$sink$in>>2]|0;
        HEAP32[$30>>2] = $$sink;
        return;
    }
    function __Z8cliffordR6QStatell($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$$4 = 0, $$$5 = 0, $$0$lcssa = 0, $$0100102 = 0, $$0101104 = 0, $$0105 = 0, $$099 = 0, $$1$ = 0, $$1103 = 0, $$2 = 0, $$2$ = 0, $$3 = 0, $$3$ = 0, $$4 = 0, $$5 = 0, $$6 = 0, $$6$ = 0, $$7 = 0, $10 = 0, $100 = 0;
        var $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0;
        var $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0;
        var $138 = 0, $139 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0;
        var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
        var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
        var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
        var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = ((($0)) + 144|0);
        $4 = HEAP32[$3>>2]|0;
        $5 = ($4|0)>(0);
        if (!($5)) {
            $$0$lcssa = 0;
            $129 = ((($0)) + 12|0);
            $130 = HEAP32[$129>>2]|0;
            $131 = (($130) + ($1<<2)|0);
            $132 = HEAP32[$131>>2]|0;
            $133 = (($132) + ($$0$lcssa))|0;
            $134 = (($130) + ($2<<2)|0);
            $135 = HEAP32[$134>>2]|0;
            $136 = (($133) + ($135))|0;
            $137 = (($136|0) % 4)&-1;
            $138 = ($137|0)>(-1);
            $139 = (($137) + 4)|0;
            $$099 = $138 ? $137 : $139;
            return ($$099|0);
        }
        $6 = ((($0)) + 4|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = (($7) + ($2<<2)|0);
        $9 = HEAP32[$8>>2]|0;
        $10 = ((($0)) + 8|0);
        $11 = HEAP32[$10>>2]|0;
        $12 = (($11) + ($2<<2)|0);
        $13 = (($7) + ($1<<2)|0);
        $14 = HEAP32[$6>>2]|0;
        $15 = (($14) + ($1<<2)|0);
        $16 = (($11) + ($1<<2)|0);
        $17 = (($11) + ($1<<2)|0);
        $18 = ((($0)) + 8|0);
        $19 = HEAP32[$18>>2]|0;
        $20 = (($19) + ($2<<2)|0);
        $21 = (($7) + ($1<<2)|0);
        $22 = (($19) + ($1<<2)|0);
        $23 = HEAP32[$6>>2]|0;
        $24 = (($23) + ($1<<2)|0);
        $25 = (($19) + ($1<<2)|0);
        $26 = ((($0)) + 8|0);
        $27 = HEAP32[$26>>2]|0;
        $28 = (($27) + ($2<<2)|0);
        $29 = (($7) + ($1<<2)|0);
        $30 = HEAP32[$6>>2]|0;
        $31 = (($30) + ($1<<2)|0);
        $32 = (($27) + ($1<<2)|0);
        $33 = (($27) + ($1<<2)|0);
        $34 = HEAP32[$3>>2]|0;
        $$0101104 = 0;$$0105 = 0;
        while(1) {
            $35 = (($9) + ($$0101104<<2)|0);
            $36 = HEAP32[$35>>2]|0;
            $$0100102 = 0;$$1103 = $$0105;
            while(1) {
                $37 = (((($0)) + 16|0) + ($$0100102<<2)|0);
                $38 = HEAP32[$37>>2]|0;
                $39 = $36 & $38;
                $40 = ($39|0)==(0);
                if ($40) {
                    $$3 = $$1103;
                } else {
                    $41 = HEAP32[$28>>2]|0;
                    $42 = (($41) + ($$0101104<<2)|0);
                    $43 = HEAP32[$42>>2]|0;
                    $44 = $43 & $38;
                    $45 = ($44|0)==(0);
                    if ($45) {
                        $46 = HEAP32[$29>>2]|0;
                        $47 = (($46) + ($$0101104<<2)|0);
                        $48 = HEAP32[$47>>2]|0;
                        $49 = $48 & $38;
                        $50 = ($49|0)==(0);
                        if ($50) {
                            $$2 = $$1103;
                        } else {
                            $51 = HEAP32[$33>>2]|0;
                            $52 = (($51) + ($$0101104<<2)|0);
                            $53 = HEAP32[$52>>2]|0;
                            $54 = $53 & $38;
                            $55 = ($54|0)!=(0);
                            $56 = $55&1;
                            $$1$ = (($$1103) + ($56))|0;
                            $$2 = $$1$;
                        }
                        $57 = HEAP32[$31>>2]|0;
                        $58 = (($57) + ($$0101104<<2)|0);
                        $59 = HEAP32[$58>>2]|0;
                        $60 = $59 & $38;
                        $61 = ($60|0)==(0);
                        if ($61) {
                            $62 = HEAP32[$32>>2]|0;
                            $63 = (($62) + ($$0101104<<2)|0);
                            $64 = HEAP32[$63>>2]|0;
                            $65 = $64 & $38;
                            $66 = ($65|0)!=(0);
                            $67 = $66 << 31 >> 31;
                            $$2$ = (($$2) + ($67))|0;
                            $$3 = $$2$;
                        } else {
                            $$3 = $$2;
                        }
                    } else {
                        $$3 = $$1103;
                    }
                }
                $68 = $36 & $38;
                $69 = ($68|0)==(0);
                if ($69) {
                    $$5 = $$3;
                } else {
                    $70 = HEAP32[$20>>2]|0;
                    $71 = (($70) + ($$0101104<<2)|0);
                    $72 = HEAP32[$71>>2]|0;
                    $73 = $72 & $38;
                    $74 = ($73|0)==(0);
                    if ($74) {
                        $$5 = $$3;
                    } else {
                        $75 = HEAP32[$21>>2]|0;
                        $76 = (($75) + ($$0101104<<2)|0);
                        $77 = HEAP32[$76>>2]|0;
                        $78 = $77 & $38;
                        $79 = ($78|0)==(0);
                        if ($79) {
                            $80 = HEAP32[$22>>2]|0;
                            $81 = (($80) + ($$0101104<<2)|0);
                            $82 = HEAP32[$81>>2]|0;
                            $83 = $82 & $38;
                            $84 = ($83|0)!=(0);
                            $85 = $84&1;
                            $$3$ = (($$3) + ($85))|0;
                            $$4 = $$3$;
                        } else {
                            $$4 = $$3;
                        }
                        $86 = HEAP32[$24>>2]|0;
                        $87 = (($86) + ($$0101104<<2)|0);
                        $88 = HEAP32[$87>>2]|0;
                        $89 = $88 & $38;
                        $90 = ($89|0)==(0);
                        if ($90) {
                            $$5 = $$4;
                        } else {
                            $91 = HEAP32[$25>>2]|0;
                            $92 = (($91) + ($$0101104<<2)|0);
                            $93 = HEAP32[$92>>2]|0;
                            $94 = $93 & $38;
                            $95 = ($94|0)==(0);
                            $96 = $95 << 31 >> 31;
                            $$$4 = (($$4) + ($96))|0;
                            $$5 = $$$4;
                        }
                    }
                }
                $97 = $36 & $38;
                $98 = ($97|0)==(0);
                if ($98) {
                    $99 = HEAP32[$12>>2]|0;
                    $100 = (($99) + ($$0101104<<2)|0);
                    $101 = HEAP32[$100>>2]|0;
                    $102 = $101 & $38;
                    $103 = ($102|0)==(0);
                    if ($103) {
                        $$7 = $$5;
                    } else {
                        $104 = HEAP32[$13>>2]|0;
                        $105 = (($104) + ($$0101104<<2)|0);
                        $106 = HEAP32[$105>>2]|0;
                        $107 = $106 & $38;
                        $108 = ($107|0)==(0);
                        if ($108) {
                            $$6 = $$5;
                        } else {
                            $109 = HEAP32[$17>>2]|0;
                            $110 = (($109) + ($$0101104<<2)|0);
                            $111 = HEAP32[$110>>2]|0;
                            $112 = $111 & $38;
                            $113 = ($112|0)==(0);
                            $114 = $113&1;
                            $$$5 = (($$5) + ($114))|0;
                            $$6 = $$$5;
                        }
                        $115 = HEAP32[$15>>2]|0;
                        $116 = (($115) + ($$0101104<<2)|0);
                        $117 = HEAP32[$116>>2]|0;
                        $118 = $117 & $38;
                        $119 = ($118|0)==(0);
                        if ($119) {
                            $$7 = $$6;
                        } else {
                            $120 = HEAP32[$16>>2]|0;
                            $121 = (($120) + ($$0101104<<2)|0);
                            $122 = HEAP32[$121>>2]|0;
                            $123 = $122 & $38;
                            $124 = ($123|0)!=(0);
                            $125 = $124 << 31 >> 31;
                            $$6$ = (($$6) + ($125))|0;
                            $$7 = $$6$;
                        }
                    }
                } else {
                    $$7 = $$5;
                }
                $126 = (($$0100102) + 1)|0;
                $exitcond = ($126|0)==(32);
                if ($exitcond) {
                    break;
                } else {
                    $$0100102 = $126;$$1103 = $$7;
                }
            }
            $127 = (($$0101104) + 1)|0;
            $128 = ($127|0)<($34|0);
            if ($128) {
                $$0101104 = $127;$$0105 = $$7;
            } else {
                $$0$lcssa = $$7;
                break;
            }
        }
        $129 = ((($0)) + 12|0);
        $130 = HEAP32[$129>>2]|0;
        $131 = (($130) + ($1<<2)|0);
        $132 = HEAP32[$131>>2]|0;
        $133 = (($132) + ($$0$lcssa))|0;
        $134 = (($130) + ($2<<2)|0);
        $135 = HEAP32[$134>>2]|0;
        $136 = (($133) + ($135))|0;
        $137 = (($136|0) % 4)&-1;
        $138 = ($137|0)>(-1);
        $139 = (($137) + 4)|0;
        $$099 = $138 ? $137 : $139;
        return ($$099|0);
    }
    function __Z7rowmultR6QStatell($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$020 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
        var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = (__Z8cliffordR6QStatell($0,$1,$2)|0);
        $4 = ((($0)) + 12|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = (($5) + ($1<<2)|0);
        HEAP32[$6>>2] = $3;
        $7 = ((($0)) + 144|0);
        $8 = HEAP32[$7>>2]|0;
        $9 = ($8|0)>(0);
        if (!($9)) {
            return;
        }
        $10 = ((($0)) + 4|0);
        $11 = HEAP32[$10>>2]|0;
        $12 = (($11) + ($2<<2)|0);
        $13 = HEAP32[$12>>2]|0;
        $14 = (($11) + ($1<<2)|0);
        $15 = HEAP32[$14>>2]|0;
        $16 = ((($0)) + 8|0);
        $17 = HEAP32[$16>>2]|0;
        $18 = (($17) + ($2<<2)|0);
        $19 = HEAP32[$18>>2]|0;
        $20 = (($17) + ($1<<2)|0);
        $21 = HEAP32[$20>>2]|0;
        $$020 = 0;
        while(1) {
            $22 = (($13) + ($$020<<2)|0);
            $23 = HEAP32[$22>>2]|0;
            $24 = (($15) + ($$020<<2)|0);
            $25 = HEAP32[$24>>2]|0;
            $26 = $25 ^ $23;
            HEAP32[$24>>2] = $26;
            $27 = (($19) + ($$020<<2)|0);
            $28 = HEAP32[$27>>2]|0;
            $29 = (($21) + ($$020<<2)|0);
            $30 = HEAP32[$29>>2]|0;
            $31 = $30 ^ $28;
            HEAP32[$29>>2] = $31;
            $32 = (($$020) + 1)|0;
            $33 = HEAP32[$7>>2]|0;
            $34 = ($32|0)<($33|0);
            if ($34) {
                $$020 = $32;
            } else {
                break;
            }
        }
        return;
    }
    function __Z7measureR6QStatelib($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $$ = 0, $$0 = 0, $$080$lcssa = 0, $$08096 = 0, $$081102 = 0, $$08289 = 0, $$183 = 0, $$18390 = 0, $$18391 = 0, $$84 = 0, $$lcssa = 0, $$lcssa85 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0;
        var $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
        var $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0;
        var $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0;
        var $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0;
        var $92 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = $1 >> 5;
        $5 = $1 & 31;
        $6 = (((($0)) + 16|0) + ($5<<2)|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = HEAP32[$0>>2]|0;
        $9 = ($8|0)>(0);
        L1: do {
            if ($9) {
                $10 = ((($0)) + 4|0);
                $11 = HEAP32[$10>>2]|0;
                $12 = HEAP32[$0>>2]|0;
                $$081102 = 0;$14 = $8;
                while(1) {
                    $13 = (($14) + ($$081102))|0;
                    $15 = (($11) + ($13<<2)|0);
                    $16 = HEAP32[$15>>2]|0;
                    $17 = (($16) + ($4<<2)|0);
                    $18 = HEAP32[$17>>2]|0;
                    $19 = $18 & $7;
                    $20 = ($19|0)==(0);
                    if (!($20)) {
                        break;
                    }
                    $21 = (($$081102) + 1)|0;
                    $22 = ($21|0)<($12|0);
                    if ($22) {
                        $$081102 = $21;$14 = $12;
                    } else {
                        break L1;
                    }
                }
                $23 = HEAP32[$0>>2]|0;
                $24 = (($23) + ($$081102))|0;
                __Z7rowcopyR6QStatell($0,$$081102,$24);
                $25 = HEAP32[$0>>2]|0;
                $26 = (($25) + ($$081102))|0;
                $27 = (($25) + ($1))|0;
                __Z6rowsetR6QStatell($0,$26,$27);
                $28 = $3&1;
                $29 = $28 << 1;
                $30 = ((($0)) + 12|0);
                $31 = HEAP32[$30>>2]|0;
                $32 = HEAP32[$0>>2]|0;
                $33 = (($32) + ($$081102))|0;
                $34 = (($31) + ($33<<2)|0);
                HEAP32[$34>>2] = $29;
                $35 = HEAP32[$0>>2]|0;
                $36 = ($35|0)>(0);
                if ($36) {
                    $37 = ((($0)) + 4|0);
                    $$08289 = 0;
                    while(1) {
                        $38 = ($$08289|0)==($$081102|0);
                        if (!($38)) {
                            $39 = HEAP32[$37>>2]|0;
                            $40 = (($39) + ($$08289<<2)|0);
                            $41 = HEAP32[$40>>2]|0;
                            $42 = (($41) + ($4<<2)|0);
                            $43 = HEAP32[$42>>2]|0;
                            $44 = $43 & $7;
                            $45 = ($44|0)==(0);
                            if (!($45)) {
                                __Z7rowmultR6QStatell($0,$$08289,$$081102);
                            }
                        }
                        $46 = (($$08289) + 1)|0;
                        $47 = HEAP32[$0>>2]|0;
                        $48 = $47 << 1;
                        $49 = ($46|0)<($48|0);
                        if ($49) {
                            $$08289 = $46;
                        } else {
                            $$lcssa = $47;
                            break;
                        }
                    }
                } else {
                    $$lcssa = $35;
                }
                $50 = HEAP32[$30>>2]|0;
                $51 = (($$lcssa) + ($$081102))|0;
                $52 = (($50) + ($51<<2)|0);
                $53 = HEAP32[$52>>2]|0;
                $54 = ($53|0)==(0);
                $$ = $54 ? 2 : 3;
                $$0 = $$;
                return ($$0|0);
            }
        } while(0);
        $55 = ($2|0)==(0);
        if (!($55)) {
            $$0 = 0;
            return ($$0|0);
        }
        $56 = HEAP32[$0>>2]|0;
        $57 = ($56|0)>(0);
        L21: do {
            if ($57) {
                $58 = ((($0)) + 4|0);
                $59 = HEAP32[$58>>2]|0;
                $60 = HEAP32[$0>>2]|0;
                $$08096 = 0;
                while(1) {
                    $61 = (($59) + ($$08096<<2)|0);
                    $62 = HEAP32[$61>>2]|0;
                    $63 = (($62) + ($4<<2)|0);
                    $64 = HEAP32[$63>>2]|0;
                    $65 = $64 & $7;
                    $66 = ($65|0)==(0);
                    if (!($66)) {
                        $$080$lcssa = $$08096;
                        break L21;
                    }
                    $67 = (($$08096) + 1)|0;
                    $68 = ($67|0)<($60|0);
                    if ($68) {
                        $$08096 = $67;
                    } else {
                        $$080$lcssa = $67;
                        break;
                    }
                }
            } else {
                $$080$lcssa = 0;
            }
        } while(0);
        $69 = HEAP32[$0>>2]|0;
        $70 = $69 << 1;
        $71 = (($69) + ($$080$lcssa))|0;
        __Z7rowcopyR6QStatell($0,$70,$71);
        $$18390 = (($$080$lcssa) + 1)|0;
        $72 = HEAP32[$0>>2]|0;
        $73 = ($$18390|0)<($72|0);
        if ($73) {
            $74 = ((($0)) + 4|0);
            $$18391 = $$18390;$85 = $72;
            while(1) {
                $75 = HEAP32[$74>>2]|0;
                $76 = (($75) + ($$18391<<2)|0);
                $77 = HEAP32[$76>>2]|0;
                $78 = (($77) + ($4<<2)|0);
                $79 = HEAP32[$78>>2]|0;
                $80 = $79 & $7;
                $81 = ($80|0)==(0);
                if (!($81)) {
                    $84 = (($$18391) + ($85))|0;
                    $86 = $85 << 1;
                    __Z7rowmultR6QStatell($0,$86,$84);
                }
                $$183 = (($$18391) + 1)|0;
                $82 = HEAP32[$0>>2]|0;
                $83 = ($$183|0)<($82|0);
                if ($83) {
                    $$18391 = $$183;$85 = $82;
                } else {
                    $$lcssa85 = $82;
                    break;
                }
            }
        } else {
            $$lcssa85 = $72;
        }
        $87 = ((($0)) + 12|0);
        $88 = HEAP32[$87>>2]|0;
        $89 = $$lcssa85 << 1;
        $90 = (($88) + ($89<<2)|0);
        $91 = HEAP32[$90>>2]|0;
        $92 = ($91|0)!=(0);
        $$84 = $92&1;
        $$0 = $$84;
        return ($$0|0);
    }
    function __Z9initstae_R6QStatel($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $$061 = 0, $$162 = 0, $$pn = 0, $$pn$in = 0, $$pn60 = 0, $$sink = 0, $$sink$in = 0, $$sink2 = 0, $$sink2$in = 0, $$sink4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0;
        var $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
        var $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0;
        var $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0;
        var $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0;
        var $92 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        HEAP32[$0>>2] = $1;
        $2 = $1 << 3;
        $3 = $2 | 4;
        $4 = (_malloc($3)|0);
        $5 = ((($0)) + 4|0);
        HEAP32[$5>>2] = $4;
        $6 = HEAP32[$0>>2]|0;
        $7 = $6 << 3;
        $8 = $7 | 4;
        $9 = (_malloc($8)|0);
        $10 = ((($0)) + 8|0);
        HEAP32[$10>>2] = $9;
        $11 = HEAP32[$0>>2]|0;
        $12 = $11 << 3;
        $13 = $12 | 4;
        $14 = (_malloc($13)|0);
        $15 = ((($0)) + 12|0);
        HEAP32[$15>>2] = $14;
        $16 = HEAP32[$0>>2]|0;
        $17 = $16 >> 5;
        $18 = (($17) + 1)|0;
        $19 = ((($0)) + 144|0);
        HEAP32[$19>>2] = $18;
        $20 = ((($0)) + 16|0);
        HEAP32[$20>>2] = 1;
        $21 = ((($0)) + 20|0);
        HEAP32[$21>>2] = 2;
        $22 = ((($0)) + 24|0);
        HEAP32[$22>>2] = 4;
        $23 = ((($0)) + 28|0);
        HEAP32[$23>>2] = 8;
        $24 = ((($0)) + 32|0);
        HEAP32[$24>>2] = 16;
        $25 = ((($0)) + 36|0);
        HEAP32[$25>>2] = 32;
        $26 = ((($0)) + 40|0);
        HEAP32[$26>>2] = 64;
        $27 = ((($0)) + 44|0);
        HEAP32[$27>>2] = 128;
        $28 = ((($0)) + 48|0);
        HEAP32[$28>>2] = 256;
        $29 = ((($0)) + 52|0);
        HEAP32[$29>>2] = 512;
        $30 = ((($0)) + 56|0);
        HEAP32[$30>>2] = 1024;
        $31 = ((($0)) + 60|0);
        HEAP32[$31>>2] = 2048;
        $32 = ((($0)) + 64|0);
        HEAP32[$32>>2] = 4096;
        $33 = ((($0)) + 68|0);
        HEAP32[$33>>2] = 8192;
        $34 = ((($0)) + 72|0);
        HEAP32[$34>>2] = 16384;
        $35 = ((($0)) + 76|0);
        HEAP32[$35>>2] = 32768;
        $36 = ((($0)) + 80|0);
        HEAP32[$36>>2] = 65536;
        $37 = ((($0)) + 84|0);
        HEAP32[$37>>2] = 131072;
        $38 = ((($0)) + 88|0);
        HEAP32[$38>>2] = 262144;
        $39 = ((($0)) + 92|0);
        HEAP32[$39>>2] = 524288;
        $40 = ((($0)) + 96|0);
        HEAP32[$40>>2] = 1048576;
        $41 = ((($0)) + 100|0);
        HEAP32[$41>>2] = 2097152;
        $42 = ((($0)) + 104|0);
        HEAP32[$42>>2] = 4194304;
        $43 = ((($0)) + 108|0);
        HEAP32[$43>>2] = 8388608;
        $44 = ((($0)) + 112|0);
        HEAP32[$44>>2] = 16777216;
        $45 = ((($0)) + 116|0);
        HEAP32[$45>>2] = 33554432;
        $46 = ((($0)) + 120|0);
        HEAP32[$46>>2] = 67108864;
        $47 = ((($0)) + 124|0);
        HEAP32[$47>>2] = 134217728;
        $48 = ((($0)) + 128|0);
        HEAP32[$48>>2] = 268435456;
        $49 = ((($0)) + 132|0);
        HEAP32[$49>>2] = 536870912;
        $50 = ((($0)) + 136|0);
        HEAP32[$50>>2] = 1073741824;
        $51 = ((($0)) + 140|0);
        HEAP32[$51>>2] = -2147483648;
        $52 = HEAP32[$0>>2]|0;
        $53 = $52 << 1;
        $54 = $53 | 1;
        $55 = ($54|0)>(0);
        if ($55) {
            $$162 = 0;
        } else {
            return;
        }
        while(1) {
            $56 = HEAP32[$19>>2]|0;
            $57 = $56 << 2;
            $58 = (_malloc($57)|0);
            $59 = HEAP32[$5>>2]|0;
            $60 = (($59) + ($$162<<2)|0);
            HEAP32[$60>>2] = $58;
            $61 = HEAP32[$19>>2]|0;
            $62 = $61 << 2;
            $63 = (_malloc($62)|0);
            $64 = HEAP32[$10>>2]|0;
            $65 = (($64) + ($$162<<2)|0);
            HEAP32[$65>>2] = $63;
            $66 = HEAP32[$19>>2]|0;
            $67 = ($66|0)>(0);
            if ($67) {
                $68 = HEAP32[$5>>2]|0;
                $69 = (($68) + ($$162<<2)|0);
                $70 = HEAP32[$69>>2]|0;
                $71 = HEAP32[$10>>2]|0;
                $72 = (($71) + ($$162<<2)|0);
                $73 = HEAP32[$72>>2]|0;
                $$061 = 0;
                while(1) {
                    $74 = (($70) + ($$061<<2)|0);
                    HEAP32[$74>>2] = 0;
                    $75 = (($73) + ($$061<<2)|0);
                    HEAP32[$75>>2] = 0;
                    $76 = (($$061) + 1)|0;
                    $77 = HEAP32[$19>>2]|0;
                    $78 = ($76|0)<($77|0);
                    if ($78) {
                        $$061 = $76;
                    } else {
                        break;
                    }
                }
            }
            $79 = HEAP32[$0>>2]|0;
            $80 = ($$162|0)<($79|0);
            if ($80) {
                $$pn$in = $5;$$sink4 = $$162;
                label = 8;
            } else {
                $81 = $79 << 1;
                $82 = ($$162|0)<($81|0);
                if ($82) {
                    $83 = (($$162) - ($79))|0;
                    $$pn$in = $10;$$sink4 = $83;
                    label = 8;
                }
            }
            if ((label|0) == 8) {
                label = 0;
                $$pn60 = $$sink4 & 31;
                $$pn = HEAP32[$$pn$in>>2]|0;
                $$sink$in = (((($0)) + 16|0) + ($$pn60<<2)|0);
                $$sink2$in = (($$pn) + ($$162<<2)|0);
                $$sink = HEAP32[$$sink$in>>2]|0;
                $$sink2 = HEAP32[$$sink2$in>>2]|0;
                $84 = $$sink4 >> 5;
                $85 = (($$sink2) + ($84<<2)|0);
                HEAP32[$85>>2] = $$sink;
            }
            $86 = HEAP32[$15>>2]|0;
            $87 = (($86) + ($$162<<2)|0);
            HEAP32[$87>>2] = 0;
            $88 = (($$162) + 1)|0;
            $89 = HEAP32[$0>>2]|0;
            $90 = $89 << 1;
            $91 = $90 | 1;
            $92 = ($88|0)<($91|0);
            if ($92) {
                $$162 = $88;
            } else {
                break;
            }
        }
        return;
    }
    function __Z10free_stateR6QState($0) {
        $0 = $0|0;
        var $$010 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
        var $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = HEAP32[$0>>2]|0;
        $2 = $1 << 1;
        $3 = $2 | 1;
        $4 = ($3|0)>(0);
        $5 = ((($0)) + 4|0);
        if ($4) {
            $6 = ((($0)) + 8|0);
            $$010 = 0;
            while(1) {
                $12 = HEAP32[$5>>2]|0;
                $13 = (($12) + ($$010<<2)|0);
                $14 = HEAP32[$13>>2]|0;
                _free($14);
                $15 = HEAP32[$6>>2]|0;
                $16 = (($15) + ($$010<<2)|0);
                $17 = HEAP32[$16>>2]|0;
                _free($17);
                $18 = (($$010) + 1)|0;
                $19 = HEAP32[$0>>2]|0;
                $20 = $19 << 1;
                $21 = $20 | 1;
                $22 = ($18|0)<($21|0);
                if ($22) {
                    $$010 = $18;
                } else {
                    break;
                }
            }
        }
        $7 = HEAP32[$5>>2]|0;
        _free($7);
        $8 = ((($0)) + 8|0);
        $9 = HEAP32[$8>>2]|0;
        _free($9);
        $10 = ((($0)) + 12|0);
        $11 = HEAP32[$10>>2]|0;
        _free($11);
        return;
    }
    function __Z11clone_stateRK6QState($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $$021 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
        var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
        var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $exitcond = 0, dest = 0, label = 0, sp = 0, src = 0, stop = 0;
        sp = STACKTOP;
        $2 = HEAP32[$1>>2]|0;
        HEAP32[$0>>2] = $2;
        $3 = ((($1)) + 144|0);
        $4 = HEAP32[$3>>2]|0;
        $5 = ((($0)) + 144|0);
        HEAP32[$5>>2] = $4;
        $6 = ((($0)) + 16|0);
        $7 = ((($1)) + 16|0);
        dest=$6; src=$7; stop=dest+128|0; do { HEAP32[dest>>2]=HEAP32[src>>2]|0; dest=dest+4|0; src=src+4|0; } while ((dest|0) < (stop|0));
        $8 = HEAP32[$0>>2]|0;
        $9 = $8 << 1;
        $10 = $9 | 1;
        $11 = $10 << 2;
        $12 = (_malloc($11)|0);
        $13 = ((($0)) + 12|0);
        HEAP32[$13>>2] = $12;
        $14 = ((($1)) + 12|0);
        $15 = HEAP32[$14>>2]|0;
        _memcpy(($12|0),($15|0),($11|0))|0;
        $16 = (_malloc($11)|0);
        $17 = ((($0)) + 4|0);
        HEAP32[$17>>2] = $16;
        $18 = (_malloc($11)|0);
        $19 = ((($0)) + 8|0);
        HEAP32[$19>>2] = $18;
        $20 = ($10|0)>(0);
        if (!($20)) {
            return;
        }
        $21 = ((($1)) + 4|0);
        $22 = ((($1)) + 8|0);
        $$021 = 0;
        while(1) {
            $23 = HEAP32[$5>>2]|0;
            $24 = $23 << 2;
            $25 = (_malloc($24)|0);
            $26 = HEAP32[$17>>2]|0;
            $27 = (($26) + ($$021<<2)|0);
            HEAP32[$27>>2] = $25;
            $28 = HEAP32[$5>>2]|0;
            $29 = $28 << 2;
            $30 = (_malloc($29)|0);
            $31 = HEAP32[$19>>2]|0;
            $32 = (($31) + ($$021<<2)|0);
            HEAP32[$32>>2] = $30;
            $33 = HEAP32[$17>>2]|0;
            $34 = (($33) + ($$021<<2)|0);
            $35 = HEAP32[$34>>2]|0;
            $36 = HEAP32[$21>>2]|0;
            $37 = (($36) + ($$021<<2)|0);
            $38 = HEAP32[$37>>2]|0;
            $39 = HEAP32[$5>>2]|0;
            $40 = $39 << 2;
            _memcpy(($35|0),($38|0),($40|0))|0;
            $41 = HEAP32[$19>>2]|0;
            $42 = (($41) + ($$021<<2)|0);
            $43 = HEAP32[$42>>2]|0;
            $44 = HEAP32[$22>>2]|0;
            $45 = (($44) + ($$021<<2)|0);
            $46 = HEAP32[$45>>2]|0;
            $47 = HEAP32[$5>>2]|0;
            $48 = $47 << 2;
            _memcpy(($43|0),($46|0),($48|0))|0;
            $49 = (($$021) + 1)|0;
            $exitcond = ($49|0)==($10|0);
            if ($exitcond) {
                break;
            } else {
                $$021 = $49;
            }
        }
        return;
    }
    function ___cxx_global_var_init() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN38EmscriptenBindingInitializer_my_moduleC2Ev(0);
        return;
    }
    function __ZN38EmscriptenBindingInitializer_my_moduleC2Ev($0) {
        $0 = $0|0;
        var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $1 = sp;
        __ZN10emscripten8internal11NoBaseClass6verifyI6QStateEEvv();
        $2 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI6QStateEEPFvvEv()|0);
        $3 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI6QStateEEPFvvEv()|0);
        $4 = (__ZN10emscripten8internal6TypeIDI6QStateE3getEv()|0);
        $5 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI6QStateEEE3getEv()|0);
        $6 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK6QStateEEE3getEv()|0);
        $7 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0);
        $8 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
        $9 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
        $10 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0);
        $11 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0);
        __embind_register_class(($4|0),($5|0),($6|0),($7|0),($8|0),(1|0),($9|0),($2|0),($10|0),($3|0),(708|0),($11|0),(9|0));
        $12 = (__ZN10emscripten8internal6TypeIDI6QStateE3getEv()|0);
        $13 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP6QStateEE8getCountEv($1)|0);
        $14 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP6QStateEE8getTypesEv($1)|0);
        $15 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0);
        __embind_register_class_constructor(($12|0),($13|0),($14|0),($15|0),(2|0),(1|0));
        __ZN10emscripten8functionIvJR6QStatelEJEEEvPKcPFT_DpT0_EDpT1_(715,1);
        __ZN10emscripten8functionIvJR6QStatellEJEEEvPKcPFT_DpT0_EDpT1_(726,1);
        __ZN10emscripten8functionIvJR6QStatelEJEEEvPKcPFT_DpT0_EDpT1_(731,2);
        __ZN10emscripten8functionIvJR6QStatelEJEEEvPKcPFT_DpT0_EDpT1_(740,3);
        __ZN10emscripten8functionIiJR6QStatelibEJEEEvPKcPFT_DpT0_EDpT1_(746,1);
        __ZN10emscripten8functionIvJR6QStateEJEEEvPKcPFT_DpT0_EDpT1_(754,10);
        __ZN10emscripten8functionI6QStateJRKS1_EJEEEvPKcPFT_DpT0_EDpT1_(765,4);
        STACKTOP = sp;return;
    }
    function __ZN10emscripten8functionIvJR6QStatelEJEEEvPKcPFT_DpT0_EDpT1_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $2 = sp;
        $3 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatelEE8getCountEv($2)|0);
        $4 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatelEE8getTypesEv($2)|0);
        $5 = (__ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv()|0);
        __embind_register_function(($0|0),($3|0),($4|0),($5|0),(2|0),($1|0));
        STACKTOP = sp;return;
    }
    function __ZN10emscripten8functionIvJR6QStatellEJEEEvPKcPFT_DpT0_EDpT1_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $2 = sp;
        $3 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatellEE8getCountEv($2)|0);
        $4 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatellEE8getTypesEv($2)|0);
        $5 = (__ZN10emscripten8internal19getGenericSignatureIJviiiiEEEPKcv()|0);
        __embind_register_function(($0|0),($3|0),($4|0),($5|0),(4|0),($1|0));
        STACKTOP = sp;return;
    }
    function __ZN10emscripten8functionIiJR6QStatelibEJEEEvPKcPFT_DpT0_EDpT1_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $2 = sp;
        $3 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiR6QStatelibEE8getCountEv($2)|0);
        $4 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiR6QStatelibEE8getTypesEv($2)|0);
        $5 = (__ZN10emscripten8internal19getGenericSignatureIJiiiiiiEEEPKcv()|0);
        __embind_register_function(($0|0),($3|0),($4|0),($5|0),(1|0),($1|0));
        STACKTOP = sp;return;
    }
    function __ZN10emscripten8functionIvJR6QStateEJEEEvPKcPFT_DpT0_EDpT1_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $2 = sp;
        $3 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStateEE8getCountEv($2)|0);
        $4 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStateEE8getTypesEv($2)|0);
        $5 = (__ZN10emscripten8internal19getGenericSignatureIJviiEEEPKcv()|0);
        __embind_register_function(($0|0),($3|0),($4|0),($5|0),(5|0),($1|0));
        STACKTOP = sp;return;
    }
    function __ZN10emscripten8functionI6QStateJRKS1_EJEEEvPKcPFT_DpT0_EDpT1_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $2 = sp;
        $3 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ6QStateRKS4_EE8getCountEv($2)|0);
        $4 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ6QStateRKS4_EE8getTypesEv($2)|0);
        $5 = (__ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv()|0);
        __embind_register_function(($0|0),($3|0),($4|0),($5|0),(1|0),($1|0));
        STACKTOP = sp;return;
    }
    function __ZN10emscripten8internal11NoBaseClass6verifyI6QStateEEvv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return;
    }
    function __ZN10emscripten8internal13getActualTypeI6QStateEEPKvPT_($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14getLightTypeIDI6QStateEEPKvRKT_($0)|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal11NoBaseClass11getUpcasterI6QStateEEPFvvEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (0|0);
    }
    function __ZN10emscripten8internal11NoBaseClass13getDowncasterI6QStateEEPFvvEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (0|0);
    }
    function __ZN10emscripten8internal14raw_destructorI6QStateEEvPT_($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = ($0|0)==(0|0);
        if ($1) {
            return;
        }
        __ZdlPv($0);
        return;
    }
    function __ZN10emscripten8internal6TypeIDI6QStateE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDI6QStateE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI6QStateEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIP6QStateE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK6QStateEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIPK6QStateE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11NoBaseClass3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (0|0);
    }
    function __ZN10emscripten8internal14getLightTypeIDI6QStateEEPKvRKT_($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (8|0);
    }
    function __ZN10emscripten8internal11LightTypeIDI6QStateE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (8|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIP6QStateE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (16|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIPK6QStateE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (32|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (804|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (807|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (809|0);
    }
    function __ZN10emscripten8internal12operator_newI6QStateJEEEPT_DpOT0_() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__Znwj(148)|0);
        _memset(($0|0),0,148)|0;
        return ($0|0);
    }
    function __ZN10emscripten8internal7InvokerIP6QStateJEE6invokeEPFS3_vE($0) {
        $0 = $0|0;
        var $1 = 0, $2 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (FUNCTION_TABLE_i[$0 & 1]()|0);
        $2 = (__ZN10emscripten8internal11BindingTypeIP6QStateE10toWireTypeES3_($1)|0);
        return ($2|0);
    }
    function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP6QStateEE8getCountEv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return 1;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP6QStateEE8getTypesEv($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI6QStateEEEEEE3getEv()|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal11BindingTypeIP6QStateE10toWireTypeES3_($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return ($0|0);
    }
    function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI6QStateEEEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (464|0);
    }
    function __ZN10emscripten8internal7InvokerIvJR6QStatelEE6invokeEPFvS3_lEPS2_l($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $3 = 0, $4 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = (__ZN10emscripten8internal18GenericBindingTypeI6QStateE12fromWireTypeEPS2_($1)|0);
        $4 = (__ZN10emscripten8internal11BindingTypeIlE12fromWireTypeEl($2)|0);
        FUNCTION_TABLE_vii[$0 & 7]($3,$4);
        return;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatelEE8getCountEv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return 3;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatelEE8getTypesEv($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvR6QStatelEEEE3getEv()|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal18GenericBindingTypeI6QStateE12fromWireTypeEPS2_($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return ($0|0);
    }
    function __ZN10emscripten8internal11BindingTypeIlE12fromWireTypeEl($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return ($0|0);
    }
    function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvR6QStatelEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (468|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJviiiEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (812|0);
    }
    function __ZN10emscripten8internal7InvokerIvJR6QStatellEE6invokeEPFvS3_llEPS2_ll($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = (__ZN10emscripten8internal18GenericBindingTypeI6QStateE12fromWireTypeEPS2_($1)|0);
        $5 = (__ZN10emscripten8internal11BindingTypeIlE12fromWireTypeEl($2)|0);
        $6 = (__ZN10emscripten8internal11BindingTypeIlE12fromWireTypeEl($3)|0);
        FUNCTION_TABLE_viii[$0 & 3]($4,$5,$6);
        return;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatellEE8getCountEv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return 4;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStatellEE8getTypesEv($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvR6QStatellEEEE3getEv()|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvR6QStatellEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (480|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJviiiiEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (817|0);
    }
    function __ZN10emscripten8internal7InvokerIiJR6QStatelibEE6invokeEPFiS3_libEPS2_lib($0,$1,$2,$3,$4) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        var $10 = 0, $11 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $5 = sp;
        $6 = (__ZN10emscripten8internal18GenericBindingTypeI6QStateE12fromWireTypeEPS2_($1)|0);
        $7 = (__ZN10emscripten8internal11BindingTypeIlE12fromWireTypeEl($2)|0);
        $8 = (__ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($3)|0);
        $9 = (__ZN10emscripten8internal11BindingTypeIbE12fromWireTypeEb($4)|0);
        $10 = (FUNCTION_TABLE_iiiii[$0 & 1]($6,$7,$8,$9)|0);
        HEAP32[$5>>2] = $10;
        $11 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($5)|0);
        STACKTOP = sp;return ($11|0);
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiR6QStatelibEE8getCountEv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return 5;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiR6QStatelibEE8getTypesEv($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiR6QStatelibEEEE3getEv()|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = HEAP32[$0>>2]|0;
        return ($1|0);
    }
    function __ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return ($0|0);
    }
    function __ZN10emscripten8internal11BindingTypeIbE12fromWireTypeEb($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return ($0|0);
    }
    function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiR6QStatelibEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (496|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJiiiiiiEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (823|0);
    }
    function __ZN10emscripten8internal7InvokerIvJR6QStateEE6invokeEPFvS3_EPS2_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $2 = (__ZN10emscripten8internal18GenericBindingTypeI6QStateE12fromWireTypeEPS2_($1)|0);
        FUNCTION_TABLE_vi[$0 & 15]($2);
        return;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStateEE8getCountEv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return 2;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvR6QStateEE8getTypesEv($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvR6QStateEEEE3getEv()|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvR6QStateEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (516|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJviiEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (830|0);
    }
    function __ZN10emscripten8internal7InvokerI6QStateJRKS2_EE6invokeEPFS2_S4_EPS2_($0,$1) {
        $0 = $0|0;
        $1 = $1|0;
        var $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 160|0;
        $2 = sp;
        $3 = (__ZN10emscripten8internal18GenericBindingTypeI6QStateE12fromWireTypeEPS2_($1)|0);
        FUNCTION_TABLE_vii[$0 & 7]($2,$3);
        $4 = (__ZN10emscripten8internal18GenericBindingTypeI6QStateE10toWireTypeEOS2_($2)|0);
        STACKTOP = sp;return ($4|0);
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ6QStateRKS4_EE8getCountEv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return 2;
    }
    function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJ6QStateRKS4_EE8getTypesEv($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJ6QStateRKS3_EEEE3getEv()|0);
        return ($1|0);
    }
    function __ZN10emscripten8internal18GenericBindingTypeI6QStateE10toWireTypeEOS2_($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__Znwj(148)|0);
        _memcpy(($1|0),($0|0),148)|0;
        return ($1|0);
    }
    function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJ6QStateRKS3_EEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (524|0);
    }
    function __ZN10emscripten8internal19getGenericSignatureIJiiiEEEPKcv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (834|0);
    }
    function __GLOBAL__sub_I_chp_src_cpp() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        ___cxx_global_var_init();
        return;
    }
    function __GLOBAL__sub_I_bind_cpp() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        ___cxx_global_var_init_2();
        return;
    }
    function ___cxx_global_var_init_2() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev(0);
        return;
    }
    function __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev($0) {
        $0 = $0|0;
        var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDIvE3getEv()|0);
        __embind_register_void(($1|0),(838|0));
        $2 = (__ZN10emscripten8internal6TypeIDIbE3getEv()|0);
        __embind_register_bool(($2|0),(843|0),1,1,0);
        __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerItEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc();
        __ZN12_GLOBAL__N_1L16register_integerImEEvPKc();
        __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc();
        __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc();
        $3 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0);
        __embind_register_std_string(($3|0),(848|0));
        $4 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0);
        __embind_register_std_string(($4|0),(860|0));
        $5 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0);
        __embind_register_std_wstring(($5|0),4,(893|0));
        $6 = (__ZN10emscripten8internal6TypeIDINS_3valEE3getEv()|0);
        __embind_register_emval(($6|0),(906|0));
        __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc();
        __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(922);
        __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(959);
        __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(998);
        __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(1029);
        __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(1069);
        __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(1098);
        __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc();
        __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc();
        __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc(1136);
        __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc(1168);
        __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc(1201);
        __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc(1234);
        __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc(1268);
        __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc(1301);
        __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc();
        __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc();
        __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc();
        return;
    }
    function __ZN10emscripten8internal6TypeIDIvE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIvE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal6TypeIDIbE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIbE3getEv()|0);
        return ($0|0);
    }
    function __ZN12_GLOBAL__N_1L16register_integerIcEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIcE3getEv()|0);
        __embind_register_integer(($0|0),(2248|0),1,-128,127);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerIaEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIaE3getEv()|0);
        __embind_register_integer(($0|0),(2236|0),1,-128,127);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerIhEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIhE3getEv()|0);
        __embind_register_integer(($0|0),(2222|0),1,0,255);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerIsEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIsE3getEv()|0);
        __embind_register_integer(($0|0),(2216|0),2,-32768,32767);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerItEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDItE3getEv()|0);
        __embind_register_integer(($0|0),(2201|0),2,0,65535);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerIiEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0);
        __embind_register_integer(($0|0),(2197|0),4,-2147483648,2147483647);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerIjEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0);
        __embind_register_integer(($0|0),(2184|0),4,0,-1);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerIlEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIlE3getEv()|0);
        __embind_register_integer(($0|0),(2179|0),4,-2147483648,2147483647);
        return;
    }
    function __ZN12_GLOBAL__N_1L16register_integerImEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDImE3getEv()|0);
        __embind_register_integer(($0|0),(2165|0),4,0,-1);
        return;
    }
    function __ZN12_GLOBAL__N_1L14register_floatIfEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0);
        __embind_register_float(($0|0),(2159|0),4);
        return;
    }
    function __ZN12_GLOBAL__N_1L14register_floatIdEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDIdE3getEv()|0);
        __embind_register_float(($0|0),(2152|0),8);
        return;
    }
    function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_3valEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv()|0);
        return ($0|0);
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIcEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv()|0);
        __embind_register_memory_view(($0|0),0,(1845|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIaEEvPKc($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv()|0);
        __embind_register_memory_view(($1|0),0,($0|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIhEEvPKc($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv()|0);
        __embind_register_memory_view(($1|0),1,($0|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIsEEvPKc($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv()|0);
        __embind_register_memory_view(($1|0),2,($0|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewItEEvPKc($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv()|0);
        __embind_register_memory_view(($1|0),3,($0|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIiEEvPKc($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv()|0);
        __embind_register_memory_view(($1|0),4,($0|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIjEEvPKc($0) {
        $0 = $0|0;
        var $1 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv()|0);
        __embind_register_memory_view(($1|0),5,($0|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIlEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv()|0);
        __embind_register_memory_view(($0|0),4,(1598|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewImEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv()|0);
        __embind_register_memory_view(($0|0),5,(1528|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIfEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv()|0);
        __embind_register_memory_view(($0|0),6,(1466|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIdEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv()|0);
        __embind_register_memory_view(($0|0),7,(1403|0));
        return;
    }
    function __ZN12_GLOBAL__N_1L20register_memory_viewIeEEvPKc() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv()|0);
        __embind_register_memory_view(($0|0),7,(1335|0));
        return;
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (48|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (56|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (64|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (72|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (80|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (88|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (96|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (104|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (112|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (120|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (128|0);
    }
    function __ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (136|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (144|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (152|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (184|0);
    }
    function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (208|0);
    }
    function __ZN10emscripten8internal6TypeIDIdE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIdE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIdE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (440|0);
    }
    function __ZN10emscripten8internal6TypeIDIfE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIfE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIfE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (432|0);
    }
    function __ZN10emscripten8internal6TypeIDImE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDImE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDImE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (424|0);
    }
    function __ZN10emscripten8internal6TypeIDIlE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIlE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIlE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (416|0);
    }
    function __ZN10emscripten8internal6TypeIDIjE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIjE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIjE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (408|0);
    }
    function __ZN10emscripten8internal6TypeIDIiE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIiE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIiE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (400|0);
    }
    function __ZN10emscripten8internal6TypeIDItE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDItE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDItE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (392|0);
    }
    function __ZN10emscripten8internal6TypeIDIsE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIsE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIsE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (384|0);
    }
    function __ZN10emscripten8internal6TypeIDIhE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIhE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIhE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (368|0);
    }
    function __ZN10emscripten8internal6TypeIDIaE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIaE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIaE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (376|0);
    }
    function __ZN10emscripten8internal6TypeIDIcE3getEv() {
        var $0 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = (__ZN10emscripten8internal11LightTypeIDIcE3getEv()|0);
        return ($0|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIcE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (360|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIbE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (352|0);
    }
    function __ZN10emscripten8internal11LightTypeIDIvE3getEv() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (336|0);
    }
    function ___getTypeName($0) {
        $0 = $0|0;
        var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = ((($0)) + 4|0);
        $2 = HEAP32[$1>>2]|0;
        $3 = (___strdup($2)|0);
        return ($3|0);
    }
    function _malloc($0) {
        $0 = $0|0;
        var $$$0172$i = 0, $$$0173$i = 0, $$$4236$i = 0, $$$4329$i = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$0172$lcssa$i = 0, $$01724$i = 0, $$0173$lcssa$i = 0, $$01733$i = 0, $$0192 = 0, $$0194 = 0, $$0201$i$i = 0, $$0202$i$i = 0, $$0206$i$i = 0, $$0207$i$i = 0;
        var $$024367$i = 0, $$0260$i$i = 0, $$0261$i$i = 0, $$0262$i$i = 0, $$0268$i$i = 0, $$0269$i$i = 0, $$0320$i = 0, $$0322$i = 0, $$0323$i = 0, $$0325$i = 0, $$0331$i = 0, $$0336$i = 0, $$0337$$i = 0, $$0337$i = 0, $$0339$i = 0, $$0340$i = 0, $$0345$i = 0, $$1176$i = 0, $$1178$i = 0, $$124466$i = 0;
        var $$1264$i$i = 0, $$1266$i$i = 0, $$1321$i = 0, $$1326$i = 0, $$1341$i = 0, $$1347$i = 0, $$1351$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2333$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i199 = 0, $$3328$i = 0, $$3349$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$4236$i = 0, $$4329$lcssa$i = 0;
        var $$43298$i = 0, $$4335$$4$i = 0, $$4335$ph$i = 0, $$43357$i = 0, $$49$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i17$i = 0, $$pre$i195 = 0, $$pre$i207 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i208Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink1$i = 0, $$sink1$i$i = 0;
        var $$sink12$i = 0, $$sink2$i = 0, $$sink2$i202 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
        var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
        var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
        var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
        var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
        var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
        var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
        var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
        var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
        var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
        var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
        var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
        var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
        var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
        var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
        var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
        var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
        var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
        var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
        var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
        var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
        var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
        var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
        var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
        var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
        var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
        var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
        var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
        var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
        var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
        var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
        var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
        var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
        var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
        var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
        var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
        var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
        var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
        var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
        var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0;
        var $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0;
        var $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0;
        var $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0;
        var $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0;
        var $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0;
        var $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0;
        var $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0;
        var $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0;
        var $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i206 = 0, $not$$i = 0, $not$3$i = 0;
        var $or$cond$i = 0, $or$cond$i200 = 0, $or$cond1$i = 0, $or$cond1$i198 = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0, label = 0, sp = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 16|0;
        $1 = sp;
        $2 = ($0>>>0)<(245);
        do {
            if ($2) {
                $3 = ($0>>>0)<(11);
                $4 = (($0) + 11)|0;
                $5 = $4 & -8;
                $6 = $3 ? 16 : $5;
                $7 = $6 >>> 3;
                $8 = HEAP32[638]|0;
                $9 = $8 >>> $7;
                $10 = $9 & 3;
                $11 = ($10|0)==(0);
                if (!($11)) {
                    $12 = $9 & 1;
                    $13 = $12 ^ 1;
                    $14 = (($13) + ($7))|0;
                    $15 = $14 << 1;
                    $16 = (2592 + ($15<<2)|0);
                    $17 = ((($16)) + 8|0);
                    $18 = HEAP32[$17>>2]|0;
                    $19 = ((($18)) + 8|0);
                    $20 = HEAP32[$19>>2]|0;
                    $21 = ($20|0)==($16|0);
                    if ($21) {
                        $22 = 1 << $14;
                        $23 = $22 ^ -1;
                        $24 = $8 & $23;
                        HEAP32[638] = $24;
                    } else {
                        $25 = ((($20)) + 12|0);
                        HEAP32[$25>>2] = $16;
                        HEAP32[$17>>2] = $20;
                    }
                    $26 = $14 << 3;
                    $27 = $26 | 3;
                    $28 = ((($18)) + 4|0);
                    HEAP32[$28>>2] = $27;
                    $29 = (($18) + ($26)|0);
                    $30 = ((($29)) + 4|0);
                    $31 = HEAP32[$30>>2]|0;
                    $32 = $31 | 1;
                    HEAP32[$30>>2] = $32;
                    $$0 = $19;
                    STACKTOP = sp;return ($$0|0);
                }
                $33 = HEAP32[(2560)>>2]|0;
                $34 = ($6>>>0)>($33>>>0);
                if ($34) {
                    $35 = ($9|0)==(0);
                    if (!($35)) {
                        $36 = $9 << $7;
                        $37 = 2 << $7;
                        $38 = (0 - ($37))|0;
                        $39 = $37 | $38;
                        $40 = $36 & $39;
                        $41 = (0 - ($40))|0;
                        $42 = $40 & $41;
                        $43 = (($42) + -1)|0;
                        $44 = $43 >>> 12;
                        $45 = $44 & 16;
                        $46 = $43 >>> $45;
                        $47 = $46 >>> 5;
                        $48 = $47 & 8;
                        $49 = $48 | $45;
                        $50 = $46 >>> $48;
                        $51 = $50 >>> 2;
                        $52 = $51 & 4;
                        $53 = $49 | $52;
                        $54 = $50 >>> $52;
                        $55 = $54 >>> 1;
                        $56 = $55 & 2;
                        $57 = $53 | $56;
                        $58 = $54 >>> $56;
                        $59 = $58 >>> 1;
                        $60 = $59 & 1;
                        $61 = $57 | $60;
                        $62 = $58 >>> $60;
                        $63 = (($61) + ($62))|0;
                        $64 = $63 << 1;
                        $65 = (2592 + ($64<<2)|0);
                        $66 = ((($65)) + 8|0);
                        $67 = HEAP32[$66>>2]|0;
                        $68 = ((($67)) + 8|0);
                        $69 = HEAP32[$68>>2]|0;
                        $70 = ($69|0)==($65|0);
                        if ($70) {
                            $71 = 1 << $63;
                            $72 = $71 ^ -1;
                            $73 = $8 & $72;
                            HEAP32[638] = $73;
                            $90 = $73;
                        } else {
                            $74 = ((($69)) + 12|0);
                            HEAP32[$74>>2] = $65;
                            HEAP32[$66>>2] = $69;
                            $90 = $8;
                        }
                        $75 = $63 << 3;
                        $76 = (($75) - ($6))|0;
                        $77 = $6 | 3;
                        $78 = ((($67)) + 4|0);
                        HEAP32[$78>>2] = $77;
                        $79 = (($67) + ($6)|0);
                        $80 = $76 | 1;
                        $81 = ((($79)) + 4|0);
                        HEAP32[$81>>2] = $80;
                        $82 = (($67) + ($75)|0);
                        HEAP32[$82>>2] = $76;
                        $83 = ($33|0)==(0);
                        if (!($83)) {
                            $84 = HEAP32[(2572)>>2]|0;
                            $85 = $33 >>> 3;
                            $86 = $85 << 1;
                            $87 = (2592 + ($86<<2)|0);
                            $88 = 1 << $85;
                            $89 = $90 & $88;
                            $91 = ($89|0)==(0);
                            if ($91) {
                                $92 = $90 | $88;
                                HEAP32[638] = $92;
                                $$pre = ((($87)) + 8|0);
                                $$0194 = $87;$$pre$phiZ2D = $$pre;
                            } else {
                                $93 = ((($87)) + 8|0);
                                $94 = HEAP32[$93>>2]|0;
                                $$0194 = $94;$$pre$phiZ2D = $93;
                            }
                            HEAP32[$$pre$phiZ2D>>2] = $84;
                            $95 = ((($$0194)) + 12|0);
                            HEAP32[$95>>2] = $84;
                            $96 = ((($84)) + 8|0);
                            HEAP32[$96>>2] = $$0194;
                            $97 = ((($84)) + 12|0);
                            HEAP32[$97>>2] = $87;
                        }
                        HEAP32[(2560)>>2] = $76;
                        HEAP32[(2572)>>2] = $79;
                        $$0 = $68;
                        STACKTOP = sp;return ($$0|0);
                    }
                    $98 = HEAP32[(2556)>>2]|0;
                    $99 = ($98|0)==(0);
                    if ($99) {
                        $$0192 = $6;
                    } else {
                        $100 = (0 - ($98))|0;
                        $101 = $98 & $100;
                        $102 = (($101) + -1)|0;
                        $103 = $102 >>> 12;
                        $104 = $103 & 16;
                        $105 = $102 >>> $104;
                        $106 = $105 >>> 5;
                        $107 = $106 & 8;
                        $108 = $107 | $104;
                        $109 = $105 >>> $107;
                        $110 = $109 >>> 2;
                        $111 = $110 & 4;
                        $112 = $108 | $111;
                        $113 = $109 >>> $111;
                        $114 = $113 >>> 1;
                        $115 = $114 & 2;
                        $116 = $112 | $115;
                        $117 = $113 >>> $115;
                        $118 = $117 >>> 1;
                        $119 = $118 & 1;
                        $120 = $116 | $119;
                        $121 = $117 >>> $119;
                        $122 = (($120) + ($121))|0;
                        $123 = (2856 + ($122<<2)|0);
                        $124 = HEAP32[$123>>2]|0;
                        $125 = ((($124)) + 4|0);
                        $126 = HEAP32[$125>>2]|0;
                        $127 = $126 & -8;
                        $128 = (($127) - ($6))|0;
                        $129 = ((($124)) + 16|0);
                        $130 = HEAP32[$129>>2]|0;
                        $131 = ($130|0)==(0|0);
                        $$sink12$i = $131&1;
                        $132 = (((($124)) + 16|0) + ($$sink12$i<<2)|0);
                        $133 = HEAP32[$132>>2]|0;
                        $134 = ($133|0)==(0|0);
                        if ($134) {
                            $$0172$lcssa$i = $124;$$0173$lcssa$i = $128;
                        } else {
                            $$01724$i = $124;$$01733$i = $128;$136 = $133;
                            while(1) {
                                $135 = ((($136)) + 4|0);
                                $137 = HEAP32[$135>>2]|0;
                                $138 = $137 & -8;
                                $139 = (($138) - ($6))|0;
                                $140 = ($139>>>0)<($$01733$i>>>0);
                                $$$0173$i = $140 ? $139 : $$01733$i;
                                $$$0172$i = $140 ? $136 : $$01724$i;
                                $141 = ((($136)) + 16|0);
                                $142 = HEAP32[$141>>2]|0;
                                $143 = ($142|0)==(0|0);
                                $$sink1$i = $143&1;
                                $144 = (((($136)) + 16|0) + ($$sink1$i<<2)|0);
                                $145 = HEAP32[$144>>2]|0;
                                $146 = ($145|0)==(0|0);
                                if ($146) {
                                    $$0172$lcssa$i = $$$0172$i;$$0173$lcssa$i = $$$0173$i;
                                    break;
                                } else {
                                    $$01724$i = $$$0172$i;$$01733$i = $$$0173$i;$136 = $145;
                                }
                            }
                        }
                        $147 = (($$0172$lcssa$i) + ($6)|0);
                        $148 = ($147>>>0)>($$0172$lcssa$i>>>0);
                        if ($148) {
                            $149 = ((($$0172$lcssa$i)) + 24|0);
                            $150 = HEAP32[$149>>2]|0;
                            $151 = ((($$0172$lcssa$i)) + 12|0);
                            $152 = HEAP32[$151>>2]|0;
                            $153 = ($152|0)==($$0172$lcssa$i|0);
                            do {
                                if ($153) {
                                    $158 = ((($$0172$lcssa$i)) + 20|0);
                                    $159 = HEAP32[$158>>2]|0;
                                    $160 = ($159|0)==(0|0);
                                    if ($160) {
                                        $161 = ((($$0172$lcssa$i)) + 16|0);
                                        $162 = HEAP32[$161>>2]|0;
                                        $163 = ($162|0)==(0|0);
                                        if ($163) {
                                            $$3$i = 0;
                                            break;
                                        } else {
                                            $$1176$i = $162;$$1178$i = $161;
                                        }
                                    } else {
                                        $$1176$i = $159;$$1178$i = $158;
                                    }
                                    while(1) {
                                        $164 = ((($$1176$i)) + 20|0);
                                        $165 = HEAP32[$164>>2]|0;
                                        $166 = ($165|0)==(0|0);
                                        if (!($166)) {
                                            $$1176$i = $165;$$1178$i = $164;
                                            continue;
                                        }
                                        $167 = ((($$1176$i)) + 16|0);
                                        $168 = HEAP32[$167>>2]|0;
                                        $169 = ($168|0)==(0|0);
                                        if ($169) {
                                            break;
                                        } else {
                                            $$1176$i = $168;$$1178$i = $167;
                                        }
                                    }
                                    HEAP32[$$1178$i>>2] = 0;
                                    $$3$i = $$1176$i;
                                } else {
                                    $154 = ((($$0172$lcssa$i)) + 8|0);
                                    $155 = HEAP32[$154>>2]|0;
                                    $156 = ((($155)) + 12|0);
                                    HEAP32[$156>>2] = $152;
                                    $157 = ((($152)) + 8|0);
                                    HEAP32[$157>>2] = $155;
                                    $$3$i = $152;
                                }
                            } while(0);
                            $170 = ($150|0)==(0|0);
                            do {
                                if (!($170)) {
                                    $171 = ((($$0172$lcssa$i)) + 28|0);
                                    $172 = HEAP32[$171>>2]|0;
                                    $173 = (2856 + ($172<<2)|0);
                                    $174 = HEAP32[$173>>2]|0;
                                    $175 = ($$0172$lcssa$i|0)==($174|0);
                                    if ($175) {
                                        HEAP32[$173>>2] = $$3$i;
                                        $cond$i = ($$3$i|0)==(0|0);
                                        if ($cond$i) {
                                            $176 = 1 << $172;
                                            $177 = $176 ^ -1;
                                            $178 = $98 & $177;
                                            HEAP32[(2556)>>2] = $178;
                                            break;
                                        }
                                    } else {
                                        $179 = ((($150)) + 16|0);
                                        $180 = HEAP32[$179>>2]|0;
                                        $181 = ($180|0)!=($$0172$lcssa$i|0);
                                        $$sink2$i = $181&1;
                                        $182 = (((($150)) + 16|0) + ($$sink2$i<<2)|0);
                                        HEAP32[$182>>2] = $$3$i;
                                        $183 = ($$3$i|0)==(0|0);
                                        if ($183) {
                                            break;
                                        }
                                    }
                                    $184 = ((($$3$i)) + 24|0);
                                    HEAP32[$184>>2] = $150;
                                    $185 = ((($$0172$lcssa$i)) + 16|0);
                                    $186 = HEAP32[$185>>2]|0;
                                    $187 = ($186|0)==(0|0);
                                    if (!($187)) {
                                        $188 = ((($$3$i)) + 16|0);
                                        HEAP32[$188>>2] = $186;
                                        $189 = ((($186)) + 24|0);
                                        HEAP32[$189>>2] = $$3$i;
                                    }
                                    $190 = ((($$0172$lcssa$i)) + 20|0);
                                    $191 = HEAP32[$190>>2]|0;
                                    $192 = ($191|0)==(0|0);
                                    if (!($192)) {
                                        $193 = ((($$3$i)) + 20|0);
                                        HEAP32[$193>>2] = $191;
                                        $194 = ((($191)) + 24|0);
                                        HEAP32[$194>>2] = $$3$i;
                                    }
                                }
                            } while(0);
                            $195 = ($$0173$lcssa$i>>>0)<(16);
                            if ($195) {
                                $196 = (($$0173$lcssa$i) + ($6))|0;
                                $197 = $196 | 3;
                                $198 = ((($$0172$lcssa$i)) + 4|0);
                                HEAP32[$198>>2] = $197;
                                $199 = (($$0172$lcssa$i) + ($196)|0);
                                $200 = ((($199)) + 4|0);
                                $201 = HEAP32[$200>>2]|0;
                                $202 = $201 | 1;
                                HEAP32[$200>>2] = $202;
                            } else {
                                $203 = $6 | 3;
                                $204 = ((($$0172$lcssa$i)) + 4|0);
                                HEAP32[$204>>2] = $203;
                                $205 = $$0173$lcssa$i | 1;
                                $206 = ((($147)) + 4|0);
                                HEAP32[$206>>2] = $205;
                                $207 = (($147) + ($$0173$lcssa$i)|0);
                                HEAP32[$207>>2] = $$0173$lcssa$i;
                                $208 = ($33|0)==(0);
                                if (!($208)) {
                                    $209 = HEAP32[(2572)>>2]|0;
                                    $210 = $33 >>> 3;
                                    $211 = $210 << 1;
                                    $212 = (2592 + ($211<<2)|0);
                                    $213 = 1 << $210;
                                    $214 = $8 & $213;
                                    $215 = ($214|0)==(0);
                                    if ($215) {
                                        $216 = $8 | $213;
                                        HEAP32[638] = $216;
                                        $$pre$i = ((($212)) + 8|0);
                                        $$0$i = $212;$$pre$phi$iZ2D = $$pre$i;
                                    } else {
                                        $217 = ((($212)) + 8|0);
                                        $218 = HEAP32[$217>>2]|0;
                                        $$0$i = $218;$$pre$phi$iZ2D = $217;
                                    }
                                    HEAP32[$$pre$phi$iZ2D>>2] = $209;
                                    $219 = ((($$0$i)) + 12|0);
                                    HEAP32[$219>>2] = $209;
                                    $220 = ((($209)) + 8|0);
                                    HEAP32[$220>>2] = $$0$i;
                                    $221 = ((($209)) + 12|0);
                                    HEAP32[$221>>2] = $212;
                                }
                                HEAP32[(2560)>>2] = $$0173$lcssa$i;
                                HEAP32[(2572)>>2] = $147;
                            }
                            $222 = ((($$0172$lcssa$i)) + 8|0);
                            $$0 = $222;
                            STACKTOP = sp;return ($$0|0);
                        } else {
                            $$0192 = $6;
                        }
                    }
                } else {
                    $$0192 = $6;
                }
            } else {
                $223 = ($0>>>0)>(4294967231);
                if ($223) {
                    $$0192 = -1;
                } else {
                    $224 = (($0) + 11)|0;
                    $225 = $224 & -8;
                    $226 = HEAP32[(2556)>>2]|0;
                    $227 = ($226|0)==(0);
                    if ($227) {
                        $$0192 = $225;
                    } else {
                        $228 = (0 - ($225))|0;
                        $229 = $224 >>> 8;
                        $230 = ($229|0)==(0);
                        if ($230) {
                            $$0336$i = 0;
                        } else {
                            $231 = ($225>>>0)>(16777215);
                            if ($231) {
                                $$0336$i = 31;
                            } else {
                                $232 = (($229) + 1048320)|0;
                                $233 = $232 >>> 16;
                                $234 = $233 & 8;
                                $235 = $229 << $234;
                                $236 = (($235) + 520192)|0;
                                $237 = $236 >>> 16;
                                $238 = $237 & 4;
                                $239 = $238 | $234;
                                $240 = $235 << $238;
                                $241 = (($240) + 245760)|0;
                                $242 = $241 >>> 16;
                                $243 = $242 & 2;
                                $244 = $239 | $243;
                                $245 = (14 - ($244))|0;
                                $246 = $240 << $243;
                                $247 = $246 >>> 15;
                                $248 = (($245) + ($247))|0;
                                $249 = $248 << 1;
                                $250 = (($248) + 7)|0;
                                $251 = $225 >>> $250;
                                $252 = $251 & 1;
                                $253 = $252 | $249;
                                $$0336$i = $253;
                            }
                        }
                        $254 = (2856 + ($$0336$i<<2)|0);
                        $255 = HEAP32[$254>>2]|0;
                        $256 = ($255|0)==(0|0);
                        L74: do {
                            if ($256) {
                                $$2333$i = 0;$$3$i199 = 0;$$3328$i = $228;
                                label = 57;
                            } else {
                                $257 = ($$0336$i|0)==(31);
                                $258 = $$0336$i >>> 1;
                                $259 = (25 - ($258))|0;
                                $260 = $257 ? 0 : $259;
                                $261 = $225 << $260;
                                $$0320$i = 0;$$0325$i = $228;$$0331$i = $255;$$0337$i = $261;$$0340$i = 0;
                                while(1) {
                                    $262 = ((($$0331$i)) + 4|0);
                                    $263 = HEAP32[$262>>2]|0;
                                    $264 = $263 & -8;
                                    $265 = (($264) - ($225))|0;
                                    $266 = ($265>>>0)<($$0325$i>>>0);
                                    if ($266) {
                                        $267 = ($265|0)==(0);
                                        if ($267) {
                                            $$43298$i = 0;$$43357$i = $$0331$i;$$49$i = $$0331$i;
                                            label = 61;
                                            break L74;
                                        } else {
                                            $$1321$i = $$0331$i;$$1326$i = $265;
                                        }
                                    } else {
                                        $$1321$i = $$0320$i;$$1326$i = $$0325$i;
                                    }
                                    $268 = ((($$0331$i)) + 20|0);
                                    $269 = HEAP32[$268>>2]|0;
                                    $270 = $$0337$i >>> 31;
                                    $271 = (((($$0331$i)) + 16|0) + ($270<<2)|0);
                                    $272 = HEAP32[$271>>2]|0;
                                    $273 = ($269|0)==(0|0);
                                    $274 = ($269|0)==($272|0);
                                    $or$cond1$i198 = $273 | $274;
                                    $$1341$i = $or$cond1$i198 ? $$0340$i : $269;
                                    $275 = ($272|0)==(0|0);
                                    $not$3$i = $275 ^ 1;
                                    $276 = $not$3$i&1;
                                    $$0337$$i = $$0337$i << $276;
                                    if ($275) {
                                        $$2333$i = $$1341$i;$$3$i199 = $$1321$i;$$3328$i = $$1326$i;
                                        label = 57;
                                        break;
                                    } else {
                                        $$0320$i = $$1321$i;$$0325$i = $$1326$i;$$0331$i = $272;$$0337$i = $$0337$$i;$$0340$i = $$1341$i;
                                    }
                                }
                            }
                        } while(0);
                        if ((label|0) == 57) {
                            $277 = ($$2333$i|0)==(0|0);
                            $278 = ($$3$i199|0)==(0|0);
                            $or$cond$i200 = $277 & $278;
                            if ($or$cond$i200) {
                                $279 = 2 << $$0336$i;
                                $280 = (0 - ($279))|0;
                                $281 = $279 | $280;
                                $282 = $226 & $281;
                                $283 = ($282|0)==(0);
                                if ($283) {
                                    $$0192 = $225;
                                    break;
                                }
                                $284 = (0 - ($282))|0;
                                $285 = $282 & $284;
                                $286 = (($285) + -1)|0;
                                $287 = $286 >>> 12;
                                $288 = $287 & 16;
                                $289 = $286 >>> $288;
                                $290 = $289 >>> 5;
                                $291 = $290 & 8;
                                $292 = $291 | $288;
                                $293 = $289 >>> $291;
                                $294 = $293 >>> 2;
                                $295 = $294 & 4;
                                $296 = $292 | $295;
                                $297 = $293 >>> $295;
                                $298 = $297 >>> 1;
                                $299 = $298 & 2;
                                $300 = $296 | $299;
                                $301 = $297 >>> $299;
                                $302 = $301 >>> 1;
                                $303 = $302 & 1;
                                $304 = $300 | $303;
                                $305 = $301 >>> $303;
                                $306 = (($304) + ($305))|0;
                                $307 = (2856 + ($306<<2)|0);
                                $308 = HEAP32[$307>>2]|0;
                                $$4$ph$i = 0;$$4335$ph$i = $308;
                            } else {
                                $$4$ph$i = $$3$i199;$$4335$ph$i = $$2333$i;
                            }
                            $309 = ($$4335$ph$i|0)==(0|0);
                            if ($309) {
                                $$4$lcssa$i = $$4$ph$i;$$4329$lcssa$i = $$3328$i;
                            } else {
                                $$43298$i = $$3328$i;$$43357$i = $$4335$ph$i;$$49$i = $$4$ph$i;
                                label = 61;
                            }
                        }
                        if ((label|0) == 61) {
                            while(1) {
                                label = 0;
                                $310 = ((($$43357$i)) + 4|0);
                                $311 = HEAP32[$310>>2]|0;
                                $312 = $311 & -8;
                                $313 = (($312) - ($225))|0;
                                $314 = ($313>>>0)<($$43298$i>>>0);
                                $$$4329$i = $314 ? $313 : $$43298$i;
                                $$4335$$4$i = $314 ? $$43357$i : $$49$i;
                                $315 = ((($$43357$i)) + 16|0);
                                $316 = HEAP32[$315>>2]|0;
                                $317 = ($316|0)==(0|0);
                                $$sink2$i202 = $317&1;
                                $318 = (((($$43357$i)) + 16|0) + ($$sink2$i202<<2)|0);
                                $319 = HEAP32[$318>>2]|0;
                                $320 = ($319|0)==(0|0);
                                if ($320) {
                                    $$4$lcssa$i = $$4335$$4$i;$$4329$lcssa$i = $$$4329$i;
                                    break;
                                } else {
                                    $$43298$i = $$$4329$i;$$43357$i = $319;$$49$i = $$4335$$4$i;
                                    label = 61;
                                }
                            }
                        }
                        $321 = ($$4$lcssa$i|0)==(0|0);
                        if ($321) {
                            $$0192 = $225;
                        } else {
                            $322 = HEAP32[(2560)>>2]|0;
                            $323 = (($322) - ($225))|0;
                            $324 = ($$4329$lcssa$i>>>0)<($323>>>0);
                            if ($324) {
                                $325 = (($$4$lcssa$i) + ($225)|0);
                                $326 = ($325>>>0)>($$4$lcssa$i>>>0);
                                if (!($326)) {
                                    $$0 = 0;
                                    STACKTOP = sp;return ($$0|0);
                                }
                                $327 = ((($$4$lcssa$i)) + 24|0);
                                $328 = HEAP32[$327>>2]|0;
                                $329 = ((($$4$lcssa$i)) + 12|0);
                                $330 = HEAP32[$329>>2]|0;
                                $331 = ($330|0)==($$4$lcssa$i|0);
                                do {
                                    if ($331) {
                                        $336 = ((($$4$lcssa$i)) + 20|0);
                                        $337 = HEAP32[$336>>2]|0;
                                        $338 = ($337|0)==(0|0);
                                        if ($338) {
                                            $339 = ((($$4$lcssa$i)) + 16|0);
                                            $340 = HEAP32[$339>>2]|0;
                                            $341 = ($340|0)==(0|0);
                                            if ($341) {
                                                $$3349$i = 0;
                                                break;
                                            } else {
                                                $$1347$i = $340;$$1351$i = $339;
                                            }
                                        } else {
                                            $$1347$i = $337;$$1351$i = $336;
                                        }
                                        while(1) {
                                            $342 = ((($$1347$i)) + 20|0);
                                            $343 = HEAP32[$342>>2]|0;
                                            $344 = ($343|0)==(0|0);
                                            if (!($344)) {
                                                $$1347$i = $343;$$1351$i = $342;
                                                continue;
                                            }
                                            $345 = ((($$1347$i)) + 16|0);
                                            $346 = HEAP32[$345>>2]|0;
                                            $347 = ($346|0)==(0|0);
                                            if ($347) {
                                                break;
                                            } else {
                                                $$1347$i = $346;$$1351$i = $345;
                                            }
                                        }
                                        HEAP32[$$1351$i>>2] = 0;
                                        $$3349$i = $$1347$i;
                                    } else {
                                        $332 = ((($$4$lcssa$i)) + 8|0);
                                        $333 = HEAP32[$332>>2]|0;
                                        $334 = ((($333)) + 12|0);
                                        HEAP32[$334>>2] = $330;
                                        $335 = ((($330)) + 8|0);
                                        HEAP32[$335>>2] = $333;
                                        $$3349$i = $330;
                                    }
                                } while(0);
                                $348 = ($328|0)==(0|0);
                                do {
                                    if ($348) {
                                        $431 = $226;
                                    } else {
                                        $349 = ((($$4$lcssa$i)) + 28|0);
                                        $350 = HEAP32[$349>>2]|0;
                                        $351 = (2856 + ($350<<2)|0);
                                        $352 = HEAP32[$351>>2]|0;
                                        $353 = ($$4$lcssa$i|0)==($352|0);
                                        if ($353) {
                                            HEAP32[$351>>2] = $$3349$i;
                                            $cond$i206 = ($$3349$i|0)==(0|0);
                                            if ($cond$i206) {
                                                $354 = 1 << $350;
                                                $355 = $354 ^ -1;
                                                $356 = $226 & $355;
                                                HEAP32[(2556)>>2] = $356;
                                                $431 = $356;
                                                break;
                                            }
                                        } else {
                                            $357 = ((($328)) + 16|0);
                                            $358 = HEAP32[$357>>2]|0;
                                            $359 = ($358|0)!=($$4$lcssa$i|0);
                                            $$sink3$i = $359&1;
                                            $360 = (((($328)) + 16|0) + ($$sink3$i<<2)|0);
                                            HEAP32[$360>>2] = $$3349$i;
                                            $361 = ($$3349$i|0)==(0|0);
                                            if ($361) {
                                                $431 = $226;
                                                break;
                                            }
                                        }
                                        $362 = ((($$3349$i)) + 24|0);
                                        HEAP32[$362>>2] = $328;
                                        $363 = ((($$4$lcssa$i)) + 16|0);
                                        $364 = HEAP32[$363>>2]|0;
                                        $365 = ($364|0)==(0|0);
                                        if (!($365)) {
                                            $366 = ((($$3349$i)) + 16|0);
                                            HEAP32[$366>>2] = $364;
                                            $367 = ((($364)) + 24|0);
                                            HEAP32[$367>>2] = $$3349$i;
                                        }
                                        $368 = ((($$4$lcssa$i)) + 20|0);
                                        $369 = HEAP32[$368>>2]|0;
                                        $370 = ($369|0)==(0|0);
                                        if ($370) {
                                            $431 = $226;
                                        } else {
                                            $371 = ((($$3349$i)) + 20|0);
                                            HEAP32[$371>>2] = $369;
                                            $372 = ((($369)) + 24|0);
                                            HEAP32[$372>>2] = $$3349$i;
                                            $431 = $226;
                                        }
                                    }
                                } while(0);
                                $373 = ($$4329$lcssa$i>>>0)<(16);
                                do {
                                    if ($373) {
                                        $374 = (($$4329$lcssa$i) + ($225))|0;
                                        $375 = $374 | 3;
                                        $376 = ((($$4$lcssa$i)) + 4|0);
                                        HEAP32[$376>>2] = $375;
                                        $377 = (($$4$lcssa$i) + ($374)|0);
                                        $378 = ((($377)) + 4|0);
                                        $379 = HEAP32[$378>>2]|0;
                                        $380 = $379 | 1;
                                        HEAP32[$378>>2] = $380;
                                    } else {
                                        $381 = $225 | 3;
                                        $382 = ((($$4$lcssa$i)) + 4|0);
                                        HEAP32[$382>>2] = $381;
                                        $383 = $$4329$lcssa$i | 1;
                                        $384 = ((($325)) + 4|0);
                                        HEAP32[$384>>2] = $383;
                                        $385 = (($325) + ($$4329$lcssa$i)|0);
                                        HEAP32[$385>>2] = $$4329$lcssa$i;
                                        $386 = $$4329$lcssa$i >>> 3;
                                        $387 = ($$4329$lcssa$i>>>0)<(256);
                                        if ($387) {
                                            $388 = $386 << 1;
                                            $389 = (2592 + ($388<<2)|0);
                                            $390 = HEAP32[638]|0;
                                            $391 = 1 << $386;
                                            $392 = $390 & $391;
                                            $393 = ($392|0)==(0);
                                            if ($393) {
                                                $394 = $390 | $391;
                                                HEAP32[638] = $394;
                                                $$pre$i207 = ((($389)) + 8|0);
                                                $$0345$i = $389;$$pre$phi$i208Z2D = $$pre$i207;
                                            } else {
                                                $395 = ((($389)) + 8|0);
                                                $396 = HEAP32[$395>>2]|0;
                                                $$0345$i = $396;$$pre$phi$i208Z2D = $395;
                                            }
                                            HEAP32[$$pre$phi$i208Z2D>>2] = $325;
                                            $397 = ((($$0345$i)) + 12|0);
                                            HEAP32[$397>>2] = $325;
                                            $398 = ((($325)) + 8|0);
                                            HEAP32[$398>>2] = $$0345$i;
                                            $399 = ((($325)) + 12|0);
                                            HEAP32[$399>>2] = $389;
                                            break;
                                        }
                                        $400 = $$4329$lcssa$i >>> 8;
                                        $401 = ($400|0)==(0);
                                        if ($401) {
                                            $$0339$i = 0;
                                        } else {
                                            $402 = ($$4329$lcssa$i>>>0)>(16777215);
                                            if ($402) {
                                                $$0339$i = 31;
                                            } else {
                                                $403 = (($400) + 1048320)|0;
                                                $404 = $403 >>> 16;
                                                $405 = $404 & 8;
                                                $406 = $400 << $405;
                                                $407 = (($406) + 520192)|0;
                                                $408 = $407 >>> 16;
                                                $409 = $408 & 4;
                                                $410 = $409 | $405;
                                                $411 = $406 << $409;
                                                $412 = (($411) + 245760)|0;
                                                $413 = $412 >>> 16;
                                                $414 = $413 & 2;
                                                $415 = $410 | $414;
                                                $416 = (14 - ($415))|0;
                                                $417 = $411 << $414;
                                                $418 = $417 >>> 15;
                                                $419 = (($416) + ($418))|0;
                                                $420 = $419 << 1;
                                                $421 = (($419) + 7)|0;
                                                $422 = $$4329$lcssa$i >>> $421;
                                                $423 = $422 & 1;
                                                $424 = $423 | $420;
                                                $$0339$i = $424;
                                            }
                                        }
                                        $425 = (2856 + ($$0339$i<<2)|0);
                                        $426 = ((($325)) + 28|0);
                                        HEAP32[$426>>2] = $$0339$i;
                                        $427 = ((($325)) + 16|0);
                                        $428 = ((($427)) + 4|0);
                                        HEAP32[$428>>2] = 0;
                                        HEAP32[$427>>2] = 0;
                                        $429 = 1 << $$0339$i;
                                        $430 = $431 & $429;
                                        $432 = ($430|0)==(0);
                                        if ($432) {
                                            $433 = $431 | $429;
                                            HEAP32[(2556)>>2] = $433;
                                            HEAP32[$425>>2] = $325;
                                            $434 = ((($325)) + 24|0);
                                            HEAP32[$434>>2] = $425;
                                            $435 = ((($325)) + 12|0);
                                            HEAP32[$435>>2] = $325;
                                            $436 = ((($325)) + 8|0);
                                            HEAP32[$436>>2] = $325;
                                            break;
                                        }
                                        $437 = HEAP32[$425>>2]|0;
                                        $438 = ($$0339$i|0)==(31);
                                        $439 = $$0339$i >>> 1;
                                        $440 = (25 - ($439))|0;
                                        $441 = $438 ? 0 : $440;
                                        $442 = $$4329$lcssa$i << $441;
                                        $$0322$i = $442;$$0323$i = $437;
                                        while(1) {
                                            $443 = ((($$0323$i)) + 4|0);
                                            $444 = HEAP32[$443>>2]|0;
                                            $445 = $444 & -8;
                                            $446 = ($445|0)==($$4329$lcssa$i|0);
                                            if ($446) {
                                                label = 97;
                                                break;
                                            }
                                            $447 = $$0322$i >>> 31;
                                            $448 = (((($$0323$i)) + 16|0) + ($447<<2)|0);
                                            $449 = $$0322$i << 1;
                                            $450 = HEAP32[$448>>2]|0;
                                            $451 = ($450|0)==(0|0);
                                            if ($451) {
                                                label = 96;
                                                break;
                                            } else {
                                                $$0322$i = $449;$$0323$i = $450;
                                            }
                                        }
                                        if ((label|0) == 96) {
                                            HEAP32[$448>>2] = $325;
                                            $452 = ((($325)) + 24|0);
                                            HEAP32[$452>>2] = $$0323$i;
                                            $453 = ((($325)) + 12|0);
                                            HEAP32[$453>>2] = $325;
                                            $454 = ((($325)) + 8|0);
                                            HEAP32[$454>>2] = $325;
                                            break;
                                        }
                                        else if ((label|0) == 97) {
                                            $455 = ((($$0323$i)) + 8|0);
                                            $456 = HEAP32[$455>>2]|0;
                                            $457 = ((($456)) + 12|0);
                                            HEAP32[$457>>2] = $325;
                                            HEAP32[$455>>2] = $325;
                                            $458 = ((($325)) + 8|0);
                                            HEAP32[$458>>2] = $456;
                                            $459 = ((($325)) + 12|0);
                                            HEAP32[$459>>2] = $$0323$i;
                                            $460 = ((($325)) + 24|0);
                                            HEAP32[$460>>2] = 0;
                                            break;
                                        }
                                    }
                                } while(0);
                                $461 = ((($$4$lcssa$i)) + 8|0);
                                $$0 = $461;
                                STACKTOP = sp;return ($$0|0);
                            } else {
                                $$0192 = $225;
                            }
                        }
                    }
                }
            }
        } while(0);
        $462 = HEAP32[(2560)>>2]|0;
        $463 = ($462>>>0)<($$0192>>>0);
        if (!($463)) {
            $464 = (($462) - ($$0192))|0;
            $465 = HEAP32[(2572)>>2]|0;
            $466 = ($464>>>0)>(15);
            if ($466) {
                $467 = (($465) + ($$0192)|0);
                HEAP32[(2572)>>2] = $467;
                HEAP32[(2560)>>2] = $464;
                $468 = $464 | 1;
                $469 = ((($467)) + 4|0);
                HEAP32[$469>>2] = $468;
                $470 = (($465) + ($462)|0);
                HEAP32[$470>>2] = $464;
                $471 = $$0192 | 3;
                $472 = ((($465)) + 4|0);
                HEAP32[$472>>2] = $471;
            } else {
                HEAP32[(2560)>>2] = 0;
                HEAP32[(2572)>>2] = 0;
                $473 = $462 | 3;
                $474 = ((($465)) + 4|0);
                HEAP32[$474>>2] = $473;
                $475 = (($465) + ($462)|0);
                $476 = ((($475)) + 4|0);
                $477 = HEAP32[$476>>2]|0;
                $478 = $477 | 1;
                HEAP32[$476>>2] = $478;
            }
            $479 = ((($465)) + 8|0);
            $$0 = $479;
            STACKTOP = sp;return ($$0|0);
        }
        $480 = HEAP32[(2564)>>2]|0;
        $481 = ($480>>>0)>($$0192>>>0);
        if ($481) {
            $482 = (($480) - ($$0192))|0;
            HEAP32[(2564)>>2] = $482;
            $483 = HEAP32[(2576)>>2]|0;
            $484 = (($483) + ($$0192)|0);
            HEAP32[(2576)>>2] = $484;
            $485 = $482 | 1;
            $486 = ((($484)) + 4|0);
            HEAP32[$486>>2] = $485;
            $487 = $$0192 | 3;
            $488 = ((($483)) + 4|0);
            HEAP32[$488>>2] = $487;
            $489 = ((($483)) + 8|0);
            $$0 = $489;
            STACKTOP = sp;return ($$0|0);
        }
        $490 = HEAP32[756]|0;
        $491 = ($490|0)==(0);
        if ($491) {
            HEAP32[(3032)>>2] = 4096;
            HEAP32[(3028)>>2] = 4096;
            HEAP32[(3036)>>2] = -1;
            HEAP32[(3040)>>2] = -1;
            HEAP32[(3044)>>2] = 0;
            HEAP32[(2996)>>2] = 0;
            $492 = $1;
            $493 = $492 & -16;
            $494 = $493 ^ 1431655768;
            HEAP32[756] = $494;
            $498 = 4096;
        } else {
            $$pre$i195 = HEAP32[(3032)>>2]|0;
            $498 = $$pre$i195;
        }
        $495 = (($$0192) + 48)|0;
        $496 = (($$0192) + 47)|0;
        $497 = (($498) + ($496))|0;
        $499 = (0 - ($498))|0;
        $500 = $497 & $499;
        $501 = ($500>>>0)>($$0192>>>0);
        if (!($501)) {
            $$0 = 0;
            STACKTOP = sp;return ($$0|0);
        }
        $502 = HEAP32[(2992)>>2]|0;
        $503 = ($502|0)==(0);
        if (!($503)) {
            $504 = HEAP32[(2984)>>2]|0;
            $505 = (($504) + ($500))|0;
            $506 = ($505>>>0)<=($504>>>0);
            $507 = ($505>>>0)>($502>>>0);
            $or$cond1$i = $506 | $507;
            if ($or$cond1$i) {
                $$0 = 0;
                STACKTOP = sp;return ($$0|0);
            }
        }
        $508 = HEAP32[(2996)>>2]|0;
        $509 = $508 & 4;
        $510 = ($509|0)==(0);
        L167: do {
            if ($510) {
                $511 = HEAP32[(2576)>>2]|0;
                $512 = ($511|0)==(0|0);
                L169: do {
                    if ($512) {
                        label = 118;
                    } else {
                        $$0$i20$i = (3000);
                        while(1) {
                            $513 = HEAP32[$$0$i20$i>>2]|0;
                            $514 = ($513>>>0)>($511>>>0);
                            if (!($514)) {
                                $515 = ((($$0$i20$i)) + 4|0);
                                $516 = HEAP32[$515>>2]|0;
                                $517 = (($513) + ($516)|0);
                                $518 = ($517>>>0)>($511>>>0);
                                if ($518) {
                                    break;
                                }
                            }
                            $519 = ((($$0$i20$i)) + 8|0);
                            $520 = HEAP32[$519>>2]|0;
                            $521 = ($520|0)==(0|0);
                            if ($521) {
                                label = 118;
                                break L169;
                            } else {
                                $$0$i20$i = $520;
                            }
                        }
                        $544 = (($497) - ($480))|0;
                        $545 = $544 & $499;
                        $546 = ($545>>>0)<(2147483647);
                        if ($546) {
                            $547 = (_sbrk(($545|0))|0);
                            $548 = HEAP32[$$0$i20$i>>2]|0;
                            $549 = HEAP32[$515>>2]|0;
                            $550 = (($548) + ($549)|0);
                            $551 = ($547|0)==($550|0);
                            if ($551) {
                                $552 = ($547|0)==((-1)|0);
                                if ($552) {
                                    $$2234243136$i = $545;
                                } else {
                                    $$723947$i = $545;$$748$i = $547;
                                    label = 135;
                                    break L167;
                                }
                            } else {
                                $$2247$ph$i = $547;$$2253$ph$i = $545;
                                label = 126;
                            }
                        } else {
                            $$2234243136$i = 0;
                        }
                    }
                } while(0);
                do {
                    if ((label|0) == 118) {
                        $522 = (_sbrk(0)|0);
                        $523 = ($522|0)==((-1)|0);
                        if ($523) {
                            $$2234243136$i = 0;
                        } else {
                            $524 = $522;
                            $525 = HEAP32[(3028)>>2]|0;
                            $526 = (($525) + -1)|0;
                            $527 = $526 & $524;
                            $528 = ($527|0)==(0);
                            $529 = (($526) + ($524))|0;
                            $530 = (0 - ($525))|0;
                            $531 = $529 & $530;
                            $532 = (($531) - ($524))|0;
                            $533 = $528 ? 0 : $532;
                            $$$i = (($533) + ($500))|0;
                            $534 = HEAP32[(2984)>>2]|0;
                            $535 = (($$$i) + ($534))|0;
                            $536 = ($$$i>>>0)>($$0192>>>0);
                            $537 = ($$$i>>>0)<(2147483647);
                            $or$cond$i = $536 & $537;
                            if ($or$cond$i) {
                                $538 = HEAP32[(2992)>>2]|0;
                                $539 = ($538|0)==(0);
                                if (!($539)) {
                                    $540 = ($535>>>0)<=($534>>>0);
                                    $541 = ($535>>>0)>($538>>>0);
                                    $or$cond2$i = $540 | $541;
                                    if ($or$cond2$i) {
                                        $$2234243136$i = 0;
                                        break;
                                    }
                                }
                                $542 = (_sbrk(($$$i|0))|0);
                                $543 = ($542|0)==($522|0);
                                if ($543) {
                                    $$723947$i = $$$i;$$748$i = $522;
                                    label = 135;
                                    break L167;
                                } else {
                                    $$2247$ph$i = $542;$$2253$ph$i = $$$i;
                                    label = 126;
                                }
                            } else {
                                $$2234243136$i = 0;
                            }
                        }
                    }
                } while(0);
                do {
                    if ((label|0) == 126) {
                        $553 = (0 - ($$2253$ph$i))|0;
                        $554 = ($$2247$ph$i|0)!=((-1)|0);
                        $555 = ($$2253$ph$i>>>0)<(2147483647);
                        $or$cond7$i = $555 & $554;
                        $556 = ($495>>>0)>($$2253$ph$i>>>0);
                        $or$cond10$i = $556 & $or$cond7$i;
                        if (!($or$cond10$i)) {
                            $566 = ($$2247$ph$i|0)==((-1)|0);
                            if ($566) {
                                $$2234243136$i = 0;
                                break;
                            } else {
                                $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
                                label = 135;
                                break L167;
                            }
                        }
                        $557 = HEAP32[(3032)>>2]|0;
                        $558 = (($496) - ($$2253$ph$i))|0;
                        $559 = (($558) + ($557))|0;
                        $560 = (0 - ($557))|0;
                        $561 = $559 & $560;
                        $562 = ($561>>>0)<(2147483647);
                        if (!($562)) {
                            $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
                            label = 135;
                            break L167;
                        }
                        $563 = (_sbrk(($561|0))|0);
                        $564 = ($563|0)==((-1)|0);
                        if ($564) {
                            (_sbrk(($553|0))|0);
                            $$2234243136$i = 0;
                            break;
                        } else {
                            $565 = (($561) + ($$2253$ph$i))|0;
                            $$723947$i = $565;$$748$i = $$2247$ph$i;
                            label = 135;
                            break L167;
                        }
                    }
                } while(0);
                $567 = HEAP32[(2996)>>2]|0;
                $568 = $567 | 4;
                HEAP32[(2996)>>2] = $568;
                $$4236$i = $$2234243136$i;
                label = 133;
            } else {
                $$4236$i = 0;
                label = 133;
            }
        } while(0);
        if ((label|0) == 133) {
            $569 = ($500>>>0)<(2147483647);
            if ($569) {
                $570 = (_sbrk(($500|0))|0);
                $571 = (_sbrk(0)|0);
                $572 = ($570|0)!=((-1)|0);
                $573 = ($571|0)!=((-1)|0);
                $or$cond5$i = $572 & $573;
                $574 = ($570>>>0)<($571>>>0);
                $or$cond11$i = $574 & $or$cond5$i;
                $575 = $571;
                $576 = $570;
                $577 = (($575) - ($576))|0;
                $578 = (($$0192) + 40)|0;
                $579 = ($577>>>0)>($578>>>0);
                $$$4236$i = $579 ? $577 : $$4236$i;
                $or$cond11$not$i = $or$cond11$i ^ 1;
                $580 = ($570|0)==((-1)|0);
                $not$$i = $579 ^ 1;
                $581 = $580 | $not$$i;
                $or$cond49$i = $581 | $or$cond11$not$i;
                if (!($or$cond49$i)) {
                    $$723947$i = $$$4236$i;$$748$i = $570;
                    label = 135;
                }
            }
        }
        if ((label|0) == 135) {
            $582 = HEAP32[(2984)>>2]|0;
            $583 = (($582) + ($$723947$i))|0;
            HEAP32[(2984)>>2] = $583;
            $584 = HEAP32[(2988)>>2]|0;
            $585 = ($583>>>0)>($584>>>0);
            if ($585) {
                HEAP32[(2988)>>2] = $583;
            }
            $586 = HEAP32[(2576)>>2]|0;
            $587 = ($586|0)==(0|0);
            do {
                if ($587) {
                    $588 = HEAP32[(2568)>>2]|0;
                    $589 = ($588|0)==(0|0);
                    $590 = ($$748$i>>>0)<($588>>>0);
                    $or$cond12$i = $589 | $590;
                    if ($or$cond12$i) {
                        HEAP32[(2568)>>2] = $$748$i;
                    }
                    HEAP32[(3000)>>2] = $$748$i;
                    HEAP32[(3004)>>2] = $$723947$i;
                    HEAP32[(3012)>>2] = 0;
                    $591 = HEAP32[756]|0;
                    HEAP32[(2588)>>2] = $591;
                    HEAP32[(2584)>>2] = -1;
                    HEAP32[(2604)>>2] = (2592);
                    HEAP32[(2600)>>2] = (2592);
                    HEAP32[(2612)>>2] = (2600);
                    HEAP32[(2608)>>2] = (2600);
                    HEAP32[(2620)>>2] = (2608);
                    HEAP32[(2616)>>2] = (2608);
                    HEAP32[(2628)>>2] = (2616);
                    HEAP32[(2624)>>2] = (2616);
                    HEAP32[(2636)>>2] = (2624);
                    HEAP32[(2632)>>2] = (2624);
                    HEAP32[(2644)>>2] = (2632);
                    HEAP32[(2640)>>2] = (2632);
                    HEAP32[(2652)>>2] = (2640);
                    HEAP32[(2648)>>2] = (2640);
                    HEAP32[(2660)>>2] = (2648);
                    HEAP32[(2656)>>2] = (2648);
                    HEAP32[(2668)>>2] = (2656);
                    HEAP32[(2664)>>2] = (2656);
                    HEAP32[(2676)>>2] = (2664);
                    HEAP32[(2672)>>2] = (2664);
                    HEAP32[(2684)>>2] = (2672);
                    HEAP32[(2680)>>2] = (2672);
                    HEAP32[(2692)>>2] = (2680);
                    HEAP32[(2688)>>2] = (2680);
                    HEAP32[(2700)>>2] = (2688);
                    HEAP32[(2696)>>2] = (2688);
                    HEAP32[(2708)>>2] = (2696);
                    HEAP32[(2704)>>2] = (2696);
                    HEAP32[(2716)>>2] = (2704);
                    HEAP32[(2712)>>2] = (2704);
                    HEAP32[(2724)>>2] = (2712);
                    HEAP32[(2720)>>2] = (2712);
                    HEAP32[(2732)>>2] = (2720);
                    HEAP32[(2728)>>2] = (2720);
                    HEAP32[(2740)>>2] = (2728);
                    HEAP32[(2736)>>2] = (2728);
                    HEAP32[(2748)>>2] = (2736);
                    HEAP32[(2744)>>2] = (2736);
                    HEAP32[(2756)>>2] = (2744);
                    HEAP32[(2752)>>2] = (2744);
                    HEAP32[(2764)>>2] = (2752);
                    HEAP32[(2760)>>2] = (2752);
                    HEAP32[(2772)>>2] = (2760);
                    HEAP32[(2768)>>2] = (2760);
                    HEAP32[(2780)>>2] = (2768);
                    HEAP32[(2776)>>2] = (2768);
                    HEAP32[(2788)>>2] = (2776);
                    HEAP32[(2784)>>2] = (2776);
                    HEAP32[(2796)>>2] = (2784);
                    HEAP32[(2792)>>2] = (2784);
                    HEAP32[(2804)>>2] = (2792);
                    HEAP32[(2800)>>2] = (2792);
                    HEAP32[(2812)>>2] = (2800);
                    HEAP32[(2808)>>2] = (2800);
                    HEAP32[(2820)>>2] = (2808);
                    HEAP32[(2816)>>2] = (2808);
                    HEAP32[(2828)>>2] = (2816);
                    HEAP32[(2824)>>2] = (2816);
                    HEAP32[(2836)>>2] = (2824);
                    HEAP32[(2832)>>2] = (2824);
                    HEAP32[(2844)>>2] = (2832);
                    HEAP32[(2840)>>2] = (2832);
                    HEAP32[(2852)>>2] = (2840);
                    HEAP32[(2848)>>2] = (2840);
                    $592 = (($$723947$i) + -40)|0;
                    $593 = ((($$748$i)) + 8|0);
                    $594 = $593;
                    $595 = $594 & 7;
                    $596 = ($595|0)==(0);
                    $597 = (0 - ($594))|0;
                    $598 = $597 & 7;
                    $599 = $596 ? 0 : $598;
                    $600 = (($$748$i) + ($599)|0);
                    $601 = (($592) - ($599))|0;
                    HEAP32[(2576)>>2] = $600;
                    HEAP32[(2564)>>2] = $601;
                    $602 = $601 | 1;
                    $603 = ((($600)) + 4|0);
                    HEAP32[$603>>2] = $602;
                    $604 = (($$748$i) + ($592)|0);
                    $605 = ((($604)) + 4|0);
                    HEAP32[$605>>2] = 40;
                    $606 = HEAP32[(3040)>>2]|0;
                    HEAP32[(2580)>>2] = $606;
                } else {
                    $$024367$i = (3000);
                    while(1) {
                        $607 = HEAP32[$$024367$i>>2]|0;
                        $608 = ((($$024367$i)) + 4|0);
                        $609 = HEAP32[$608>>2]|0;
                        $610 = (($607) + ($609)|0);
                        $611 = ($$748$i|0)==($610|0);
                        if ($611) {
                            label = 143;
                            break;
                        }
                        $612 = ((($$024367$i)) + 8|0);
                        $613 = HEAP32[$612>>2]|0;
                        $614 = ($613|0)==(0|0);
                        if ($614) {
                            break;
                        } else {
                            $$024367$i = $613;
                        }
                    }
                    if ((label|0) == 143) {
                        $615 = ((($$024367$i)) + 12|0);
                        $616 = HEAP32[$615>>2]|0;
                        $617 = $616 & 8;
                        $618 = ($617|0)==(0);
                        if ($618) {
                            $619 = ($607>>>0)<=($586>>>0);
                            $620 = ($$748$i>>>0)>($586>>>0);
                            $or$cond50$i = $620 & $619;
                            if ($or$cond50$i) {
                                $621 = (($609) + ($$723947$i))|0;
                                HEAP32[$608>>2] = $621;
                                $622 = HEAP32[(2564)>>2]|0;
                                $623 = (($622) + ($$723947$i))|0;
                                $624 = ((($586)) + 8|0);
                                $625 = $624;
                                $626 = $625 & 7;
                                $627 = ($626|0)==(0);
                                $628 = (0 - ($625))|0;
                                $629 = $628 & 7;
                                $630 = $627 ? 0 : $629;
                                $631 = (($586) + ($630)|0);
                                $632 = (($623) - ($630))|0;
                                HEAP32[(2576)>>2] = $631;
                                HEAP32[(2564)>>2] = $632;
                                $633 = $632 | 1;
                                $634 = ((($631)) + 4|0);
                                HEAP32[$634>>2] = $633;
                                $635 = (($586) + ($623)|0);
                                $636 = ((($635)) + 4|0);
                                HEAP32[$636>>2] = 40;
                                $637 = HEAP32[(3040)>>2]|0;
                                HEAP32[(2580)>>2] = $637;
                                break;
                            }
                        }
                    }
                    $638 = HEAP32[(2568)>>2]|0;
                    $639 = ($$748$i>>>0)<($638>>>0);
                    if ($639) {
                        HEAP32[(2568)>>2] = $$748$i;
                    }
                    $640 = (($$748$i) + ($$723947$i)|0);
                    $$124466$i = (3000);
                    while(1) {
                        $641 = HEAP32[$$124466$i>>2]|0;
                        $642 = ($641|0)==($640|0);
                        if ($642) {
                            label = 151;
                            break;
                        }
                        $643 = ((($$124466$i)) + 8|0);
                        $644 = HEAP32[$643>>2]|0;
                        $645 = ($644|0)==(0|0);
                        if ($645) {
                            $$0$i$i$i = (3000);
                            break;
                        } else {
                            $$124466$i = $644;
                        }
                    }
                    if ((label|0) == 151) {
                        $646 = ((($$124466$i)) + 12|0);
                        $647 = HEAP32[$646>>2]|0;
                        $648 = $647 & 8;
                        $649 = ($648|0)==(0);
                        if ($649) {
                            HEAP32[$$124466$i>>2] = $$748$i;
                            $650 = ((($$124466$i)) + 4|0);
                            $651 = HEAP32[$650>>2]|0;
                            $652 = (($651) + ($$723947$i))|0;
                            HEAP32[$650>>2] = $652;
                            $653 = ((($$748$i)) + 8|0);
                            $654 = $653;
                            $655 = $654 & 7;
                            $656 = ($655|0)==(0);
                            $657 = (0 - ($654))|0;
                            $658 = $657 & 7;
                            $659 = $656 ? 0 : $658;
                            $660 = (($$748$i) + ($659)|0);
                            $661 = ((($640)) + 8|0);
                            $662 = $661;
                            $663 = $662 & 7;
                            $664 = ($663|0)==(0);
                            $665 = (0 - ($662))|0;
                            $666 = $665 & 7;
                            $667 = $664 ? 0 : $666;
                            $668 = (($640) + ($667)|0);
                            $669 = $668;
                            $670 = $660;
                            $671 = (($669) - ($670))|0;
                            $672 = (($660) + ($$0192)|0);
                            $673 = (($671) - ($$0192))|0;
                            $674 = $$0192 | 3;
                            $675 = ((($660)) + 4|0);
                            HEAP32[$675>>2] = $674;
                            $676 = ($586|0)==($668|0);
                            do {
                                if ($676) {
                                    $677 = HEAP32[(2564)>>2]|0;
                                    $678 = (($677) + ($673))|0;
                                    HEAP32[(2564)>>2] = $678;
                                    HEAP32[(2576)>>2] = $672;
                                    $679 = $678 | 1;
                                    $680 = ((($672)) + 4|0);
                                    HEAP32[$680>>2] = $679;
                                } else {
                                    $681 = HEAP32[(2572)>>2]|0;
                                    $682 = ($681|0)==($668|0);
                                    if ($682) {
                                        $683 = HEAP32[(2560)>>2]|0;
                                        $684 = (($683) + ($673))|0;
                                        HEAP32[(2560)>>2] = $684;
                                        HEAP32[(2572)>>2] = $672;
                                        $685 = $684 | 1;
                                        $686 = ((($672)) + 4|0);
                                        HEAP32[$686>>2] = $685;
                                        $687 = (($672) + ($684)|0);
                                        HEAP32[$687>>2] = $684;
                                        break;
                                    }
                                    $688 = ((($668)) + 4|0);
                                    $689 = HEAP32[$688>>2]|0;
                                    $690 = $689 & 3;
                                    $691 = ($690|0)==(1);
                                    if ($691) {
                                        $692 = $689 & -8;
                                        $693 = $689 >>> 3;
                                        $694 = ($689>>>0)<(256);
                                        L234: do {
                                            if ($694) {
                                                $695 = ((($668)) + 8|0);
                                                $696 = HEAP32[$695>>2]|0;
                                                $697 = ((($668)) + 12|0);
                                                $698 = HEAP32[$697>>2]|0;
                                                $699 = ($698|0)==($696|0);
                                                if ($699) {
                                                    $700 = 1 << $693;
                                                    $701 = $700 ^ -1;
                                                    $702 = HEAP32[638]|0;
                                                    $703 = $702 & $701;
                                                    HEAP32[638] = $703;
                                                    break;
                                                } else {
                                                    $704 = ((($696)) + 12|0);
                                                    HEAP32[$704>>2] = $698;
                                                    $705 = ((($698)) + 8|0);
                                                    HEAP32[$705>>2] = $696;
                                                    break;
                                                }
                                            } else {
                                                $706 = ((($668)) + 24|0);
                                                $707 = HEAP32[$706>>2]|0;
                                                $708 = ((($668)) + 12|0);
                                                $709 = HEAP32[$708>>2]|0;
                                                $710 = ($709|0)==($668|0);
                                                do {
                                                    if ($710) {
                                                        $715 = ((($668)) + 16|0);
                                                        $716 = ((($715)) + 4|0);
                                                        $717 = HEAP32[$716>>2]|0;
                                                        $718 = ($717|0)==(0|0);
                                                        if ($718) {
                                                            $719 = HEAP32[$715>>2]|0;
                                                            $720 = ($719|0)==(0|0);
                                                            if ($720) {
                                                                $$3$i$i = 0;
                                                                break;
                                                            } else {
                                                                $$1264$i$i = $719;$$1266$i$i = $715;
                                                            }
                                                        } else {
                                                            $$1264$i$i = $717;$$1266$i$i = $716;
                                                        }
                                                        while(1) {
                                                            $721 = ((($$1264$i$i)) + 20|0);
                                                            $722 = HEAP32[$721>>2]|0;
                                                            $723 = ($722|0)==(0|0);
                                                            if (!($723)) {
                                                                $$1264$i$i = $722;$$1266$i$i = $721;
                                                                continue;
                                                            }
                                                            $724 = ((($$1264$i$i)) + 16|0);
                                                            $725 = HEAP32[$724>>2]|0;
                                                            $726 = ($725|0)==(0|0);
                                                            if ($726) {
                                                                break;
                                                            } else {
                                                                $$1264$i$i = $725;$$1266$i$i = $724;
                                                            }
                                                        }
                                                        HEAP32[$$1266$i$i>>2] = 0;
                                                        $$3$i$i = $$1264$i$i;
                                                    } else {
                                                        $711 = ((($668)) + 8|0);
                                                        $712 = HEAP32[$711>>2]|0;
                                                        $713 = ((($712)) + 12|0);
                                                        HEAP32[$713>>2] = $709;
                                                        $714 = ((($709)) + 8|0);
                                                        HEAP32[$714>>2] = $712;
                                                        $$3$i$i = $709;
                                                    }
                                                } while(0);
                                                $727 = ($707|0)==(0|0);
                                                if ($727) {
                                                    break;
                                                }
                                                $728 = ((($668)) + 28|0);
                                                $729 = HEAP32[$728>>2]|0;
                                                $730 = (2856 + ($729<<2)|0);
                                                $731 = HEAP32[$730>>2]|0;
                                                $732 = ($731|0)==($668|0);
                                                do {
                                                    if ($732) {
                                                        HEAP32[$730>>2] = $$3$i$i;
                                                        $cond$i$i = ($$3$i$i|0)==(0|0);
                                                        if (!($cond$i$i)) {
                                                            break;
                                                        }
                                                        $733 = 1 << $729;
                                                        $734 = $733 ^ -1;
                                                        $735 = HEAP32[(2556)>>2]|0;
                                                        $736 = $735 & $734;
                                                        HEAP32[(2556)>>2] = $736;
                                                        break L234;
                                                    } else {
                                                        $737 = ((($707)) + 16|0);
                                                        $738 = HEAP32[$737>>2]|0;
                                                        $739 = ($738|0)!=($668|0);
                                                        $$sink1$i$i = $739&1;
                                                        $740 = (((($707)) + 16|0) + ($$sink1$i$i<<2)|0);
                                                        HEAP32[$740>>2] = $$3$i$i;
                                                        $741 = ($$3$i$i|0)==(0|0);
                                                        if ($741) {
                                                            break L234;
                                                        }
                                                    }
                                                } while(0);
                                                $742 = ((($$3$i$i)) + 24|0);
                                                HEAP32[$742>>2] = $707;
                                                $743 = ((($668)) + 16|0);
                                                $744 = HEAP32[$743>>2]|0;
                                                $745 = ($744|0)==(0|0);
                                                if (!($745)) {
                                                    $746 = ((($$3$i$i)) + 16|0);
                                                    HEAP32[$746>>2] = $744;
                                                    $747 = ((($744)) + 24|0);
                                                    HEAP32[$747>>2] = $$3$i$i;
                                                }
                                                $748 = ((($743)) + 4|0);
                                                $749 = HEAP32[$748>>2]|0;
                                                $750 = ($749|0)==(0|0);
                                                if ($750) {
                                                    break;
                                                }
                                                $751 = ((($$3$i$i)) + 20|0);
                                                HEAP32[$751>>2] = $749;
                                                $752 = ((($749)) + 24|0);
                                                HEAP32[$752>>2] = $$3$i$i;
                                            }
                                        } while(0);
                                        $753 = (($668) + ($692)|0);
                                        $754 = (($692) + ($673))|0;
                                        $$0$i$i = $753;$$0260$i$i = $754;
                                    } else {
                                        $$0$i$i = $668;$$0260$i$i = $673;
                                    }
                                    $755 = ((($$0$i$i)) + 4|0);
                                    $756 = HEAP32[$755>>2]|0;
                                    $757 = $756 & -2;
                                    HEAP32[$755>>2] = $757;
                                    $758 = $$0260$i$i | 1;
                                    $759 = ((($672)) + 4|0);
                                    HEAP32[$759>>2] = $758;
                                    $760 = (($672) + ($$0260$i$i)|0);
                                    HEAP32[$760>>2] = $$0260$i$i;
                                    $761 = $$0260$i$i >>> 3;
                                    $762 = ($$0260$i$i>>>0)<(256);
                                    if ($762) {
                                        $763 = $761 << 1;
                                        $764 = (2592 + ($763<<2)|0);
                                        $765 = HEAP32[638]|0;
                                        $766 = 1 << $761;
                                        $767 = $765 & $766;
                                        $768 = ($767|0)==(0);
                                        if ($768) {
                                            $769 = $765 | $766;
                                            HEAP32[638] = $769;
                                            $$pre$i17$i = ((($764)) + 8|0);
                                            $$0268$i$i = $764;$$pre$phi$i18$iZ2D = $$pre$i17$i;
                                        } else {
                                            $770 = ((($764)) + 8|0);
                                            $771 = HEAP32[$770>>2]|0;
                                            $$0268$i$i = $771;$$pre$phi$i18$iZ2D = $770;
                                        }
                                        HEAP32[$$pre$phi$i18$iZ2D>>2] = $672;
                                        $772 = ((($$0268$i$i)) + 12|0);
                                        HEAP32[$772>>2] = $672;
                                        $773 = ((($672)) + 8|0);
                                        HEAP32[$773>>2] = $$0268$i$i;
                                        $774 = ((($672)) + 12|0);
                                        HEAP32[$774>>2] = $764;
                                        break;
                                    }
                                    $775 = $$0260$i$i >>> 8;
                                    $776 = ($775|0)==(0);
                                    do {
                                        if ($776) {
                                            $$0269$i$i = 0;
                                        } else {
                                            $777 = ($$0260$i$i>>>0)>(16777215);
                                            if ($777) {
                                                $$0269$i$i = 31;
                                                break;
                                            }
                                            $778 = (($775) + 1048320)|0;
                                            $779 = $778 >>> 16;
                                            $780 = $779 & 8;
                                            $781 = $775 << $780;
                                            $782 = (($781) + 520192)|0;
                                            $783 = $782 >>> 16;
                                            $784 = $783 & 4;
                                            $785 = $784 | $780;
                                            $786 = $781 << $784;
                                            $787 = (($786) + 245760)|0;
                                            $788 = $787 >>> 16;
                                            $789 = $788 & 2;
                                            $790 = $785 | $789;
                                            $791 = (14 - ($790))|0;
                                            $792 = $786 << $789;
                                            $793 = $792 >>> 15;
                                            $794 = (($791) + ($793))|0;
                                            $795 = $794 << 1;
                                            $796 = (($794) + 7)|0;
                                            $797 = $$0260$i$i >>> $796;
                                            $798 = $797 & 1;
                                            $799 = $798 | $795;
                                            $$0269$i$i = $799;
                                        }
                                    } while(0);
                                    $800 = (2856 + ($$0269$i$i<<2)|0);
                                    $801 = ((($672)) + 28|0);
                                    HEAP32[$801>>2] = $$0269$i$i;
                                    $802 = ((($672)) + 16|0);
                                    $803 = ((($802)) + 4|0);
                                    HEAP32[$803>>2] = 0;
                                    HEAP32[$802>>2] = 0;
                                    $804 = HEAP32[(2556)>>2]|0;
                                    $805 = 1 << $$0269$i$i;
                                    $806 = $804 & $805;
                                    $807 = ($806|0)==(0);
                                    if ($807) {
                                        $808 = $804 | $805;
                                        HEAP32[(2556)>>2] = $808;
                                        HEAP32[$800>>2] = $672;
                                        $809 = ((($672)) + 24|0);
                                        HEAP32[$809>>2] = $800;
                                        $810 = ((($672)) + 12|0);
                                        HEAP32[$810>>2] = $672;
                                        $811 = ((($672)) + 8|0);
                                        HEAP32[$811>>2] = $672;
                                        break;
                                    }
                                    $812 = HEAP32[$800>>2]|0;
                                    $813 = ($$0269$i$i|0)==(31);
                                    $814 = $$0269$i$i >>> 1;
                                    $815 = (25 - ($814))|0;
                                    $816 = $813 ? 0 : $815;
                                    $817 = $$0260$i$i << $816;
                                    $$0261$i$i = $817;$$0262$i$i = $812;
                                    while(1) {
                                        $818 = ((($$0262$i$i)) + 4|0);
                                        $819 = HEAP32[$818>>2]|0;
                                        $820 = $819 & -8;
                                        $821 = ($820|0)==($$0260$i$i|0);
                                        if ($821) {
                                            label = 192;
                                            break;
                                        }
                                        $822 = $$0261$i$i >>> 31;
                                        $823 = (((($$0262$i$i)) + 16|0) + ($822<<2)|0);
                                        $824 = $$0261$i$i << 1;
                                        $825 = HEAP32[$823>>2]|0;
                                        $826 = ($825|0)==(0|0);
                                        if ($826) {
                                            label = 191;
                                            break;
                                        } else {
                                            $$0261$i$i = $824;$$0262$i$i = $825;
                                        }
                                    }
                                    if ((label|0) == 191) {
                                        HEAP32[$823>>2] = $672;
                                        $827 = ((($672)) + 24|0);
                                        HEAP32[$827>>2] = $$0262$i$i;
                                        $828 = ((($672)) + 12|0);
                                        HEAP32[$828>>2] = $672;
                                        $829 = ((($672)) + 8|0);
                                        HEAP32[$829>>2] = $672;
                                        break;
                                    }
                                    else if ((label|0) == 192) {
                                        $830 = ((($$0262$i$i)) + 8|0);
                                        $831 = HEAP32[$830>>2]|0;
                                        $832 = ((($831)) + 12|0);
                                        HEAP32[$832>>2] = $672;
                                        HEAP32[$830>>2] = $672;
                                        $833 = ((($672)) + 8|0);
                                        HEAP32[$833>>2] = $831;
                                        $834 = ((($672)) + 12|0);
                                        HEAP32[$834>>2] = $$0262$i$i;
                                        $835 = ((($672)) + 24|0);
                                        HEAP32[$835>>2] = 0;
                                        break;
                                    }
                                }
                            } while(0);
                            $960 = ((($660)) + 8|0);
                            $$0 = $960;
                            STACKTOP = sp;return ($$0|0);
                        } else {
                            $$0$i$i$i = (3000);
                        }
                    }
                    while(1) {
                        $836 = HEAP32[$$0$i$i$i>>2]|0;
                        $837 = ($836>>>0)>($586>>>0);
                        if (!($837)) {
                            $838 = ((($$0$i$i$i)) + 4|0);
                            $839 = HEAP32[$838>>2]|0;
                            $840 = (($836) + ($839)|0);
                            $841 = ($840>>>0)>($586>>>0);
                            if ($841) {
                                break;
                            }
                        }
                        $842 = ((($$0$i$i$i)) + 8|0);
                        $843 = HEAP32[$842>>2]|0;
                        $$0$i$i$i = $843;
                    }
                    $844 = ((($840)) + -47|0);
                    $845 = ((($844)) + 8|0);
                    $846 = $845;
                    $847 = $846 & 7;
                    $848 = ($847|0)==(0);
                    $849 = (0 - ($846))|0;
                    $850 = $849 & 7;
                    $851 = $848 ? 0 : $850;
                    $852 = (($844) + ($851)|0);
                    $853 = ((($586)) + 16|0);
                    $854 = ($852>>>0)<($853>>>0);
                    $855 = $854 ? $586 : $852;
                    $856 = ((($855)) + 8|0);
                    $857 = ((($855)) + 24|0);
                    $858 = (($$723947$i) + -40)|0;
                    $859 = ((($$748$i)) + 8|0);
                    $860 = $859;
                    $861 = $860 & 7;
                    $862 = ($861|0)==(0);
                    $863 = (0 - ($860))|0;
                    $864 = $863 & 7;
                    $865 = $862 ? 0 : $864;
                    $866 = (($$748$i) + ($865)|0);
                    $867 = (($858) - ($865))|0;
                    HEAP32[(2576)>>2] = $866;
                    HEAP32[(2564)>>2] = $867;
                    $868 = $867 | 1;
                    $869 = ((($866)) + 4|0);
                    HEAP32[$869>>2] = $868;
                    $870 = (($$748$i) + ($858)|0);
                    $871 = ((($870)) + 4|0);
                    HEAP32[$871>>2] = 40;
                    $872 = HEAP32[(3040)>>2]|0;
                    HEAP32[(2580)>>2] = $872;
                    $873 = ((($855)) + 4|0);
                    HEAP32[$873>>2] = 27;
                    ;HEAP32[$856>>2]=HEAP32[(3000)>>2]|0;HEAP32[$856+4>>2]=HEAP32[(3000)+4>>2]|0;HEAP32[$856+8>>2]=HEAP32[(3000)+8>>2]|0;HEAP32[$856+12>>2]=HEAP32[(3000)+12>>2]|0;
                    HEAP32[(3000)>>2] = $$748$i;
                    HEAP32[(3004)>>2] = $$723947$i;
                    HEAP32[(3012)>>2] = 0;
                    HEAP32[(3008)>>2] = $856;
                    $875 = $857;
                    while(1) {
                        $874 = ((($875)) + 4|0);
                        HEAP32[$874>>2] = 7;
                        $876 = ((($875)) + 8|0);
                        $877 = ($876>>>0)<($840>>>0);
                        if ($877) {
                            $875 = $874;
                        } else {
                            break;
                        }
                    }
                    $878 = ($855|0)==($586|0);
                    if (!($878)) {
                        $879 = $855;
                        $880 = $586;
                        $881 = (($879) - ($880))|0;
                        $882 = HEAP32[$873>>2]|0;
                        $883 = $882 & -2;
                        HEAP32[$873>>2] = $883;
                        $884 = $881 | 1;
                        $885 = ((($586)) + 4|0);
                        HEAP32[$885>>2] = $884;
                        HEAP32[$855>>2] = $881;
                        $886 = $881 >>> 3;
                        $887 = ($881>>>0)<(256);
                        if ($887) {
                            $888 = $886 << 1;
                            $889 = (2592 + ($888<<2)|0);
                            $890 = HEAP32[638]|0;
                            $891 = 1 << $886;
                            $892 = $890 & $891;
                            $893 = ($892|0)==(0);
                            if ($893) {
                                $894 = $890 | $891;
                                HEAP32[638] = $894;
                                $$pre$i$i = ((($889)) + 8|0);
                                $$0206$i$i = $889;$$pre$phi$i$iZ2D = $$pre$i$i;
                            } else {
                                $895 = ((($889)) + 8|0);
                                $896 = HEAP32[$895>>2]|0;
                                $$0206$i$i = $896;$$pre$phi$i$iZ2D = $895;
                            }
                            HEAP32[$$pre$phi$i$iZ2D>>2] = $586;
                            $897 = ((($$0206$i$i)) + 12|0);
                            HEAP32[$897>>2] = $586;
                            $898 = ((($586)) + 8|0);
                            HEAP32[$898>>2] = $$0206$i$i;
                            $899 = ((($586)) + 12|0);
                            HEAP32[$899>>2] = $889;
                            break;
                        }
                        $900 = $881 >>> 8;
                        $901 = ($900|0)==(0);
                        if ($901) {
                            $$0207$i$i = 0;
                        } else {
                            $902 = ($881>>>0)>(16777215);
                            if ($902) {
                                $$0207$i$i = 31;
                            } else {
                                $903 = (($900) + 1048320)|0;
                                $904 = $903 >>> 16;
                                $905 = $904 & 8;
                                $906 = $900 << $905;
                                $907 = (($906) + 520192)|0;
                                $908 = $907 >>> 16;
                                $909 = $908 & 4;
                                $910 = $909 | $905;
                                $911 = $906 << $909;
                                $912 = (($911) + 245760)|0;
                                $913 = $912 >>> 16;
                                $914 = $913 & 2;
                                $915 = $910 | $914;
                                $916 = (14 - ($915))|0;
                                $917 = $911 << $914;
                                $918 = $917 >>> 15;
                                $919 = (($916) + ($918))|0;
                                $920 = $919 << 1;
                                $921 = (($919) + 7)|0;
                                $922 = $881 >>> $921;
                                $923 = $922 & 1;
                                $924 = $923 | $920;
                                $$0207$i$i = $924;
                            }
                        }
                        $925 = (2856 + ($$0207$i$i<<2)|0);
                        $926 = ((($586)) + 28|0);
                        HEAP32[$926>>2] = $$0207$i$i;
                        $927 = ((($586)) + 20|0);
                        HEAP32[$927>>2] = 0;
                        HEAP32[$853>>2] = 0;
                        $928 = HEAP32[(2556)>>2]|0;
                        $929 = 1 << $$0207$i$i;
                        $930 = $928 & $929;
                        $931 = ($930|0)==(0);
                        if ($931) {
                            $932 = $928 | $929;
                            HEAP32[(2556)>>2] = $932;
                            HEAP32[$925>>2] = $586;
                            $933 = ((($586)) + 24|0);
                            HEAP32[$933>>2] = $925;
                            $934 = ((($586)) + 12|0);
                            HEAP32[$934>>2] = $586;
                            $935 = ((($586)) + 8|0);
                            HEAP32[$935>>2] = $586;
                            break;
                        }
                        $936 = HEAP32[$925>>2]|0;
                        $937 = ($$0207$i$i|0)==(31);
                        $938 = $$0207$i$i >>> 1;
                        $939 = (25 - ($938))|0;
                        $940 = $937 ? 0 : $939;
                        $941 = $881 << $940;
                        $$0201$i$i = $941;$$0202$i$i = $936;
                        while(1) {
                            $942 = ((($$0202$i$i)) + 4|0);
                            $943 = HEAP32[$942>>2]|0;
                            $944 = $943 & -8;
                            $945 = ($944|0)==($881|0);
                            if ($945) {
                                label = 213;
                                break;
                            }
                            $946 = $$0201$i$i >>> 31;
                            $947 = (((($$0202$i$i)) + 16|0) + ($946<<2)|0);
                            $948 = $$0201$i$i << 1;
                            $949 = HEAP32[$947>>2]|0;
                            $950 = ($949|0)==(0|0);
                            if ($950) {
                                label = 212;
                                break;
                            } else {
                                $$0201$i$i = $948;$$0202$i$i = $949;
                            }
                        }
                        if ((label|0) == 212) {
                            HEAP32[$947>>2] = $586;
                            $951 = ((($586)) + 24|0);
                            HEAP32[$951>>2] = $$0202$i$i;
                            $952 = ((($586)) + 12|0);
                            HEAP32[$952>>2] = $586;
                            $953 = ((($586)) + 8|0);
                            HEAP32[$953>>2] = $586;
                            break;
                        }
                        else if ((label|0) == 213) {
                            $954 = ((($$0202$i$i)) + 8|0);
                            $955 = HEAP32[$954>>2]|0;
                            $956 = ((($955)) + 12|0);
                            HEAP32[$956>>2] = $586;
                            HEAP32[$954>>2] = $586;
                            $957 = ((($586)) + 8|0);
                            HEAP32[$957>>2] = $955;
                            $958 = ((($586)) + 12|0);
                            HEAP32[$958>>2] = $$0202$i$i;
                            $959 = ((($586)) + 24|0);
                            HEAP32[$959>>2] = 0;
                            break;
                        }
                    }
                }
            } while(0);
            $961 = HEAP32[(2564)>>2]|0;
            $962 = ($961>>>0)>($$0192>>>0);
            if ($962) {
                $963 = (($961) - ($$0192))|0;
                HEAP32[(2564)>>2] = $963;
                $964 = HEAP32[(2576)>>2]|0;
                $965 = (($964) + ($$0192)|0);
                HEAP32[(2576)>>2] = $965;
                $966 = $963 | 1;
                $967 = ((($965)) + 4|0);
                HEAP32[$967>>2] = $966;
                $968 = $$0192 | 3;
                $969 = ((($964)) + 4|0);
                HEAP32[$969>>2] = $968;
                $970 = ((($964)) + 8|0);
                $$0 = $970;
                STACKTOP = sp;return ($$0|0);
            }
        }
        $971 = (___errno_location()|0);
        HEAP32[$971>>2] = 12;
        $$0 = 0;
        STACKTOP = sp;return ($$0|0);
    }
    function _free($0) {
        $0 = $0|0;
        var $$0195$i = 0, $$0195$in$i = 0, $$0348 = 0, $$0349 = 0, $$0361 = 0, $$0368 = 0, $$1 = 0, $$1347 = 0, $$1352 = 0, $$1355 = 0, $$1363 = 0, $$1367 = 0, $$2 = 0, $$3 = 0, $$3365 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0;
        var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
        var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
        var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
        var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
        var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
        var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
        var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
        var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
        var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $27 = 0;
        var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
        var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
        var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
        var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond373 = 0;
        var $cond374 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = ($0|0)==(0|0);
        if ($1) {
            return;
        }
        $2 = ((($0)) + -8|0);
        $3 = HEAP32[(2568)>>2]|0;
        $4 = ((($0)) + -4|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = $5 & -8;
        $7 = (($2) + ($6)|0);
        $8 = $5 & 1;
        $9 = ($8|0)==(0);
        do {
            if ($9) {
                $10 = HEAP32[$2>>2]|0;
                $11 = $5 & 3;
                $12 = ($11|0)==(0);
                if ($12) {
                    return;
                }
                $13 = (0 - ($10))|0;
                $14 = (($2) + ($13)|0);
                $15 = (($10) + ($6))|0;
                $16 = ($14>>>0)<($3>>>0);
                if ($16) {
                    return;
                }
                $17 = HEAP32[(2572)>>2]|0;
                $18 = ($17|0)==($14|0);
                if ($18) {
                    $79 = ((($7)) + 4|0);
                    $80 = HEAP32[$79>>2]|0;
                    $81 = $80 & 3;
                    $82 = ($81|0)==(3);
                    if (!($82)) {
                        $$1 = $14;$$1347 = $15;$88 = $14;
                        break;
                    }
                    HEAP32[(2560)>>2] = $15;
                    $83 = $80 & -2;
                    HEAP32[$79>>2] = $83;
                    $84 = $15 | 1;
                    $85 = ((($14)) + 4|0);
                    HEAP32[$85>>2] = $84;
                    $86 = (($14) + ($15)|0);
                    HEAP32[$86>>2] = $15;
                    return;
                }
                $19 = $10 >>> 3;
                $20 = ($10>>>0)<(256);
                if ($20) {
                    $21 = ((($14)) + 8|0);
                    $22 = HEAP32[$21>>2]|0;
                    $23 = ((($14)) + 12|0);
                    $24 = HEAP32[$23>>2]|0;
                    $25 = ($24|0)==($22|0);
                    if ($25) {
                        $26 = 1 << $19;
                        $27 = $26 ^ -1;
                        $28 = HEAP32[638]|0;
                        $29 = $28 & $27;
                        HEAP32[638] = $29;
                        $$1 = $14;$$1347 = $15;$88 = $14;
                        break;
                    } else {
                        $30 = ((($22)) + 12|0);
                        HEAP32[$30>>2] = $24;
                        $31 = ((($24)) + 8|0);
                        HEAP32[$31>>2] = $22;
                        $$1 = $14;$$1347 = $15;$88 = $14;
                        break;
                    }
                }
                $32 = ((($14)) + 24|0);
                $33 = HEAP32[$32>>2]|0;
                $34 = ((($14)) + 12|0);
                $35 = HEAP32[$34>>2]|0;
                $36 = ($35|0)==($14|0);
                do {
                    if ($36) {
                        $41 = ((($14)) + 16|0);
                        $42 = ((($41)) + 4|0);
                        $43 = HEAP32[$42>>2]|0;
                        $44 = ($43|0)==(0|0);
                        if ($44) {
                            $45 = HEAP32[$41>>2]|0;
                            $46 = ($45|0)==(0|0);
                            if ($46) {
                                $$3 = 0;
                                break;
                            } else {
                                $$1352 = $45;$$1355 = $41;
                            }
                        } else {
                            $$1352 = $43;$$1355 = $42;
                        }
                        while(1) {
                            $47 = ((($$1352)) + 20|0);
                            $48 = HEAP32[$47>>2]|0;
                            $49 = ($48|0)==(0|0);
                            if (!($49)) {
                                $$1352 = $48;$$1355 = $47;
                                continue;
                            }
                            $50 = ((($$1352)) + 16|0);
                            $51 = HEAP32[$50>>2]|0;
                            $52 = ($51|0)==(0|0);
                            if ($52) {
                                break;
                            } else {
                                $$1352 = $51;$$1355 = $50;
                            }
                        }
                        HEAP32[$$1355>>2] = 0;
                        $$3 = $$1352;
                    } else {
                        $37 = ((($14)) + 8|0);
                        $38 = HEAP32[$37>>2]|0;
                        $39 = ((($38)) + 12|0);
                        HEAP32[$39>>2] = $35;
                        $40 = ((($35)) + 8|0);
                        HEAP32[$40>>2] = $38;
                        $$3 = $35;
                    }
                } while(0);
                $53 = ($33|0)==(0|0);
                if ($53) {
                    $$1 = $14;$$1347 = $15;$88 = $14;
                } else {
                    $54 = ((($14)) + 28|0);
                    $55 = HEAP32[$54>>2]|0;
                    $56 = (2856 + ($55<<2)|0);
                    $57 = HEAP32[$56>>2]|0;
                    $58 = ($57|0)==($14|0);
                    if ($58) {
                        HEAP32[$56>>2] = $$3;
                        $cond373 = ($$3|0)==(0|0);
                        if ($cond373) {
                            $59 = 1 << $55;
                            $60 = $59 ^ -1;
                            $61 = HEAP32[(2556)>>2]|0;
                            $62 = $61 & $60;
                            HEAP32[(2556)>>2] = $62;
                            $$1 = $14;$$1347 = $15;$88 = $14;
                            break;
                        }
                    } else {
                        $63 = ((($33)) + 16|0);
                        $64 = HEAP32[$63>>2]|0;
                        $65 = ($64|0)!=($14|0);
                        $$sink3 = $65&1;
                        $66 = (((($33)) + 16|0) + ($$sink3<<2)|0);
                        HEAP32[$66>>2] = $$3;
                        $67 = ($$3|0)==(0|0);
                        if ($67) {
                            $$1 = $14;$$1347 = $15;$88 = $14;
                            break;
                        }
                    }
                    $68 = ((($$3)) + 24|0);
                    HEAP32[$68>>2] = $33;
                    $69 = ((($14)) + 16|0);
                    $70 = HEAP32[$69>>2]|0;
                    $71 = ($70|0)==(0|0);
                    if (!($71)) {
                        $72 = ((($$3)) + 16|0);
                        HEAP32[$72>>2] = $70;
                        $73 = ((($70)) + 24|0);
                        HEAP32[$73>>2] = $$3;
                    }
                    $74 = ((($69)) + 4|0);
                    $75 = HEAP32[$74>>2]|0;
                    $76 = ($75|0)==(0|0);
                    if ($76) {
                        $$1 = $14;$$1347 = $15;$88 = $14;
                    } else {
                        $77 = ((($$3)) + 20|0);
                        HEAP32[$77>>2] = $75;
                        $78 = ((($75)) + 24|0);
                        HEAP32[$78>>2] = $$3;
                        $$1 = $14;$$1347 = $15;$88 = $14;
                    }
                }
            } else {
                $$1 = $2;$$1347 = $6;$88 = $2;
            }
        } while(0);
        $87 = ($88>>>0)<($7>>>0);
        if (!($87)) {
            return;
        }
        $89 = ((($7)) + 4|0);
        $90 = HEAP32[$89>>2]|0;
        $91 = $90 & 1;
        $92 = ($91|0)==(0);
        if ($92) {
            return;
        }
        $93 = $90 & 2;
        $94 = ($93|0)==(0);
        if ($94) {
            $95 = HEAP32[(2576)>>2]|0;
            $96 = ($95|0)==($7|0);
            if ($96) {
                $97 = HEAP32[(2564)>>2]|0;
                $98 = (($97) + ($$1347))|0;
                HEAP32[(2564)>>2] = $98;
                HEAP32[(2576)>>2] = $$1;
                $99 = $98 | 1;
                $100 = ((($$1)) + 4|0);
                HEAP32[$100>>2] = $99;
                $101 = HEAP32[(2572)>>2]|0;
                $102 = ($$1|0)==($101|0);
                if (!($102)) {
                    return;
                }
                HEAP32[(2572)>>2] = 0;
                HEAP32[(2560)>>2] = 0;
                return;
            }
            $103 = HEAP32[(2572)>>2]|0;
            $104 = ($103|0)==($7|0);
            if ($104) {
                $105 = HEAP32[(2560)>>2]|0;
                $106 = (($105) + ($$1347))|0;
                HEAP32[(2560)>>2] = $106;
                HEAP32[(2572)>>2] = $88;
                $107 = $106 | 1;
                $108 = ((($$1)) + 4|0);
                HEAP32[$108>>2] = $107;
                $109 = (($88) + ($106)|0);
                HEAP32[$109>>2] = $106;
                return;
            }
            $110 = $90 & -8;
            $111 = (($110) + ($$1347))|0;
            $112 = $90 >>> 3;
            $113 = ($90>>>0)<(256);
            do {
                if ($113) {
                    $114 = ((($7)) + 8|0);
                    $115 = HEAP32[$114>>2]|0;
                    $116 = ((($7)) + 12|0);
                    $117 = HEAP32[$116>>2]|0;
                    $118 = ($117|0)==($115|0);
                    if ($118) {
                        $119 = 1 << $112;
                        $120 = $119 ^ -1;
                        $121 = HEAP32[638]|0;
                        $122 = $121 & $120;
                        HEAP32[638] = $122;
                        break;
                    } else {
                        $123 = ((($115)) + 12|0);
                        HEAP32[$123>>2] = $117;
                        $124 = ((($117)) + 8|0);
                        HEAP32[$124>>2] = $115;
                        break;
                    }
                } else {
                    $125 = ((($7)) + 24|0);
                    $126 = HEAP32[$125>>2]|0;
                    $127 = ((($7)) + 12|0);
                    $128 = HEAP32[$127>>2]|0;
                    $129 = ($128|0)==($7|0);
                    do {
                        if ($129) {
                            $134 = ((($7)) + 16|0);
                            $135 = ((($134)) + 4|0);
                            $136 = HEAP32[$135>>2]|0;
                            $137 = ($136|0)==(0|0);
                            if ($137) {
                                $138 = HEAP32[$134>>2]|0;
                                $139 = ($138|0)==(0|0);
                                if ($139) {
                                    $$3365 = 0;
                                    break;
                                } else {
                                    $$1363 = $138;$$1367 = $134;
                                }
                            } else {
                                $$1363 = $136;$$1367 = $135;
                            }
                            while(1) {
                                $140 = ((($$1363)) + 20|0);
                                $141 = HEAP32[$140>>2]|0;
                                $142 = ($141|0)==(0|0);
                                if (!($142)) {
                                    $$1363 = $141;$$1367 = $140;
                                    continue;
                                }
                                $143 = ((($$1363)) + 16|0);
                                $144 = HEAP32[$143>>2]|0;
                                $145 = ($144|0)==(0|0);
                                if ($145) {
                                    break;
                                } else {
                                    $$1363 = $144;$$1367 = $143;
                                }
                            }
                            HEAP32[$$1367>>2] = 0;
                            $$3365 = $$1363;
                        } else {
                            $130 = ((($7)) + 8|0);
                            $131 = HEAP32[$130>>2]|0;
                            $132 = ((($131)) + 12|0);
                            HEAP32[$132>>2] = $128;
                            $133 = ((($128)) + 8|0);
                            HEAP32[$133>>2] = $131;
                            $$3365 = $128;
                        }
                    } while(0);
                    $146 = ($126|0)==(0|0);
                    if (!($146)) {
                        $147 = ((($7)) + 28|0);
                        $148 = HEAP32[$147>>2]|0;
                        $149 = (2856 + ($148<<2)|0);
                        $150 = HEAP32[$149>>2]|0;
                        $151 = ($150|0)==($7|0);
                        if ($151) {
                            HEAP32[$149>>2] = $$3365;
                            $cond374 = ($$3365|0)==(0|0);
                            if ($cond374) {
                                $152 = 1 << $148;
                                $153 = $152 ^ -1;
                                $154 = HEAP32[(2556)>>2]|0;
                                $155 = $154 & $153;
                                HEAP32[(2556)>>2] = $155;
                                break;
                            }
                        } else {
                            $156 = ((($126)) + 16|0);
                            $157 = HEAP32[$156>>2]|0;
                            $158 = ($157|0)!=($7|0);
                            $$sink5 = $158&1;
                            $159 = (((($126)) + 16|0) + ($$sink5<<2)|0);
                            HEAP32[$159>>2] = $$3365;
                            $160 = ($$3365|0)==(0|0);
                            if ($160) {
                                break;
                            }
                        }
                        $161 = ((($$3365)) + 24|0);
                        HEAP32[$161>>2] = $126;
                        $162 = ((($7)) + 16|0);
                        $163 = HEAP32[$162>>2]|0;
                        $164 = ($163|0)==(0|0);
                        if (!($164)) {
                            $165 = ((($$3365)) + 16|0);
                            HEAP32[$165>>2] = $163;
                            $166 = ((($163)) + 24|0);
                            HEAP32[$166>>2] = $$3365;
                        }
                        $167 = ((($162)) + 4|0);
                        $168 = HEAP32[$167>>2]|0;
                        $169 = ($168|0)==(0|0);
                        if (!($169)) {
                            $170 = ((($$3365)) + 20|0);
                            HEAP32[$170>>2] = $168;
                            $171 = ((($168)) + 24|0);
                            HEAP32[$171>>2] = $$3365;
                        }
                    }
                }
            } while(0);
            $172 = $111 | 1;
            $173 = ((($$1)) + 4|0);
            HEAP32[$173>>2] = $172;
            $174 = (($88) + ($111)|0);
            HEAP32[$174>>2] = $111;
            $175 = HEAP32[(2572)>>2]|0;
            $176 = ($$1|0)==($175|0);
            if ($176) {
                HEAP32[(2560)>>2] = $111;
                return;
            } else {
                $$2 = $111;
            }
        } else {
            $177 = $90 & -2;
            HEAP32[$89>>2] = $177;
            $178 = $$1347 | 1;
            $179 = ((($$1)) + 4|0);
            HEAP32[$179>>2] = $178;
            $180 = (($88) + ($$1347)|0);
            HEAP32[$180>>2] = $$1347;
            $$2 = $$1347;
        }
        $181 = $$2 >>> 3;
        $182 = ($$2>>>0)<(256);
        if ($182) {
            $183 = $181 << 1;
            $184 = (2592 + ($183<<2)|0);
            $185 = HEAP32[638]|0;
            $186 = 1 << $181;
            $187 = $185 & $186;
            $188 = ($187|0)==(0);
            if ($188) {
                $189 = $185 | $186;
                HEAP32[638] = $189;
                $$pre = ((($184)) + 8|0);
                $$0368 = $184;$$pre$phiZ2D = $$pre;
            } else {
                $190 = ((($184)) + 8|0);
                $191 = HEAP32[$190>>2]|0;
                $$0368 = $191;$$pre$phiZ2D = $190;
            }
            HEAP32[$$pre$phiZ2D>>2] = $$1;
            $192 = ((($$0368)) + 12|0);
            HEAP32[$192>>2] = $$1;
            $193 = ((($$1)) + 8|0);
            HEAP32[$193>>2] = $$0368;
            $194 = ((($$1)) + 12|0);
            HEAP32[$194>>2] = $184;
            return;
        }
        $195 = $$2 >>> 8;
        $196 = ($195|0)==(0);
        if ($196) {
            $$0361 = 0;
        } else {
            $197 = ($$2>>>0)>(16777215);
            if ($197) {
                $$0361 = 31;
            } else {
                $198 = (($195) + 1048320)|0;
                $199 = $198 >>> 16;
                $200 = $199 & 8;
                $201 = $195 << $200;
                $202 = (($201) + 520192)|0;
                $203 = $202 >>> 16;
                $204 = $203 & 4;
                $205 = $204 | $200;
                $206 = $201 << $204;
                $207 = (($206) + 245760)|0;
                $208 = $207 >>> 16;
                $209 = $208 & 2;
                $210 = $205 | $209;
                $211 = (14 - ($210))|0;
                $212 = $206 << $209;
                $213 = $212 >>> 15;
                $214 = (($211) + ($213))|0;
                $215 = $214 << 1;
                $216 = (($214) + 7)|0;
                $217 = $$2 >>> $216;
                $218 = $217 & 1;
                $219 = $218 | $215;
                $$0361 = $219;
            }
        }
        $220 = (2856 + ($$0361<<2)|0);
        $221 = ((($$1)) + 28|0);
        HEAP32[$221>>2] = $$0361;
        $222 = ((($$1)) + 16|0);
        $223 = ((($$1)) + 20|0);
        HEAP32[$223>>2] = 0;
        HEAP32[$222>>2] = 0;
        $224 = HEAP32[(2556)>>2]|0;
        $225 = 1 << $$0361;
        $226 = $224 & $225;
        $227 = ($226|0)==(0);
        do {
            if ($227) {
                $228 = $224 | $225;
                HEAP32[(2556)>>2] = $228;
                HEAP32[$220>>2] = $$1;
                $229 = ((($$1)) + 24|0);
                HEAP32[$229>>2] = $220;
                $230 = ((($$1)) + 12|0);
                HEAP32[$230>>2] = $$1;
                $231 = ((($$1)) + 8|0);
                HEAP32[$231>>2] = $$1;
            } else {
                $232 = HEAP32[$220>>2]|0;
                $233 = ($$0361|0)==(31);
                $234 = $$0361 >>> 1;
                $235 = (25 - ($234))|0;
                $236 = $233 ? 0 : $235;
                $237 = $$2 << $236;
                $$0348 = $237;$$0349 = $232;
                while(1) {
                    $238 = ((($$0349)) + 4|0);
                    $239 = HEAP32[$238>>2]|0;
                    $240 = $239 & -8;
                    $241 = ($240|0)==($$2|0);
                    if ($241) {
                        label = 73;
                        break;
                    }
                    $242 = $$0348 >>> 31;
                    $243 = (((($$0349)) + 16|0) + ($242<<2)|0);
                    $244 = $$0348 << 1;
                    $245 = HEAP32[$243>>2]|0;
                    $246 = ($245|0)==(0|0);
                    if ($246) {
                        label = 72;
                        break;
                    } else {
                        $$0348 = $244;$$0349 = $245;
                    }
                }
                if ((label|0) == 72) {
                    HEAP32[$243>>2] = $$1;
                    $247 = ((($$1)) + 24|0);
                    HEAP32[$247>>2] = $$0349;
                    $248 = ((($$1)) + 12|0);
                    HEAP32[$248>>2] = $$1;
                    $249 = ((($$1)) + 8|0);
                    HEAP32[$249>>2] = $$1;
                    break;
                }
                else if ((label|0) == 73) {
                    $250 = ((($$0349)) + 8|0);
                    $251 = HEAP32[$250>>2]|0;
                    $252 = ((($251)) + 12|0);
                    HEAP32[$252>>2] = $$1;
                    HEAP32[$250>>2] = $$1;
                    $253 = ((($$1)) + 8|0);
                    HEAP32[$253>>2] = $251;
                    $254 = ((($$1)) + 12|0);
                    HEAP32[$254>>2] = $$0349;
                    $255 = ((($$1)) + 24|0);
                    HEAP32[$255>>2] = 0;
                    break;
                }
            }
        } while(0);
        $256 = HEAP32[(2584)>>2]|0;
        $257 = (($256) + -1)|0;
        HEAP32[(2584)>>2] = $257;
        $258 = ($257|0)==(0);
        if ($258) {
            $$0195$in$i = (3008);
        } else {
            return;
        }
        while(1) {
            $$0195$i = HEAP32[$$0195$in$i>>2]|0;
            $259 = ($$0195$i|0)==(0|0);
            $260 = ((($$0195$i)) + 8|0);
            if ($259) {
                break;
            } else {
                $$0195$in$i = $260;
            }
        }
        HEAP32[(2584)>>2] = -1;
        return;
    }
    function ___errno_location() {
        var label = 0, sp = 0;
        sp = STACKTOP;
        return (3048|0);
    }
    function _strlen($0) {
        $0 = $0|0;
        var $$0 = 0, $$015$lcssa = 0, $$01519 = 0, $$1$lcssa = 0, $$pn = 0, $$pre = 0, $$sink = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
        var $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = $0;
        $2 = $1 & 3;
        $3 = ($2|0)==(0);
        L1: do {
            if ($3) {
                $$015$lcssa = $0;
                label = 4;
            } else {
                $$01519 = $0;$23 = $1;
                while(1) {
                    $4 = HEAP8[$$01519>>0]|0;
                    $5 = ($4<<24>>24)==(0);
                    if ($5) {
                        $$sink = $23;
                        break L1;
                    }
                    $6 = ((($$01519)) + 1|0);
                    $7 = $6;
                    $8 = $7 & 3;
                    $9 = ($8|0)==(0);
                    if ($9) {
                        $$015$lcssa = $6;
                        label = 4;
                        break;
                    } else {
                        $$01519 = $6;$23 = $7;
                    }
                }
            }
        } while(0);
        if ((label|0) == 4) {
            $$0 = $$015$lcssa;
            while(1) {
                $10 = HEAP32[$$0>>2]|0;
                $11 = (($10) + -16843009)|0;
                $12 = $10 & -2139062144;
                $13 = $12 ^ -2139062144;
                $14 = $13 & $11;
                $15 = ($14|0)==(0);
                $16 = ((($$0)) + 4|0);
                if ($15) {
                    $$0 = $16;
                } else {
                    break;
                }
            }
            $17 = $10&255;
            $18 = ($17<<24>>24)==(0);
            if ($18) {
                $$1$lcssa = $$0;
            } else {
                $$pn = $$0;
                while(1) {
                    $19 = ((($$pn)) + 1|0);
                    $$pre = HEAP8[$19>>0]|0;
                    $20 = ($$pre<<24>>24)==(0);
                    if ($20) {
                        $$1$lcssa = $19;
                        break;
                    } else {
                        $$pn = $19;
                    }
                }
            }
            $21 = $$1$lcssa;
            $$sink = $21;
        }
        $22 = (($$sink) - ($1))|0;
        return ($22|0);
    }
    function ___strdup($0) {
        $0 = $0|0;
        var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = (_strlen($0)|0);
        $2 = (($1) + 1)|0;
        $3 = (_malloc($2)|0);
        $4 = ($3|0)==(0|0);
        if ($4) {
            $$0 = 0;
        } else {
            $5 = (_memcpy(($3|0),($0|0),($2|0))|0);
            $$0 = $5;
        }
        return ($$0|0);
    }
    function __Znwj($0) {
        $0 = $0|0;
        var $$ = 0, $$lcssa = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $1 = ($0|0)==(0);
        $$ = $1 ? 1 : $0;
        while(1) {
            $2 = (_malloc($$)|0);
            $3 = ($2|0)==(0|0);
            if (!($3)) {
                $$lcssa = $2;
                break;
            }
            $4 = (__ZSt15get_new_handlerv()|0);
            $5 = ($4|0)==(0|0);
            if ($5) {
                $$lcssa = 0;
                break;
            }
            FUNCTION_TABLE_v[$4 & 0]();
        }
        return ($$lcssa|0);
    }
    function __ZdlPv($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        _free($0);
        return;
    }
    function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return;
    }
    function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
        __ZdlPv($0);
        return;
    }
    function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return;
    }
    function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return;
    }
    function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$0 = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
        var dest = 0, label = 0, sp = 0, stop = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 64|0;
        $3 = sp;
        $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
        if ($4) {
            $$2 = 1;
        } else {
            $5 = ($1|0)==(0|0);
            if ($5) {
                $$2 = 0;
            } else {
                $6 = (___dynamic_cast($1,248,232,0)|0);
                $7 = ($6|0)==(0|0);
                if ($7) {
                    $$2 = 0;
                } else {
                    $8 = ((($3)) + 4|0);
                    dest=$8; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
                    HEAP32[$3>>2] = $6;
                    $9 = ((($3)) + 8|0);
                    HEAP32[$9>>2] = $0;
                    $10 = ((($3)) + 12|0);
                    HEAP32[$10>>2] = -1;
                    $11 = ((($3)) + 48|0);
                    HEAP32[$11>>2] = 1;
                    $12 = HEAP32[$6>>2]|0;
                    $13 = ((($12)) + 28|0);
                    $14 = HEAP32[$13>>2]|0;
                    $15 = HEAP32[$2>>2]|0;
                    FUNCTION_TABLE_viiii[$14 & 7]($6,$3,$15,1);
                    $16 = ((($3)) + 24|0);
                    $17 = HEAP32[$16>>2]|0;
                    $18 = ($17|0)==(1);
                    if ($18) {
                        $19 = ((($3)) + 16|0);
                        $20 = HEAP32[$19>>2]|0;
                        HEAP32[$2>>2] = $20;
                        $$0 = 1;
                    } else {
                        $$0 = 0;
                    }
                    $$2 = $$0;
                }
            }
        }
        STACKTOP = sp;return ($$2|0);
    }
    function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        $5 = $5|0;
        var $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $6 = ((($1)) + 8|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
        if ($8) {
            __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
        }
        return;
    }
    function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
        var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $5 = ((($1)) + 8|0);
        $6 = HEAP32[$5>>2]|0;
        $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
        do {
            if ($7) {
                __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
            } else {
                $8 = HEAP32[$1>>2]|0;
                $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
                if ($9) {
                    $10 = ((($1)) + 16|0);
                    $11 = HEAP32[$10>>2]|0;
                    $12 = ($11|0)==($2|0);
                    if (!($12)) {
                        $13 = ((($1)) + 20|0);
                        $14 = HEAP32[$13>>2]|0;
                        $15 = ($14|0)==($2|0);
                        if (!($15)) {
                            $18 = ((($1)) + 32|0);
                            HEAP32[$18>>2] = $3;
                            HEAP32[$13>>2] = $2;
                            $19 = ((($1)) + 40|0);
                            $20 = HEAP32[$19>>2]|0;
                            $21 = (($20) + 1)|0;
                            HEAP32[$19>>2] = $21;
                            $22 = ((($1)) + 36|0);
                            $23 = HEAP32[$22>>2]|0;
                            $24 = ($23|0)==(1);
                            if ($24) {
                                $25 = ((($1)) + 24|0);
                                $26 = HEAP32[$25>>2]|0;
                                $27 = ($26|0)==(2);
                                if ($27) {
                                    $28 = ((($1)) + 54|0);
                                    HEAP8[$28>>0] = 1;
                                }
                            }
                            $29 = ((($1)) + 44|0);
                            HEAP32[$29>>2] = 4;
                            break;
                        }
                    }
                    $16 = ($3|0)==(1);
                    if ($16) {
                        $17 = ((($1)) + 32|0);
                        HEAP32[$17>>2] = 1;
                    }
                }
            }
        } while(0);
        return;
    }
    function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = ((($1)) + 8|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
        if ($6) {
            __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
        }
        return;
    }
    function __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $3 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = ($0|0)==($1|0);
        return ($3|0);
    }
    function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = ((($1)) + 16|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = ($5|0)==(0|0);
        do {
            if ($6) {
                HEAP32[$4>>2] = $2;
                $7 = ((($1)) + 24|0);
                HEAP32[$7>>2] = $3;
                $8 = ((($1)) + 36|0);
                HEAP32[$8>>2] = 1;
            } else {
                $9 = ($5|0)==($2|0);
                if (!($9)) {
                    $13 = ((($1)) + 36|0);
                    $14 = HEAP32[$13>>2]|0;
                    $15 = (($14) + 1)|0;
                    HEAP32[$13>>2] = $15;
                    $16 = ((($1)) + 24|0);
                    HEAP32[$16>>2] = 2;
                    $17 = ((($1)) + 54|0);
                    HEAP8[$17>>0] = 1;
                    break;
                }
                $10 = ((($1)) + 24|0);
                $11 = HEAP32[$10>>2]|0;
                $12 = ($11|0)==(2);
                if ($12) {
                    HEAP32[$10>>2] = $3;
                }
            }
        } while(0);
        return;
    }
    function __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = ((($1)) + 4|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = ($5|0)==($2|0);
        if ($6) {
            $7 = ((($1)) + 28|0);
            $8 = HEAP32[$7>>2]|0;
            $9 = ($8|0)==(1);
            if (!($9)) {
                HEAP32[$7>>2] = $3;
            }
        }
        return;
    }
    function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0,$1,$2,$3,$4) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
        var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond22 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $5 = ((($1)) + 53|0);
        HEAP8[$5>>0] = 1;
        $6 = ((($1)) + 4|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = ($7|0)==($3|0);
        do {
            if ($8) {
                $9 = ((($1)) + 52|0);
                HEAP8[$9>>0] = 1;
                $10 = ((($1)) + 16|0);
                $11 = HEAP32[$10>>2]|0;
                $12 = ($11|0)==(0|0);
                if ($12) {
                    HEAP32[$10>>2] = $2;
                    $13 = ((($1)) + 24|0);
                    HEAP32[$13>>2] = $4;
                    $14 = ((($1)) + 36|0);
                    HEAP32[$14>>2] = 1;
                    $15 = ((($1)) + 48|0);
                    $16 = HEAP32[$15>>2]|0;
                    $17 = ($16|0)==(1);
                    $18 = ($4|0)==(1);
                    $or$cond = $17 & $18;
                    if (!($or$cond)) {
                        break;
                    }
                    $19 = ((($1)) + 54|0);
                    HEAP8[$19>>0] = 1;
                    break;
                }
                $20 = ($11|0)==($2|0);
                if (!($20)) {
                    $30 = ((($1)) + 36|0);
                    $31 = HEAP32[$30>>2]|0;
                    $32 = (($31) + 1)|0;
                    HEAP32[$30>>2] = $32;
                    $33 = ((($1)) + 54|0);
                    HEAP8[$33>>0] = 1;
                    break;
                }
                $21 = ((($1)) + 24|0);
                $22 = HEAP32[$21>>2]|0;
                $23 = ($22|0)==(2);
                if ($23) {
                    HEAP32[$21>>2] = $4;
                    $28 = $4;
                } else {
                    $28 = $22;
                }
                $24 = ((($1)) + 48|0);
                $25 = HEAP32[$24>>2]|0;
                $26 = ($25|0)==(1);
                $27 = ($28|0)==(1);
                $or$cond22 = $26 & $27;
                if ($or$cond22) {
                    $29 = ((($1)) + 54|0);
                    HEAP8[$29>>0] = 1;
                }
            }
        } while(0);
        return;
    }
    function ___dynamic_cast($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $$ = 0, $$0 = 0, $$33 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
        var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
        var $46 = 0, $47 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond28 = 0, $or$cond30 = 0, $or$cond32 = 0, dest = 0, label = 0, sp = 0, stop = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 64|0;
        $4 = sp;
        $5 = HEAP32[$0>>2]|0;
        $6 = ((($5)) + -8|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = (($0) + ($7)|0);
        $9 = ((($5)) + -4|0);
        $10 = HEAP32[$9>>2]|0;
        HEAP32[$4>>2] = $2;
        $11 = ((($4)) + 4|0);
        HEAP32[$11>>2] = $0;
        $12 = ((($4)) + 8|0);
        HEAP32[$12>>2] = $1;
        $13 = ((($4)) + 12|0);
        HEAP32[$13>>2] = $3;
        $14 = ((($4)) + 16|0);
        $15 = ((($4)) + 20|0);
        $16 = ((($4)) + 24|0);
        $17 = ((($4)) + 28|0);
        $18 = ((($4)) + 32|0);
        $19 = ((($4)) + 40|0);
        dest=$14; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));HEAP16[$14+36>>1]=0|0;HEAP8[$14+38>>0]=0|0;
        $20 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($10,$2,0)|0);
        L1: do {
            if ($20) {
                $21 = ((($4)) + 48|0);
                HEAP32[$21>>2] = 1;
                $22 = HEAP32[$10>>2]|0;
                $23 = ((($22)) + 20|0);
                $24 = HEAP32[$23>>2]|0;
                FUNCTION_TABLE_viiiiii[$24 & 3]($10,$4,$8,$8,1,0);
                $25 = HEAP32[$16>>2]|0;
                $26 = ($25|0)==(1);
                $$ = $26 ? $8 : 0;
                $$0 = $$;
            } else {
                $27 = ((($4)) + 36|0);
                $28 = HEAP32[$10>>2]|0;
                $29 = ((($28)) + 24|0);
                $30 = HEAP32[$29>>2]|0;
                FUNCTION_TABLE_viiiii[$30 & 3]($10,$4,$8,1,0);
                $31 = HEAP32[$27>>2]|0;
                switch ($31|0) {
                    case 0:  {
                        $32 = HEAP32[$19>>2]|0;
                        $33 = ($32|0)==(1);
                        $34 = HEAP32[$17>>2]|0;
                        $35 = ($34|0)==(1);
                        $or$cond = $33 & $35;
                        $36 = HEAP32[$18>>2]|0;
                        $37 = ($36|0)==(1);
                        $or$cond28 = $or$cond & $37;
                        $38 = HEAP32[$15>>2]|0;
                        $$33 = $or$cond28 ? $38 : 0;
                        $$0 = $$33;
                        break L1;
                        break;
                    }
                    case 1:  {
                        break;
                    }
                    default: {
                        $$0 = 0;
                        break L1;
                    }
                }
                $39 = HEAP32[$16>>2]|0;
                $40 = ($39|0)==(1);
                if (!($40)) {
                    $41 = HEAP32[$19>>2]|0;
                    $42 = ($41|0)==(0);
                    $43 = HEAP32[$17>>2]|0;
                    $44 = ($43|0)==(1);
                    $or$cond30 = $42 & $44;
                    $45 = HEAP32[$18>>2]|0;
                    $46 = ($45|0)==(1);
                    $or$cond32 = $or$cond30 & $46;
                    if (!($or$cond32)) {
                        $$0 = 0;
                        break;
                    }
                }
                $47 = HEAP32[$14>>2]|0;
                $$0 = $47;
            }
        } while(0);
        STACKTOP = sp;return ($$0|0);
    }
    function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
        __ZdlPv($0);
        return;
    }
    function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        $5 = $5|0;
        var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $6 = ((($1)) + 8|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
        if ($8) {
            __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
        } else {
            $9 = ((($0)) + 8|0);
            $10 = HEAP32[$9>>2]|0;
            $11 = HEAP32[$10>>2]|0;
            $12 = ((($11)) + 20|0);
            $13 = HEAP32[$12>>2]|0;
            FUNCTION_TABLE_viiiiii[$13 & 3]($10,$1,$2,$3,$4,$5);
        }
        return;
    }
    function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        var $$037$off038 = 0, $$037$off039 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
        var $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
        var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $5 = ((($1)) + 8|0);
        $6 = HEAP32[$5>>2]|0;
        $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
        do {
            if ($7) {
                __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
            } else {
                $8 = HEAP32[$1>>2]|0;
                $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
                if (!($9)) {
                    $43 = ((($0)) + 8|0);
                    $44 = HEAP32[$43>>2]|0;
                    $45 = HEAP32[$44>>2]|0;
                    $46 = ((($45)) + 24|0);
                    $47 = HEAP32[$46>>2]|0;
                    FUNCTION_TABLE_viiiii[$47 & 3]($44,$1,$2,$3,$4);
                    break;
                }
                $10 = ((($1)) + 16|0);
                $11 = HEAP32[$10>>2]|0;
                $12 = ($11|0)==($2|0);
                if (!($12)) {
                    $13 = ((($1)) + 20|0);
                    $14 = HEAP32[$13>>2]|0;
                    $15 = ($14|0)==($2|0);
                    if (!($15)) {
                        $18 = ((($1)) + 32|0);
                        HEAP32[$18>>2] = $3;
                        $19 = ((($1)) + 44|0);
                        $20 = HEAP32[$19>>2]|0;
                        $21 = ($20|0)==(4);
                        if ($21) {
                            break;
                        }
                        $22 = ((($1)) + 52|0);
                        HEAP8[$22>>0] = 0;
                        $23 = ((($1)) + 53|0);
                        HEAP8[$23>>0] = 0;
                        $24 = ((($0)) + 8|0);
                        $25 = HEAP32[$24>>2]|0;
                        $26 = HEAP32[$25>>2]|0;
                        $27 = ((($26)) + 20|0);
                        $28 = HEAP32[$27>>2]|0;
                        FUNCTION_TABLE_viiiiii[$28 & 3]($25,$1,$2,$2,1,$4);
                        $29 = HEAP8[$23>>0]|0;
                        $30 = ($29<<24>>24)==(0);
                        if ($30) {
                            $$037$off038 = 4;
                            label = 11;
                        } else {
                            $31 = HEAP8[$22>>0]|0;
                            $32 = ($31<<24>>24)==(0);
                            if ($32) {
                                $$037$off038 = 3;
                                label = 11;
                            } else {
                                $$037$off039 = 3;
                            }
                        }
                        if ((label|0) == 11) {
                            HEAP32[$13>>2] = $2;
                            $33 = ((($1)) + 40|0);
                            $34 = HEAP32[$33>>2]|0;
                            $35 = (($34) + 1)|0;
                            HEAP32[$33>>2] = $35;
                            $36 = ((($1)) + 36|0);
                            $37 = HEAP32[$36>>2]|0;
                            $38 = ($37|0)==(1);
                            if ($38) {
                                $39 = ((($1)) + 24|0);
                                $40 = HEAP32[$39>>2]|0;
                                $41 = ($40|0)==(2);
                                if ($41) {
                                    $42 = ((($1)) + 54|0);
                                    HEAP8[$42>>0] = 1;
                                    $$037$off039 = $$037$off038;
                                } else {
                                    $$037$off039 = $$037$off038;
                                }
                            } else {
                                $$037$off039 = $$037$off038;
                            }
                        }
                        HEAP32[$19>>2] = $$037$off039;
                        break;
                    }
                }
                $16 = ($3|0)==(1);
                if ($16) {
                    $17 = ((($1)) + 32|0);
                    HEAP32[$17>>2] = 1;
                }
            }
        } while(0);
        return;
    }
    function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = ((($1)) + 8|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
        if ($6) {
            __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
        } else {
            $7 = ((($0)) + 8|0);
            $8 = HEAP32[$7>>2]|0;
            $9 = HEAP32[$8>>2]|0;
            $10 = ((($9)) + 28|0);
            $11 = HEAP32[$10>>2]|0;
            FUNCTION_TABLE_viiii[$11 & 7]($8,$1,$2,$3);
        }
        return;
    }
    function __ZNSt9type_infoD2Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        return;
    }
    function __ZN10__cxxabiv123__fundamental_type_infoD0Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
        __ZdlPv($0);
        return;
    }
    function __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $3 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
        return ($3|0);
    }
    function __ZN10__cxxabiv119__pointer_type_infoD0Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
        __ZdlPv($0);
        return;
    }
    function __ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$0 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
        var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0;
        var $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, stop = 0;
        sp = STACKTOP;
        STACKTOP = STACKTOP + 64|0;
        $3 = sp;
        $4 = HEAP32[$2>>2]|0;
        $5 = HEAP32[$4>>2]|0;
        HEAP32[$2>>2] = $5;
        $6 = (__ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,0)|0);
        if ($6) {
            $$4 = 1;
        } else {
            $7 = ($1|0)==(0|0);
            if ($7) {
                $$4 = 0;
            } else {
                $8 = (___dynamic_cast($1,248,304,0)|0);
                $9 = ($8|0)==(0|0);
                if ($9) {
                    $$4 = 0;
                } else {
                    $10 = ((($8)) + 8|0);
                    $11 = HEAP32[$10>>2]|0;
                    $12 = ((($0)) + 8|0);
                    $13 = HEAP32[$12>>2]|0;
                    $14 = $13 ^ -1;
                    $15 = $11 & $14;
                    $16 = ($15|0)==(0);
                    if ($16) {
                        $17 = ((($0)) + 12|0);
                        $18 = HEAP32[$17>>2]|0;
                        $19 = ((($8)) + 12|0);
                        $20 = HEAP32[$19>>2]|0;
                        $21 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($18,$20,0)|0);
                        if ($21) {
                            $$4 = 1;
                        } else {
                            $22 = HEAP32[$17>>2]|0;
                            $23 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($22,336,0)|0);
                            if ($23) {
                                $$4 = 1;
                            } else {
                                $24 = HEAP32[$17>>2]|0;
                                $25 = ($24|0)==(0|0);
                                if ($25) {
                                    $$4 = 0;
                                } else {
                                    $26 = (___dynamic_cast($24,248,232,0)|0);
                                    $27 = ($26|0)==(0|0);
                                    if ($27) {
                                        $$4 = 0;
                                    } else {
                                        $28 = HEAP32[$19>>2]|0;
                                        $29 = ($28|0)==(0|0);
                                        if ($29) {
                                            $$4 = 0;
                                        } else {
                                            $30 = (___dynamic_cast($28,248,232,0)|0);
                                            $31 = ($30|0)==(0|0);
                                            if ($31) {
                                                $$4 = 0;
                                            } else {
                                                $32 = ((($3)) + 4|0);
                                                dest=$32; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
                                                HEAP32[$3>>2] = $30;
                                                $33 = ((($3)) + 8|0);
                                                HEAP32[$33>>2] = $26;
                                                $34 = ((($3)) + 12|0);
                                                HEAP32[$34>>2] = -1;
                                                $35 = ((($3)) + 48|0);
                                                HEAP32[$35>>2] = 1;
                                                $36 = HEAP32[$30>>2]|0;
                                                $37 = ((($36)) + 28|0);
                                                $38 = HEAP32[$37>>2]|0;
                                                $39 = HEAP32[$2>>2]|0;
                                                FUNCTION_TABLE_viiii[$38 & 7]($30,$3,$39,1);
                                                $40 = ((($3)) + 24|0);
                                                $41 = HEAP32[$40>>2]|0;
                                                $42 = ($41|0)==(1);
                                                if ($42) {
                                                    $43 = ((($3)) + 16|0);
                                                    $44 = HEAP32[$43>>2]|0;
                                                    HEAP32[$2>>2] = $44;
                                                    $$0 = 1;
                                                } else {
                                                    $$0 = 0;
                                                }
                                                $$4 = $$0;
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        $$4 = 0;
                    }
                }
            }
        }
        STACKTOP = sp;return ($$4|0);
    }
    function __ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        var $$0 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $3 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
        if ($3) {
            $$0 = 1;
        } else {
            $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($1,344,0)|0);
            $$0 = $4;
        }
        return ($$0|0);
    }
    function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($0) {
        $0 = $0|0;
        var label = 0, sp = 0;
        sp = STACKTOP;
        __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
        __ZdlPv($0);
        return;
    }
    function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        $5 = $5|0;
        var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
        var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $6 = ((($1)) + 8|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
        if ($8) {
            __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
        } else {
            $9 = ((($1)) + 52|0);
            $10 = HEAP8[$9>>0]|0;
            $11 = ((($1)) + 53|0);
            $12 = HEAP8[$11>>0]|0;
            $13 = ((($0)) + 16|0);
            $14 = ((($0)) + 12|0);
            $15 = HEAP32[$14>>2]|0;
            $16 = (((($0)) + 16|0) + ($15<<3)|0);
            HEAP8[$9>>0] = 0;
            HEAP8[$11>>0] = 0;
            __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($13,$1,$2,$3,$4,$5);
            $17 = ($15|0)>(1);
            L4: do {
                if ($17) {
                    $18 = ((($0)) + 24|0);
                    $19 = ((($1)) + 24|0);
                    $20 = ((($0)) + 8|0);
                    $21 = ((($1)) + 54|0);
                    $$0 = $18;
                    while(1) {
                        $22 = HEAP8[$21>>0]|0;
                        $23 = ($22<<24>>24)==(0);
                        if (!($23)) {
                            break L4;
                        }
                        $24 = HEAP8[$9>>0]|0;
                        $25 = ($24<<24>>24)==(0);
                        if ($25) {
                            $31 = HEAP8[$11>>0]|0;
                            $32 = ($31<<24>>24)==(0);
                            if (!($32)) {
                                $33 = HEAP32[$20>>2]|0;
                                $34 = $33 & 1;
                                $35 = ($34|0)==(0);
                                if ($35) {
                                    break L4;
                                }
                            }
                        } else {
                            $26 = HEAP32[$19>>2]|0;
                            $27 = ($26|0)==(1);
                            if ($27) {
                                break L4;
                            }
                            $28 = HEAP32[$20>>2]|0;
                            $29 = $28 & 2;
                            $30 = ($29|0)==(0);
                            if ($30) {
                                break L4;
                            }
                        }
                        HEAP8[$9>>0] = 0;
                        HEAP8[$11>>0] = 0;
                        __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$0,$1,$2,$3,$4,$5);
                        $36 = ((($$0)) + 8|0);
                        $37 = ($36>>>0)<($16>>>0);
                        if ($37) {
                            $$0 = $36;
                        } else {
                            break;
                        }
                    }
                }
            } while(0);
            HEAP8[$9>>0] = $10;
            HEAP8[$11>>0] = $12;
        }
        return;
    }
    function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        var $$0 = 0, $$081$off0 = 0, $$084 = 0, $$085$off0 = 0, $$1 = 0, $$182$off0 = 0, $$186$off0 = 0, $$2 = 0, $$283$off0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
        var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0;
        var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
        var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
        var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $5 = ((($1)) + 8|0);
        $6 = HEAP32[$5>>2]|0;
        $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
        L1: do {
            if ($7) {
                __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
            } else {
                $8 = HEAP32[$1>>2]|0;
                $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
                if (!($9)) {
                    $56 = ((($0)) + 16|0);
                    $57 = ((($0)) + 12|0);
                    $58 = HEAP32[$57>>2]|0;
                    $59 = (((($0)) + 16|0) + ($58<<3)|0);
                    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($56,$1,$2,$3,$4);
                    $60 = ((($0)) + 24|0);
                    $61 = ($58|0)>(1);
                    if (!($61)) {
                        break;
                    }
                    $62 = ((($0)) + 8|0);
                    $63 = HEAP32[$62>>2]|0;
                    $64 = $63 & 2;
                    $65 = ($64|0)==(0);
                    if ($65) {
                        $66 = ((($1)) + 36|0);
                        $67 = HEAP32[$66>>2]|0;
                        $68 = ($67|0)==(1);
                        if (!($68)) {
                            $74 = $63 & 1;
                            $75 = ($74|0)==(0);
                            if ($75) {
                                $78 = ((($1)) + 54|0);
                                $$2 = $60;
                                while(1) {
                                    $87 = HEAP8[$78>>0]|0;
                                    $88 = ($87<<24>>24)==(0);
                                    if (!($88)) {
                                        break L1;
                                    }
                                    $89 = HEAP32[$66>>2]|0;
                                    $90 = ($89|0)==(1);
                                    if ($90) {
                                        break L1;
                                    }
                                    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$2,$1,$2,$3,$4);
                                    $91 = ((($$2)) + 8|0);
                                    $92 = ($91>>>0)<($59>>>0);
                                    if ($92) {
                                        $$2 = $91;
                                    } else {
                                        break L1;
                                    }
                                }
                            }
                            $76 = ((($1)) + 24|0);
                            $77 = ((($1)) + 54|0);
                            $$1 = $60;
                            while(1) {
                                $79 = HEAP8[$77>>0]|0;
                                $80 = ($79<<24>>24)==(0);
                                if (!($80)) {
                                    break L1;
                                }
                                $81 = HEAP32[$66>>2]|0;
                                $82 = ($81|0)==(1);
                                if ($82) {
                                    $83 = HEAP32[$76>>2]|0;
                                    $84 = ($83|0)==(1);
                                    if ($84) {
                                        break L1;
                                    }
                                }
                                __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$1,$1,$2,$3,$4);
                                $85 = ((($$1)) + 8|0);
                                $86 = ($85>>>0)<($59>>>0);
                                if ($86) {
                                    $$1 = $85;
                                } else {
                                    break L1;
                                }
                            }
                        }
                    }
                    $69 = ((($1)) + 54|0);
                    $$0 = $60;
                    while(1) {
                        $70 = HEAP8[$69>>0]|0;
                        $71 = ($70<<24>>24)==(0);
                        if (!($71)) {
                            break L1;
                        }
                        __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$0,$1,$2,$3,$4);
                        $72 = ((($$0)) + 8|0);
                        $73 = ($72>>>0)<($59>>>0);
                        if ($73) {
                            $$0 = $72;
                        } else {
                            break L1;
                        }
                    }
                }
                $10 = ((($1)) + 16|0);
                $11 = HEAP32[$10>>2]|0;
                $12 = ($11|0)==($2|0);
                if (!($12)) {
                    $13 = ((($1)) + 20|0);
                    $14 = HEAP32[$13>>2]|0;
                    $15 = ($14|0)==($2|0);
                    if (!($15)) {
                        $18 = ((($1)) + 32|0);
                        HEAP32[$18>>2] = $3;
                        $19 = ((($1)) + 44|0);
                        $20 = HEAP32[$19>>2]|0;
                        $21 = ($20|0)==(4);
                        if ($21) {
                            break;
                        }
                        $22 = ((($0)) + 16|0);
                        $23 = ((($0)) + 12|0);
                        $24 = HEAP32[$23>>2]|0;
                        $25 = (((($0)) + 16|0) + ($24<<3)|0);
                        $26 = ((($1)) + 52|0);
                        $27 = ((($1)) + 53|0);
                        $28 = ((($1)) + 54|0);
                        $29 = ((($0)) + 8|0);
                        $30 = ((($1)) + 24|0);
                        $$081$off0 = 0;$$084 = $22;$$085$off0 = 0;
                        L32: while(1) {
                            $31 = ($$084>>>0)<($25>>>0);
                            if (!($31)) {
                                $$283$off0 = $$081$off0;
                                label = 18;
                                break;
                            }
                            HEAP8[$26>>0] = 0;
                            HEAP8[$27>>0] = 0;
                            __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$084,$1,$2,$2,1,$4);
                            $32 = HEAP8[$28>>0]|0;
                            $33 = ($32<<24>>24)==(0);
                            if (!($33)) {
                                $$283$off0 = $$081$off0;
                                label = 18;
                                break;
                            }
                            $34 = HEAP8[$27>>0]|0;
                            $35 = ($34<<24>>24)==(0);
                            do {
                                if ($35) {
                                    $$182$off0 = $$081$off0;$$186$off0 = $$085$off0;
                                } else {
                                    $36 = HEAP8[$26>>0]|0;
                                    $37 = ($36<<24>>24)==(0);
                                    if ($37) {
                                        $43 = HEAP32[$29>>2]|0;
                                        $44 = $43 & 1;
                                        $45 = ($44|0)==(0);
                                        if ($45) {
                                            $$283$off0 = 1;
                                            label = 18;
                                            break L32;
                                        } else {
                                            $$182$off0 = 1;$$186$off0 = $$085$off0;
                                            break;
                                        }
                                    }
                                    $38 = HEAP32[$30>>2]|0;
                                    $39 = ($38|0)==(1);
                                    if ($39) {
                                        label = 23;
                                        break L32;
                                    }
                                    $40 = HEAP32[$29>>2]|0;
                                    $41 = $40 & 2;
                                    $42 = ($41|0)==(0);
                                    if ($42) {
                                        label = 23;
                                        break L32;
                                    } else {
                                        $$182$off0 = 1;$$186$off0 = 1;
                                    }
                                }
                            } while(0);
                            $46 = ((($$084)) + 8|0);
                            $$081$off0 = $$182$off0;$$084 = $46;$$085$off0 = $$186$off0;
                        }
                        do {
                            if ((label|0) == 18) {
                                if (!($$085$off0)) {
                                    HEAP32[$13>>2] = $2;
                                    $47 = ((($1)) + 40|0);
                                    $48 = HEAP32[$47>>2]|0;
                                    $49 = (($48) + 1)|0;
                                    HEAP32[$47>>2] = $49;
                                    $50 = ((($1)) + 36|0);
                                    $51 = HEAP32[$50>>2]|0;
                                    $52 = ($51|0)==(1);
                                    if ($52) {
                                        $53 = HEAP32[$30>>2]|0;
                                        $54 = ($53|0)==(2);
                                        if ($54) {
                                            HEAP8[$28>>0] = 1;
                                            if ($$283$off0) {
                                                label = 23;
                                                break;
                                            } else {
                                                $55 = 4;
                                                break;
                                            }
                                        }
                                    }
                                }
                                if ($$283$off0) {
                                    label = 23;
                                } else {
                                    $55 = 4;
                                }
                            }
                        } while(0);
                        if ((label|0) == 23) {
                            $55 = 3;
                        }
                        HEAP32[$19>>2] = $55;
                        break;
                    }
                }
                $16 = ($3|0)==(1);
                if ($16) {
                    $17 = ((($1)) + 32|0);
                    HEAP32[$17>>2] = 1;
                }
            }
        } while(0);
        return;
    }
    function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = ((($1)) + 8|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
        L1: do {
            if ($6) {
                __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
            } else {
                $7 = ((($0)) + 16|0);
                $8 = ((($0)) + 12|0);
                $9 = HEAP32[$8>>2]|0;
                $10 = (((($0)) + 16|0) + ($9<<3)|0);
                __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($7,$1,$2,$3);
                $11 = ($9|0)>(1);
                if ($11) {
                    $12 = ((($0)) + 24|0);
                    $13 = ((($1)) + 54|0);
                    $$0 = $12;
                    while(1) {
                        __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($$0,$1,$2,$3);
                        $14 = HEAP8[$13>>0]|0;
                        $15 = ($14<<24>>24)==(0);
                        if (!($15)) {
                            break L1;
                        }
                        $16 = ((($$0)) + 8|0);
                        $17 = ($16>>>0)<($10>>>0);
                        if ($17) {
                            $$0 = $16;
                        } else {
                            break;
                        }
                    }
                }
            }
        } while(0);
        return;
    }
    function __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $4 = ((($0)) + 4|0);
        $5 = HEAP32[$4>>2]|0;
        $6 = $5 >> 8;
        $7 = $5 & 1;
        $8 = ($7|0)==(0);
        if ($8) {
            $$0 = $6;
        } else {
            $9 = HEAP32[$2>>2]|0;
            $10 = (($9) + ($6)|0);
            $11 = HEAP32[$10>>2]|0;
            $$0 = $11;
        }
        $12 = HEAP32[$0>>2]|0;
        $13 = HEAP32[$12>>2]|0;
        $14 = ((($13)) + 28|0);
        $15 = HEAP32[$14>>2]|0;
        $16 = (($2) + ($$0)|0);
        $17 = $5 & 2;
        $18 = ($17|0)!=(0);
        $19 = $18 ? $3 : 2;
        FUNCTION_TABLE_viiii[$15 & 7]($12,$1,$16,$19);
        return;
    }
    function __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        $5 = $5|0;
        var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $6 = ((($0)) + 4|0);
        $7 = HEAP32[$6>>2]|0;
        $8 = $7 >> 8;
        $9 = $7 & 1;
        $10 = ($9|0)==(0);
        if ($10) {
            $$0 = $8;
        } else {
            $11 = HEAP32[$3>>2]|0;
            $12 = (($11) + ($8)|0);
            $13 = HEAP32[$12>>2]|0;
            $$0 = $13;
        }
        $14 = HEAP32[$0>>2]|0;
        $15 = HEAP32[$14>>2]|0;
        $16 = ((($15)) + 20|0);
        $17 = HEAP32[$16>>2]|0;
        $18 = (($3) + ($$0)|0);
        $19 = $7 & 2;
        $20 = ($19|0)!=(0);
        $21 = $20 ? $4 : 2;
        FUNCTION_TABLE_viiiiii[$17 & 3]($14,$1,$2,$18,$21,$5);
        return;
    }
    function __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
        $0 = $0|0;
        $1 = $1|0;
        $2 = $2|0;
        $3 = $3|0;
        $4 = $4|0;
        var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $5 = ((($0)) + 4|0);
        $6 = HEAP32[$5>>2]|0;
        $7 = $6 >> 8;
        $8 = $6 & 1;
        $9 = ($8|0)==(0);
        if ($9) {
            $$0 = $7;
        } else {
            $10 = HEAP32[$2>>2]|0;
            $11 = (($10) + ($7)|0);
            $12 = HEAP32[$11>>2]|0;
            $$0 = $12;
        }
        $13 = HEAP32[$0>>2]|0;
        $14 = HEAP32[$13>>2]|0;
        $15 = ((($14)) + 24|0);
        $16 = HEAP32[$15>>2]|0;
        $17 = (($2) + ($$0)|0);
        $18 = $6 & 2;
        $19 = ($18|0)!=(0);
        $20 = $19 ? $3 : 2;
        FUNCTION_TABLE_viiiii[$16 & 3]($13,$1,$17,$20,$4);
        return;
    }
    function __ZSt15get_new_handlerv() {
        var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
        sp = STACKTOP;
        $0 = HEAP32[763]|0;
        $1 = (($0) + 0)|0;
        HEAP32[763] = $1;
        $2 = $0;
        return ($2|0);
    }
    function runPostSets() {
    }
    function _memcpy(dest, src, num) {
        dest = dest|0; src = src|0; num = num|0;
        var ret = 0;
        var aligned_dest_end = 0;
        var block_aligned_dest_end = 0;
        var dest_end = 0;
        // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
        if ((num|0) >=
            8192
        ) {
            return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
        }

        ret = dest|0;
        dest_end = (dest + num)|0;
        if ((dest&3) == (src&3)) {
            // The initial unaligned < 4-byte front.
            while (dest & 3) {
                if ((num|0) == 0) return ret|0;
                HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
                dest = (dest+1)|0;
                src = (src+1)|0;
                num = (num-1)|0;
            }
            aligned_dest_end = (dest_end & -4)|0;
            block_aligned_dest_end = (aligned_dest_end - 64)|0;
            while ((dest|0) <= (block_aligned_dest_end|0) ) {
                HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
                HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
                HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
                HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
                HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
                HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
                HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
                HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
                HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
                HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
                HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
                HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
                HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
                HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
                HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
                HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
                dest = (dest+64)|0;
                src = (src+64)|0;
            }
            while ((dest|0) < (aligned_dest_end|0) ) {
                HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
                dest = (dest+4)|0;
                src = (src+4)|0;
            }
        } else {
            // In the unaligned copy case, unroll a bit as well.
            aligned_dest_end = (dest_end - 4)|0;
            while ((dest|0) < (aligned_dest_end|0) ) {
                HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
                HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
                HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
                HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
                dest = (dest+4)|0;
                src = (src+4)|0;
            }
        }
        // The remaining unaligned < 4 byte tail.
        while ((dest|0) < (dest_end|0)) {
            HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
            dest = (dest+1)|0;
            src = (src+1)|0;
        }
        return ret|0;
    }
    function _memset(ptr, value, num) {
        ptr = ptr|0; value = value|0; num = num|0;
        var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
        end = (ptr + num)|0;

        value = value & 0xff;
        if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
            while ((ptr&3) != 0) {
                HEAP8[((ptr)>>0)]=value;
                ptr = (ptr+1)|0;
            }

            aligned_end = (end & -4)|0;
            block_aligned_end = (aligned_end - 64)|0;
            value4 = value | (value << 8) | (value << 16) | (value << 24);

            while((ptr|0) <= (block_aligned_end|0)) {
                HEAP32[((ptr)>>2)]=value4;
                HEAP32[(((ptr)+(4))>>2)]=value4;
                HEAP32[(((ptr)+(8))>>2)]=value4;
                HEAP32[(((ptr)+(12))>>2)]=value4;
                HEAP32[(((ptr)+(16))>>2)]=value4;
                HEAP32[(((ptr)+(20))>>2)]=value4;
                HEAP32[(((ptr)+(24))>>2)]=value4;
                HEAP32[(((ptr)+(28))>>2)]=value4;
                HEAP32[(((ptr)+(32))>>2)]=value4;
                HEAP32[(((ptr)+(36))>>2)]=value4;
                HEAP32[(((ptr)+(40))>>2)]=value4;
                HEAP32[(((ptr)+(44))>>2)]=value4;
                HEAP32[(((ptr)+(48))>>2)]=value4;
                HEAP32[(((ptr)+(52))>>2)]=value4;
                HEAP32[(((ptr)+(56))>>2)]=value4;
                HEAP32[(((ptr)+(60))>>2)]=value4;
                ptr = (ptr + 64)|0;
            }

            while ((ptr|0) < (aligned_end|0) ) {
                HEAP32[((ptr)>>2)]=value4;
                ptr = (ptr+4)|0;
            }
        }
        // The remaining bytes.
        while ((ptr|0) < (end|0)) {
            HEAP8[((ptr)>>0)]=value;
            ptr = (ptr+1)|0;
        }
        return (end-num)|0;
    }
    function _sbrk(increment) {
        increment = increment|0;
        var oldDynamicTop = 0;
        var oldDynamicTopOnChange = 0;
        var newDynamicTop = 0;
        var totalMemory = 0;
        oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
        newDynamicTop = oldDynamicTop + increment | 0;

        if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
            | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
            abortOnCannotGrowMemory()|0;
            ___setErrNo(12);
            return -1;
        }

        HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
        totalMemory = getTotalMemory()|0;
        if ((newDynamicTop|0) > (totalMemory|0)) {
            if ((enlargeMemory()|0) == 0) {
                HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
                ___setErrNo(12);
                return -1;
            }
        }
        return oldDynamicTop|0;
    }


    function dynCall_i(index) {
        index = index|0;

        return FUNCTION_TABLE_i[index&1]()|0;
    }


    function dynCall_ii(index,a1) {
        index = index|0;
        a1=a1|0;
        return FUNCTION_TABLE_ii[index&3](a1|0)|0;
    }


    function dynCall_iii(index,a1,a2) {
        index = index|0;
        a1=a1|0; a2=a2|0;
        return FUNCTION_TABLE_iii[index&1](a1|0,a2|0)|0;
    }


    function dynCall_iiii(index,a1,a2,a3) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0;
        return FUNCTION_TABLE_iiii[index&3](a1|0,a2|0,a3|0)|0;
    }


    function dynCall_iiiii(index,a1,a2,a3,a4) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
        return FUNCTION_TABLE_iiiii[index&1](a1|0,a2|0,a3|0,a4|0)|0;
    }


    function dynCall_iiiiii(index,a1,a2,a3,a4,a5) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
        return FUNCTION_TABLE_iiiiii[index&1](a1|0,a2|0,a3|0,a4|0,a5|0)|0;
    }


    function dynCall_v(index) {
        index = index|0;

        FUNCTION_TABLE_v[index&0]();
    }


    function dynCall_vi(index,a1) {
        index = index|0;
        a1=a1|0;
        FUNCTION_TABLE_vi[index&15](a1|0);
    }


    function dynCall_vii(index,a1,a2) {
        index = index|0;
        a1=a1|0; a2=a2|0;
        FUNCTION_TABLE_vii[index&7](a1|0,a2|0);
    }


    function dynCall_viii(index,a1,a2,a3) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0;
        FUNCTION_TABLE_viii[index&3](a1|0,a2|0,a3|0);
    }


    function dynCall_viiii(index,a1,a2,a3,a4) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
        FUNCTION_TABLE_viiii[index&7](a1|0,a2|0,a3|0,a4|0);
    }


    function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
        FUNCTION_TABLE_viiiii[index&3](a1|0,a2|0,a3|0,a4|0,a5|0);
    }


    function dynCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
        index = index|0;
        a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
        FUNCTION_TABLE_viiiiii[index&3](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0);
    }

    function b0() {
        ; abort(0);return 0;
    }
    function b1(p0) {
        p0 = p0|0; abort(1);return 0;
    }
    function b2(p0,p1) {
        p0 = p0|0;p1 = p1|0; abort(2);return 0;
    }
    function b3(p0,p1,p2) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(3);return 0;
    }
    function b4(p0,p1,p2,p3) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; abort(4);return 0;
    }
    function b5(p0,p1,p2,p3,p4) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; abort(5);return 0;
    }
    function b6() {
        ; abort(6);
    }
    function b7(p0) {
        p0 = p0|0; abort(7);
    }
    function b8(p0,p1) {
        p0 = p0|0;p1 = p1|0; abort(8);
    }
    function b9(p0,p1,p2) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0; abort(9);
    }
    function b10(p0,p1,p2,p3) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; abort(10);
    }
    function b11(p0,p1,p2,p3,p4) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; abort(11);
    }
    function b12(p0,p1,p2,p3,p4,p5) {
        p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; abort(12);
    }

// EMSCRIPTEN_END_FUNCS
    var FUNCTION_TABLE_i = [b0,__ZN10emscripten8internal12operator_newI6QStateJEEEPT_DpOT0_];
    var FUNCTION_TABLE_ii = [b1,__ZN10emscripten8internal13getActualTypeI6QStateEEPKvPT_,__ZN10emscripten8internal7InvokerIP6QStateJEE6invokeEPFS3_vE,b1];
    var FUNCTION_TABLE_iii = [b2,__ZN10emscripten8internal7InvokerI6QStateJRKS2_EE6invokeEPFS2_S4_EPS2_];
    var FUNCTION_TABLE_iiii = [b3,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv];
    var FUNCTION_TABLE_iiiii = [b4,__Z7measureR6QStatelib];
    var FUNCTION_TABLE_iiiiii = [b5,__ZN10emscripten8internal7InvokerIiJR6QStatelibEE6invokeEPFiS3_libEPS2_lib];
    var FUNCTION_TABLE_v = [b6];
    var FUNCTION_TABLE_vi = [b7,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,__ZN10__cxxabiv120__si_class_type_infoD0Ev,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,__ZN10__cxxabiv119__pointer_type_infoD0Ev,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,__ZN10emscripten8internal14raw_destructorI6QStateEEvPT_,__Z10free_stateR6QState,b7,b7,b7,b7,b7];
    var FUNCTION_TABLE_vii = [b8,__Z9initstae_R6QStatel,__Z8hadamardR6QStatel,__Z5phaseR6QStatel,__Z11clone_stateRK6QState,__ZN10emscripten8internal7InvokerIvJR6QStateEE6invokeEPFvS3_EPS2_,b8,b8];
    var FUNCTION_TABLE_viii = [b9,__Z4cnotR6QStatell,__ZN10emscripten8internal7InvokerIvJR6QStatelEE6invokeEPFvS3_lEPS2_l,b9];
    var FUNCTION_TABLE_viiii = [b10,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,__ZN10emscripten8internal7InvokerIvJR6QStatellEE6invokeEPFvS3_llEPS2_ll,b10,b10,b10];
    var FUNCTION_TABLE_viiiii = [b11,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib];
    var FUNCTION_TABLE_viiiiii = [b12,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib];

    return { __GLOBAL__sub_I_bind_cpp: __GLOBAL__sub_I_bind_cpp, __GLOBAL__sub_I_chp_src_cpp: __GLOBAL__sub_I_chp_src_cpp, ___errno_location: ___errno_location, ___getTypeName: ___getTypeName, _free: _free, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_i: dynCall_i, dynCall_ii: dynCall_ii, dynCall_iii: dynCall_iii, dynCall_iiii: dynCall_iiii, dynCall_iiiii: dynCall_iiiii, dynCall_iiiiii: dynCall_iiiiii, dynCall_v: dynCall_v, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_viii: dynCall_viii, dynCall_viiii: dynCall_viiii, dynCall_viiiii: dynCall_viiiii, dynCall_viiiiii: dynCall_viiiiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
var __GLOBAL__sub_I_chp_src_cpp = Module["__GLOBAL__sub_I_chp_src_cpp"] = asm["__GLOBAL__sub_I_chp_src_cpp"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var _free = Module["_free"] = asm["_free"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iiiii = Module["dynCall_iiiii"] = asm["dynCall_iiiii"];
var dynCall_iiiiii = Module["dynCall_iiiiii"] = asm["dynCall_iiiiii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viii = Module["dynCall_viii"] = asm["dynCall_viii"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;




































































if (memoryInitializer) {
    if (!isDataURI(memoryInitializer)) {
        if (typeof Module['locateFile'] === 'function') {
            memoryInitializer = Module['locateFile'](memoryInitializer);
        } else if (Module['memoryInitializerPrefixURL']) {
            memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
        }
    }
    if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
        var data = Module['readBinary'](memoryInitializer);
        HEAPU8.set(data, GLOBAL_BASE);
    } else {
        addRunDependency('memory initializer');
        var applyMemoryInitializer = function(data) {
            if (data.byteLength) data = new Uint8Array(data);
            HEAPU8.set(data, GLOBAL_BASE);
            // Delete the typed array that contains the large blob of the memory initializer request response so that
            // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
            // its .status field can still be accessed later.
            if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
            removeRunDependency('memory initializer');
        }
        function doBrowserLoad() {
            Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
                throw 'could not load memory initializer ' + memoryInitializer;
            });
        }
        var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
        if (memoryInitializerBytes) {
            applyMemoryInitializer(memoryInitializerBytes.buffer);
        } else
        if (Module['memoryInitializerRequest']) {
            // a network request has already been created, just use that
            function useRequest() {
                var request = Module['memoryInitializerRequest'];
                var response = request.response;
                if (request.status !== 200 && request.status !== 0) {
                    var data = tryParseAsDataURI(Module['memoryInitializerRequestURL']);
                    if (data) {
                        response = data.buffer;
                    } else {
                        // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
                        // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
                        // Look in your browser's devtools network console to see what's going on.
                        console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
                        doBrowserLoad();
                        return;
                    }
                }
                applyMemoryInitializer(response);
            }
            if (Module['memoryInitializerRequest'].response) {
                setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
            } else {
                Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
            }
        } else {
            // fetch it from the network ourselves
            doBrowserLoad();
        }
    }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = "Program terminated with exit(" + status + ")";
    this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
    // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
    if (!Module['calledRun']) run();
    if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
    args = args || Module['arguments'];

    if (runDependencies > 0) {
        return;
    }


    preRun();

    if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
    if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

    function doRun() {
        if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
        Module['calledRun'] = true;

        if (ABORT) return;

        ensureInitRuntime();

        preMain();

        if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();


        postRun();
    }

    if (Module['setStatus']) {
        Module['setStatus']('Running...');
        setTimeout(function() {
            setTimeout(function() {
                Module['setStatus']('');
            }, 1);
            doRun();
        }, 1);
    } else {
        doRun();
    }
}
Module['run'] = run;


function exit(status, implicit) {

    // if this is just main exit-ing implicitly, and the status is 0, then we
    // don't need to do anything here and can just leave. if the status is
    // non-zero, though, then we need to report it.
    // (we may have warned about this earlier, if a situation justifies doing so)
    if (implicit && Module['noExitRuntime'] && status === 0) {
        return;
    }

    if (Module['noExitRuntime']) {
    } else {

        ABORT = true;
        EXITSTATUS = status;
        STACKTOP = initialStackTop;

        exitRuntime();

        if (Module['onExit']) Module['onExit'](status);
    }

    if (ENVIRONMENT_IS_NODE) {
        process['exit'](status);
    }
    Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = exit;

var abortDecorators = [];

function abort(what) {
    if (Module['onAbort']) {
        Module['onAbort'](what);
    }

    if (what !== undefined) {
        Module.print(what);
        Module.printErr(what);
        what = JSON.stringify(what)
    } else {
        what = '';
    }

    ABORT = true;
    EXITSTATUS = 1;

    throw 'abort(' + what + '). Build with -s ASSERTIONS=1 for more info.';
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
    if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
    while (Module['preInit'].length > 0) {
        Module['preInit'].pop()();
    }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



let QState = Module.QState;
let init_state = Module.init_state;
let free_state = Module.free_state;
let cnot = Module.cnot;
let hadamard = Module.hadamard;
let phase = Module.phase;
let measure = Module.measure;
let clone_state = Module.clone_state;
export {QState, init_state, free_state, cnot, hadamard, phase, clone_state, measure}
