class UnitCellSocketNeighbor {
    /**
     * @param {!UnitCellSocket} socket
     * @param {!Vector} dir
     * @param {!boolean} inNextCell
     */
    constructor(socket, dir, inNextCell) {
        this.socket = socket;
        this.dir = dir;
        this.inNextCell = inNextCell;
    }

    toString() {
        return `UnitCellSocketNeighbor(socket=${this.socket}, dir=${this.dir}, inNextCell=${this.inNextCell})`;
    }
}

export {UnitCellSocketNeighbor}
