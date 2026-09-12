# Third-party notices

SoundDraft's own source is licensed under MIT. Dependency licenses are retained in their respective packages inside the application archive. Electron includes its license and Chromium notices in the application bundle.

## FFmpeg

Copyright © FFmpeg contributors. The bundled FFmpeg 8.1.2 executable is a separate process, built from unmodified upstream source. This build is licensed under GNU Lesser General Public License version 2.1 or later. GPL and nonfree components are disabled, and there are no external codec libraries. Only local file protocols and the audio formats required by SoundDraft are enabled.

The application includes `COPYING.LGPLv2.1`, `BUILD.txt`, and the exact upstream source archive in `Contents/Resources/audio-tools/`. Build instructions are in `scripts/build-audio.cjs`. You may modify and replace that executable under its license; an application signature may need to be regenerated after modifying a signed bundle.

Source: https://ffmpeg.org/releases/ffmpeg-8.1.2.tar.xz

SHA-256: `464beb5e7bf0c311e68b45ae2f04e9cc2af88851abb4082231742a74d97b524c`

The initial npm ffmpeg-static binary is not distributed because its macOS build includes nonfree components. It is not a production dependency.
