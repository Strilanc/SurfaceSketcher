import {Suite, assertThat, assertThrows, assertTrue, assertFalse} from "test/TestUtil.js"

import {codeDistanceToPipeSize} from "src/braid/PlumbingPieces.js"

let suite = new Suite("PlumbingPieces");

suite.test('codeDistanceToPipeSize', () => {
    assertThat(codeDistanceToPipeSize(1)).isEqualTo({w: 1, h: 1});
    assertThat(codeDistanceToPipeSize(2)).isEqualTo({w: 1, h: 1});
    assertThat(codeDistanceToPipeSize(3)).isEqualTo({w: 1, h: 1});
    assertThat(codeDistanceToPipeSize(4)).isEqualTo({w: 1, h: 1});
    assertThat(codeDistanceToPipeSize(5)).isEqualTo({w: 2, h: 1});
    assertThat(codeDistanceToPipeSize(6)).isEqualTo({w: 2, h: 1});
    assertThat(codeDistanceToPipeSize(7)).isEqualTo({w: 2, h: 2});
    assertThat(codeDistanceToPipeSize(8)).isEqualTo({w: 2, h: 2});
    assertThat(codeDistanceToPipeSize(9)).isEqualTo({w: 3, h: 2});
    assertThat(codeDistanceToPipeSize(10)).isEqualTo({w: 3, h: 2});
    assertThat(codeDistanceToPipeSize(11)).isEqualTo({w: 3, h: 3});
});
