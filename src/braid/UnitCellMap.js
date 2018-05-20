import {DetailedError} from 'src/base/DetailedError.js'
import {GeneralMap} from 'src/base/GeneralMap.js'
import {GeneralSet} from 'src/base/GeneralSet.js'
import {UnitCell} from 'src/braid/UnitCell.js'
import {Point} from "src/geo/Point.js";
import {Ray} from "src/geo/Ray.js";
import {Sockets} from "src/braid/Sockets.js";
import {LocalizedPlumbingPiece} from "src/braid/LocalizedPlumbingPiece.js";
import {PlumbingPieces} from "src/braid/PlumbingPieces.js"

class UnitCellMap {
    /**
     * @param {!GeneralMap.<!Point, !UnitCell>} cells
     */
    constructor(cells = new GeneralMap()) {
        this.cells = cells;
    }

    /**
     * @param {!Writer} out
     */
    write(out) {
        this.cells.write(
            out,
            loc => loc.write(out),
            unitCell => unitCell.pieces.write(
                out,
                socket => out.writeAsciiString(socket.name),
                piece => out.writeAsciiString(piece.name)));
    }

    /**
     * @param {!Reader} inp
     * @returns {!UnitCellMap}
     */
    static read(inp) {
        return new UnitCellMap(GeneralMap.read(
            inp,
            () => Point.read(inp),
            () => new UnitCell(GeneralMap.read(
                inp,
                () => Sockets.forceGetByName(inp.readAsciiString()),
                () => PlumbingPieces.forceGetByName(inp.readAsciiString())))));
    }

    /**
     * @param {!Point} pt
     * @param {!boolean} do_not_modify
     * @returns {!UnitCell}
     */
    cell(pt, do_not_modify=false) {
        let result = this.cells.get(pt);
        if (result === undefined) {
            result = new UnitCell();
            if (!do_not_modify) {
                this.cells.set(pt, result);
            }
        }
        return result;
    }

    /**
     * @returns {!{minX: !int, minY: !int, minZ: !int, maxX: !int, maxY: !int, maxZ: !int}}
     */
    bounds() {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        for (let pt of this.cells.keys()) {
            minX = Math.min(minX, pt.x);
            minY = Math.min(minY, pt.y);
            minZ = Math.min(minZ, pt.z);
            maxX = Math.max(maxX, pt.x);
            maxY = Math.max(maxY, pt.y);
            maxZ = Math.max(maxZ, pt.z);
        }
        return {minX, minY, minZ, maxX, maxY, maxZ};
    }

    /**
     * @returns {!Array.<!LocalizedPlumbingPiece>}
     */
    allLocalizedPieces() {
        let pieces = [];
        for (let [offset, unitCell] of this.cells.entries()) {
            for (let [socket, piece] of unitCell.pieces.entries()) {
                if (piece !== undefined) {
                    pieces.push(new LocalizedPlumbingPiece(offset, socket, piece));
                }
            }
        }
        return pieces;
    }

    /**
     * @returns {!Array.<[!Vector, !LocalizedPlumbingPiece]>}
     */
    allNeighbors() {
        let result = [];
        for (let locPiece of this.allLocalizedPieces()) {
            for (let [dir, neighbor] of locPiece.socket.neighbors.entries()) {
                let newLoc = neighbor.inNextCell ? locPiece.loc.plus(dir) : locPiece.loc;
                result.push([dir, new LocalizedPlumbingPiece(
                    newLoc,
                    neighbor.socket,
                    PlumbingPieces.Defaults.get(neighbor.socket))]);
            }
        }
        return result;
    }

    /**
     * @param {!SimulationResults} simResults
     * @returns {!Array.<!RenderData>}
     */
    renderData(simResults) {
        let result = [];
        for (let e of this.allLocalizedPieces()) {
            result.push(...e.piece.toLocalizedRenderData(e, simResults));
        }
        return result;
    }

    /**
     * @param {!Ray} ray
     * @returns {!{collisionPoint: !Point, piece: !LocalizedPlumbingPiece, isNew: !boolean}}
     */
    intersect(ray) {
        let bestPiece = undefined;
        let bestPt = undefined;
        let bestNew = undefined;
        for (let piece of this.allLocalizedPieces()) {
            let pt = ray.intersectBox(piece.toBox(), 0.001);
            if (pt !== undefined) {
                if (bestPt === undefined || ray.firstPoint([bestPt, pt]) === pt) {
                    bestPiece = piece;
                    bestPt = pt;
                    bestNew = false;
                }
            }
        }
        for (let [dir, localizedPiece] of this.allNeighbors()) {
            let pt = ray.intersectBox(localizedPiece.toNeighborExtensionBox(dir), 0.001);
            if (pt !== undefined) {
                if (bestPt === undefined || ray.firstPoint([bestPt, pt]) === pt) {
                    if (bestPt === undefined || bestPt.minus(pt).length() > 0.0001) {
                        bestPiece = localizedPiece;
                        bestPt = pt;
                        bestNew = true;
                    }
                }
            }
        }
        if (bestPiece === undefined) {
            return undefined;
        }
        return {
            piece: bestPiece,
            collisionPoint: bestPt,
            isNew: bestNew,
        };
    }

    /**
     * @returns {!UnitCellMap}
     */
    clone() {
        let cells = new GeneralMap();
        for (let [key, val] of this.cells.entries()) {
            cells.set(key, val.clone());
        }
        return new UnitCellMap(cells);
    }

    /**
     * @param {!UnitCellMap|*} other
     * @returns {!boolean}
     */
    isEqualTo(other) {
        if (!(other instanceof UnitCellMap)) {
            return false;
        }
        for (let k of [...this.cells.keys(), ...other.cells.keys()]) {
            if (!this.cell(k, true).isEqualTo(other.cell(k, true))) {
                return false;
            }
        }
        return true;
    }
}

export {UnitCellMap}
