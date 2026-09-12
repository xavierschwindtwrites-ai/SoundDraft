# SoundDraft interface

The shipped desktop uses a 244px graphite sidebar, a restrained title bar, and an ivory manuscript workspace. A 210px sidebar and narrower change inspector accommodate 1024px windows. The document title, text columns and audio controls have stable positions.

System sans-serif handles controls; Georgia handles manuscript and editorial headings. Text is dark green-gray on warm paper. Sage denotes approval/addition; amber denotes removed text. Changes also use strikethrough and explicit labels, so color is not the sole signal.

The review surface has a source column, proposed column and 244px change inspector. Every change has accept/reject; reviewed changes offer undo. Pending changes appear in the proposal but never in accepted draft exports. Audio is anchored at the bottom.

Night mode changes document surfaces and reading colors. The 15–28px text-size setting applies to the manuscript, original transcript, and both review columns at either desktop width. Text selection, focus rings, scrollbars and playback controls are themed. No remote fonts, raster imagery or decorative animations are required. Loading animation respects reduced-motion preference.

Transcription refuses to replace existing authored draft text and explains how to preserve it before proceeding. Microphone audio is saved incrementally as WebM; stopping prepares a WAV playback copy and reloads the player so duration and playback are available immediately. The saved original recording remains available for transcription.

## Finish review

Disposition: ship as an early desktop release. The welcome, review, 1024px review, night, and settings screenshots retain the approved graphite/ivory direction, readable serif manuscript hierarchy, visible editorial decisions, and persistent audio controls. No material visual redesign is required. The three finish findings—pre-transcription text replacement, recording playback refresh, and ineffective review text scaling—are resolved in the final source.

Core and desktop smoke tests passed in the build session. The desktop checks cover preservation of pre-transcription writing, computed review font size, synthetic recording through stop and conversion to immediate playback with duration, and the existing mocked transcription/formatting, review, export, autosave, and restart flows. This bounded review inspected the fixes and resulting desktop screenshots; it did not independently repeat the test run.

The frontend browser preview is only a shell; native workflows require Electron, as documented in README.md. OpenRouter responses were mocked: no paid live API call or model-accuracy validation was performed. Synthetic recording does not verify physical microphone hardware or permission prompts. This review does not certify fresh-machine installer behavior, full keyboard/screen-reader coverage, or measured contrast. No design detector ran because its launcher was unavailable. README.md records the early-release and platform limitations.

## Direction contract

THESIS: An author's manuscript and editorial decisions own the workspace.
OWN-WORLD: Graphite chrome, warm ivory reading canvas, sage/amber marks, serif prose and quiet system controls.
STORY: Import audio, transcribe, inspect changes, approve, export.
FIRST VIEWPORT: Slim project navigation left; title and review controls above two prose columns and a change inspector; persistent audio at bottom.
FORM: Desktop writing studio, based on the mockups discussed in this task. Existing accepted visual direction retained; no new concept round.
FINISH: Desktop screenshots and workflow tests precede the first release; remaining limitations are documented explicitly.
