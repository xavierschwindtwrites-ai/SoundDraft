const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  makeReview,
  reviewText,
  decide,
  wordCount,
  metricsCSV,
} = require("../electron/core.cjs");
const { Store } = require("../electron/store.cjs");
test("pending changes preserve original; accepted changes reconstruct exact proposal", () => {
  const original = "It was, um, a cold cold night.\nI waited.";
  const proposed = "It was a cold night.\n\nI waited.";
  const r = makeReview(original, proposed);
  assert.equal(reviewText(r), original);
  assert.equal(reviewText(r, true), proposed);
  decide(
    r,
    r.spans.filter((s) => s.id).map((s) => s.id),
    "accepted",
  );
  assert.equal(reviewText(r), proposed);
  assert.equal(r.source, original);
  assert.ok(r.events.length > 0);
});
test("reject and undo preserve independent decisions with audit trail", () => {
  const r = makeReview("one two three", "One two three.");
  const c = r.spans.filter((s) => s.id);
  decide(r, [c[0].id], "accepted");
  decide(r, [c.at(-1).id], "rejected");
  assert.equal(reviewText(r), "One two three");
  decide(r, [c[0].id], "pending");
  assert.equal(reviewText(r), "one two three");
  assert.equal(r.events.length, 3);
});
test("no changes, whitespace, unicode, empty and deletion all roundtrip exactly", () => {
  for (const [a, b] of [
    ["", "hello"],
    ["hello", ""],
    ["same", "same"],
    ["Mara — “yes”", "Mara: “Yes.”"],
    ["a\n b", "a\n\nb"],
    ["你 好", "你好"],
  ]) {
    const r = makeReview(a, b);
    assert.equal(reviewText(r), a);
    assert.equal(reviewText(r, true), b);
  }
});
test("CSV quotes text and neutralizes spreadsheet formulas", () => {
  const csv = metricsCSV(
    [
      {
        title: '=HYPERLINK("bad")',
        raw: "one two",
        working: "three",
        createdAt: "now",
        projectId: "p",
      },
    ],
    [{ id: "p", name: "Book, One" }],
  );
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'));
  assert.ok(csv.includes('"Book, One"'));
  assert.equal(wordCount(" a  b\n c "), 3);
});
test("atomic store survives reopening and marks in-flight jobs interrupted", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sounddraft-store-"));
  try {
    const store = new Store(root);
    store.data.drafts.push({
      id: "d",
      status: "transcribing",
      chunks: [{ text: "saved" }],
    });
    store.save();
    store.data.settings.language = "en";
    store.save();
    assert.ok(fs.existsSync(path.join(root, "library.backup.json")));
    const reopened = new Store(root);
    assert.equal(reopened.data.drafts[0].status, "interrupted");
    assert.equal(reopened.data.drafts[0].chunks[0].text, "saved");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("corrupt library is never overwritten", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sounddraft-corrupt-"));
  const file = path.join(root, "library.json");
  try {
    fs.writeFileSync(file, "broken");
    assert.throws(() => new Store(root), /preserved/);
    assert.equal(fs.readFileSync(file, "utf8"), "broken");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
