import {Suite, assertThat, EqualsTester} from "test/TestUtil.js"
import {seq} from "src/base/Seq.js"
import {GeneralMap} from "src/base/GeneralMap.js"

let suite = new Suite("GeneralMap");

class Custom {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }

    isEqualTo(other) {
        return other instanceof Custom && this.a === other.a && this.b === other.b;
    }

    toString() {
        return `${this.a}:${this.b}`;
    }
}

suite.test("equals", () => {
    let eq = new EqualsTester();
    eq.assertAddGeneratedPair(() => new GeneralMap());
    eq.assertAddGroup(new GeneralMap([new Custom(1, 2), 5]));
    eq.assertAddGroup(new GeneralMap([new Custom(1, 3), 5]));
    eq.assertAddGroup(new GeneralMap([new Custom(1, 2), 2]));
    eq.assertAddGroup(
        new GeneralMap([new Custom(1, 2), 3], [new Custom(1, 3), 5]),
        new GeneralMap([new Custom(1, 3), 5], [new Custom(1, 2), 3]));
});

suite.test("keys", () => {
    let m = new GeneralMap(
        [new Custom(2, 1), 'c'],
        [new Custom(1, 1), 'a'],
        [new Custom(1, 2), 'b'],
    );
    let keys = seq([...m.keys()]).sortedBy(e => e.toString()).toArray();
    assertThat(keys).isEqualTo([new Custom(1, 1), new Custom(1, 2), new Custom(2, 1)]);
});

suite.test("values", () => {
    let m = new GeneralMap(
        [new Custom(1, 1), 'a'],
        [new Custom(1, 2), 'b'],
        [new Custom(2, 1), 'c'],
    );
    let values = [...m.values()];
    values.sort();
    assertThat(values).isEqualTo(['a', 'b', 'c']);
});

suite.test("entries", () => {
    let m = new GeneralMap(
        [new Custom(1, 1), 'a'],
        [new Custom(1, 2), 'b'],
        [new Custom(2, 1), 'c'],
    );
    let entries = seq([...m.entries()]).sortedBy(e => e[1]).toArray();
    assertThat(entries).isEqualTo([
        [new Custom(1, 1), 'a'],
        [new Custom(1, 2), 'b'],
        [new Custom(2, 1), 'c'],
    ]);
});

suite.test("set", () => {
    let m = new GeneralMap();
    m.set(new Custom(1, 1), 'a');
    assertThat(m).isEqualTo(new GeneralMap([new Custom(1, 1), 'a']));
    m.set(new Custom(1, 1), 'b');
    assertThat(m).isEqualTo(new GeneralMap([new Custom(1, 1), 'b']));
    m.set(new Custom(1, 2), 'c');
    assertThat(m).isEqualTo(new GeneralMap([new Custom(1, 1), 'b'], [new Custom(1, 2), 'c']));
    m.set(new Custom(1, 1), 'd');
    assertThat(m).isEqualTo(new GeneralMap([new Custom(1, 1), 'd'], [new Custom(1, 2), 'c']));
});

suite.test("delete", () => {
    let m = new GeneralMap([new Custom(1, 1), 'a']);
    m.delete(new Custom(1, 2));
    assertThat(m).isEqualTo(new GeneralMap([new Custom(1, 1), 'a']));
    m.delete(new Custom(1, 1));
    assertThat(m).isEqualTo(new GeneralMap());
    m.delete(new Custom(1, 1));
    assertThat(m).isEqualTo(new GeneralMap());
});

suite.test("has", () => {
    let m = new GeneralMap([new Custom(1, 1), 'a']);
    assertThat(m.has(new Custom(1, 1))).isEqualTo(true);
    assertThat(m.has(new Custom(1, 2))).isEqualTo(false);
});

suite.test("clear", () => {
    let s = new GeneralMap([new Custom(1, 1), 'a'], [new Custom(1, 2), 'b']);
    s.clear();
    assertThat(s).isEqualTo(new GeneralMap());
    s.clear();
    assertThat(s).isEqualTo(new GeneralMap());
});
