const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { fetchSource } = require("../scripts/fetch-audio-source.cjs");

const fixture = Buffer.from("verified FFmpeg source fixture");
const expectedSha256 = createHash("sha256").update(fixture).digest("hex");

function workspace(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "sounddraft-source-test-"),
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return path.join(directory, "source.tar.xz");
}

test("audio source retries another host after DNS failure and retains only verified bytes", (t) => {
  const destination = workspace(t);
  const attempts = [];
  fetchSource(destination, {
    supplied: null,
    expectedSha256,
    urls: ["primary", "fallback"],
    download(url, file) {
      attempts.push(url);
      if (url === "primary") {
        fs.writeFileSync(file, "partial download");
        throw new Error("Could not resolve host");
      }
      fs.writeFileSync(file, fixture);
    },
  });
  assert.deepEqual(attempts, ["primary", "fallback"]);
  assert.deepEqual(fs.readFileSync(destination), fixture);
  assert.deepEqual(fs.readdirSync(path.dirname(destination)), [
    "source.tar.xz",
  ]);
});

test("audio source cache avoids network and a corrupt cache is replaced", (t) => {
  const destination = workspace(t);
  fs.writeFileSync(destination, fixture);
  let downloads = 0;
  const options = {
    supplied: null,
    expectedSha256,
    urls: ["primary"],
    download(_url, file) {
      downloads++;
      fs.writeFileSync(file, fixture);
    },
  };
  fetchSource(destination, options);
  assert.equal(downloads, 0);
  fs.writeFileSync(destination, "corrupt cache");
  fetchSource(destination, options);
  assert.equal(downloads, 1);
  assert.deepEqual(fs.readFileSync(destination), fixture);
});

test("audio source rejects a corrupted supplied artifact without falling back to the network", (t) => {
  const destination = workspace(t);
  const supplied = `${destination}.supplied`;
  fs.writeFileSync(supplied, "corrupt artifact");
  let downloads = 0;
  assert.throws(
    () =>
      fetchSource(destination, {
        supplied,
        expectedSha256,
        download() {
          downloads++;
        },
      }),
    /checksum mismatch/,
  );
  assert.equal(downloads, 0);
  assert.equal(fs.existsSync(destination), false);
  fs.writeFileSync(supplied, fixture);
  fetchSource(destination, { supplied, expectedSha256 });
  assert.deepEqual(fs.readFileSync(destination), fixture);
});

test("audio source never promotes bad downloads and cleans partial files after exhaustion", (t) => {
  const destination = workspace(t);
  assert.throws(
    () =>
      fetchSource(destination, {
        supplied: null,
        expectedSha256,
        urls: ["primary", "fallback"],
        download(_url, file) {
          fs.writeFileSync(file, "invalid archive");
        },
      }),
    /Could not download verified FFmpeg source/,
  );
  assert.equal(fs.existsSync(destination), false);
  assert.deepEqual(fs.readdirSync(path.dirname(destination)), []);
});
