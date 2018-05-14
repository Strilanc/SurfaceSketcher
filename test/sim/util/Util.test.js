import {Suite, assertThat, EqualsTester} from "test/TestUtil.js"

import {
    toggleMembership,
    makeArrayGrid,
    setMembershipInOfTo,
    xorSetInto,
    mergeGridRangeStrings,
} from "src/sim/util/Util.js"

let suite = new Suite("Util");

suite.test('toggleMembership', () => {
    let s = new Set([1, 2, 3]);

    toggleMembership(s, 2);
    assertThat(s).isEqualTo(new Set([1, 3]));

    toggleMembership(s, 4);
    assertThat(s).isEqualTo(new Set([1, 3, 4]));

    toggleMembership(s, 2);
    assertThat(s).isEqualTo(new Set([1, 2, 3, 4]));
});

suite.test('setMembershipInOfTo', () => {
    let s = new Set([1, 2, 3]);

    setMembershipInOfTo(s, 2, false);
    assertThat(s).isEqualTo(new Set([1, 3]));

    setMembershipInOfTo(s, 4, false);
    assertThat(s).isEqualTo(new Set([1, 3]));

    setMembershipInOfTo(s, 1, true);
    assertThat(s).isEqualTo(new Set([1, 3]));

    setMembershipInOfTo(s, 2, true);
    assertThat(s).isEqualTo(new Set([1, 2, 3]));

    setMembershipInOfTo(s, 4, true);
    assertThat(s).isEqualTo(new Set([1, 2, 3, 4]));
});

suite.test('makeArrayGrid', () => {
    let grid = makeArrayGrid(3, 3, (x, y) => 10 * x + y);
    assertThat(grid).isEqualTo([
        [0, 10, 20],
        [1, 11, 21],
        [2, 12, 22],
    ]);
});

suite.test('xorSetInto', () => {
    let s1 = new Set([2, 3, 5]);
    let s2 = new Set([1, 2, 3]);
    xorSetInto(s1, s2);
    assertThat(s1).isEqualTo(new Set([2, 3, 5]));
    assertThat(s2).isEqualTo(new Set([1, 5]));
});

suite.test('mergeGridRangeStrings', () => {
    assertThat(mergeGridRangeStrings(['abc\ndef\nghi', '123\n456\n789'], 100)).isEqualTo([
        ['abc   123'],
        ['def   456'],
        ['ghi   789']
    ].join('\n'));
});
