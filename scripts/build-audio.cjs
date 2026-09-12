// Build a small redistributable LGPL FFmpeg executable. No third-party codecs.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { version, fetchSource } = require("./fetch-audio-source.cjs");
const arch = process.argv[2] || process.arch;
if (!["arm64", "x64"].includes(arch))
  throw new Error("Supported Mac architectures: arm64, x64");
const output = path.resolve("vendor", arch);
fs.mkdirSync(output, { recursive: true });
const work = fs.mkdtempSync(path.join(os.tmpdir(), "sounddraft-audio-build-"));
const archive = path.join(work, `ffmpeg-${version}.tar.xz`);
fetchSource(archive);
execFileSync("tar", ["-xf", archive, "-C", work]);
const source = path.join(work, `ffmpeg-${version}`);
const args = [
  "--disable-everything",
  "--disable-autodetect",
  "--disable-network",
  "--disable-doc",
  "--disable-debug",
  "--disable-x86asm",
  "--disable-gpl",
  "--disable-nonfree",
  "--disable-programs",
  "--enable-ffmpeg",
  "--enable-protocol=file",
  "--enable-decoder=aac,aac_latm,alac,flac,mp3,mp3float,opus,vorbis,pcm_s16le,pcm_s16be,pcm_s24le,pcm_s24be,pcm_s32le,pcm_s32be,pcm_f32le,pcm_f64le,pcm_u8",
  "--enable-parser=aac,aac_latm,mpegaudio,opus,vorbis,flac",
  "--enable-demuxer=wav,mov,mp3,flac,ogg,matroska,aac,aiff",
  "--enable-muxer=wav,segment",
  "--enable-encoder=pcm_s16le",
  "--enable-filter=aresample,aformat,anull",
];
if (process.platform === "darwin")
  args.push(
    `--arch=${arch === "x64" ? "x86_64" : "aarch64"}`,
    `--cc=clang -arch ${arch === "x64" ? "x86_64" : "arm64"}`,
    "--extra-cflags=-mmacosx-version-min=12.0",
    "--extra-ldflags=-mmacosx-version-min=12.0",
  );
if (arch !== process.arch)
  args.push("--enable-cross-compile", "--target-os=darwin");
execFileSync("./configure", args, { cwd: source, stdio: "inherit" });
execFileSync("make", ["-j", String(Math.min(os.cpus().length, 8))], {
  cwd: source,
  stdio: "inherit",
});
fs.copyFileSync(path.join(source, "ffmpeg"), path.join(output, "ffmpeg"));
fs.chmodSync(path.join(output, "ffmpeg"), 0o755);
fs.copyFileSync(
  path.join(source, "COPYING.LGPLv2.1"),
  path.join(output, "COPYING.LGPLv2.1"),
);
fs.copyFileSync(archive, path.join(output, `ffmpeg-${version}-source.tar.xz`));
fs.writeFileSync(
  path.join(output, "BUILD.txt"),
  `Unmodified FFmpeg ${version}\nSource: https://ffmpeg.org/releases/ffmpeg-${version}.tar.xz\nConfigure: ${args.join(" ")}\nBuild: make -j8\n`,
);
console.log("Audio utility ready:", output);
