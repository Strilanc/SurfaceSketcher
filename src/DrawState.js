import {DetailedError} from 'src/base/DetailedError.js'
import {describe} from "src/base/Describe.js";
import {Point} from "src/geo/Point.js";
import {Camera} from "src/geo/Camera.js";
import {UnitCellMap} from "src/braid/UnitCellMap.js";
import {PlumbingPieces} from "src/braid/PlumbingPieces.js";
import {Sockets} from "src/braid/Sockets.js";
import {equate} from "src/base/Equate.js";
import {LocalizedPlumbingPiece} from "src/braid/LocalizedPlumbingPiece.js";
import {Reader, Writer} from "src/base/Serialize.js";

class DrawState {
    /**
     * @param {!Camera} camera
     * @param {!int} codeDistance
     * @param {!UnitCellMap} cellMap
     * @param {!boolean} drawBraids
     * @param {!boolean} drawOps
     * @param {undefined|!LocalizedPlumbingPiece} selectedPiece
     * @param {!int} focusedLayer
     */
    constructor(camera, codeDistance, cellMap, drawBraids, drawOps, selectedPiece, focusedLayer=0) {
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
        /** @type {undefined|!LocalizedPlumbingPiece} */
        this.selectedPiece = selectedPiece;
        /** @type {int} */
        this.focusedLayer = focusedLayer;
    }

    /**
     * @param {!Writer} out
     */
    write(out) {
        this.camera.write(out);
        out.writeInt8(this.codeDistance);
        this.cellMap.write(out);
        out.writeBooleans(this.drawBraids, this.drawOps);
        out.writeInt32(this.focusedLayer)
    }

    /**
     * @param {!Reader} inp
     * @returns {!DrawState}
     */
    static read(inp) {
        if (inp.isEndOfInput()) {
            return DrawState.defaultValue();
        }
        let camera = Camera.read(inp);
        let codeDistance = inp.readInt8();
        let cellMap = UnitCellMap.read(inp);
        let [drawBraids, drawOps] = inp.readBooleans(2);
        let focusedLayer = inp.isEndOfInput() ? 0 : inp.readInt32();
        return new DrawState(camera, codeDistance, cellMap, drawBraids, drawOps, undefined, focusedLayer);
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
            false,
            undefined);
        result.fillSlot(new Point(0, 0, 0), Sockets.XPrimal);
        result.fillSlot(new Point(0, 0, 1), Sockets.XPrimal);
        result.fillSlot(new Point(0, 0, 1), Sockets.YPrimal);
        result.fillSlot(new Point(0, 1, 0), Sockets.ZPrimal);
        result.fillSlot(new Point(0, 1, 0), Sockets.ZDual);
        return result;
    }

    /**
     * @param {!Point} loc
     * @param {!UnitCellSocket} socket
     */
    fillSlot(loc, socket) {
        this.cellMap.cell(loc).pieces.set(socket, PlumbingPieces.Defaults.get(socket));
        this.addImpliedNeighbors(loc, socket)
    }

    /**
     * @param {!Point} loc
     * @param {!UnitCellSocket} socket
     */
    removeIfLonely(loc, socket) {
        for (let n of socket.neighbors.values()) {
            let loc2 = n.inNextCell ? loc.plus(n.dir) : loc;
            let unitCell2 = this.cellMap.cell(loc2);
            let piece2 = unitCell2.pieces.get(n.socket);
            if (piece2 !== undefined) {
                return;
            }
        }
        let unitCell = this.cellMap.cell(loc);
        unitCell.pieces.delete(socket);
    }

    /**
     * @param {!Point} loc
     * @param {!UnitCellSocket} socket
     */
    addImpliedNeighbors(loc, socket) {
        for (let n of socket.impliedNeighbors) {
            let loc2 = n.inNextCell ? loc.plus(n.dir) : loc;
            let unitCell2 = this.cellMap.cell(loc2);
            let piece2 = unitCell2.pieces.get(n.socket);
            if (piece2 === undefined) {
                unitCell2.pieces.set(n.socket, PlumbingPieces.Defaults.get(n.socket));
            }
        }
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
            this.drawOps,
            this.selectedPiece,
            this.focusedLayer);
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
            this.drawOps === other.drawOps &&
            equate(this.selectedPiece, other.selectedPiece) &&
            this.focusedLayer === other.focusedLayer;
    }
}

export {DrawState}
