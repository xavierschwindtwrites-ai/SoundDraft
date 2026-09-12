const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createHash, randomUUID } = require("node:crypto");

const version = "8.1.2";
const sha256 =
  "464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c";
const sourceURLs = [
  `https://ffmpeg.org/releases/ffmpeg-${version}.tar.xz`,
  `https://www.ffmpeg.org/releases/ffmpeg-${version}.tar.xz`,
];

function verifySource(archive, expectedSha256 = sha256) {
  const actual = createHash("sha256")
    .update(fs.readFileSync(archive))
    .digest("hex");
  if (actual !== expectedSha256)
    throw new Error(`FFmpeg source checksum mismatch: ${archive}`);
  return archive;
}

function downloadSource(url, destination) {
  execFileSync(
    "curl",
    [
      "--fail",
      "--location",
      "--retry",
      "3",
      "--retry-all-errors",
      "--connect-timeout",
      "20",
      "--max-time",
      "180",
      "--proto",
      "=https",
      "--proto-redir",
      "=https",
      url,
      "--output",
      destination,
    ],
    { stdio: "inherit" },
  );
}

function fetchSource(
  destination,
  {
    supplied = process.env.SOUNDDRAFT_FFMPEG_SOURCE,
    expectedSha256 = sha256,
    urls = sourceURLs,
    download = downloadSource,
  } = {},
) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (supplied) {
    verifySource(supplied, expectedSha256);
    if (path.resolve(supplied) !== path.resolve(destination))
      fs.copyFileSync(supplied, destination);
    return destination;
  }
  if (fs.existsSync(destination)) {
    try {
      return verifySource(destination, expectedSha256);
    } catch (error) {
      console.warn(`${error.message}; fetching a verified replacement.`);
    }
  }
  const temporary = `${destination}.download-${randomUUID()}`;
  const failures = [];
  try {
    for (const url of urls) {
      try {
        download(url, temporary);
        verifySource(temporary, expectedSha256);
        fs.renameSync(temporary, destination);
        return destination;
      } catch (error) {
        failures.push(`${url}: ${error.message}`);
        console.warn(`Unable to acquire verified FFmpeg source from ${url}.`);
        fs.rmSync(temporary, { force: true });
      }
    }
    throw new Error(
      `Could not download verified FFmpeg source.\n${failures.join("\n")}`,
    );
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

if (require.main === module) {
  const destination = path.resolve(
    process.argv[2] || `vendor/source/ffmpeg-${version}.tar.xz`,
  );
  fetchSource(destination);
  console.log(
    `Verified FFmpeg ${version} source: ${destination}\nSHA-256: ${sha256}`,
  );
}

module.exports = { version, sha256, verifySource, fetchSource };
