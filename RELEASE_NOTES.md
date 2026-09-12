# SoundDraft 0.1.0

First preview release of the local author dictation studio.

- Mac installers for Apple Silicon (`arm64`) and Intel (`x64`), macOS 13+.
- Import audio or record locally; transcribe using your own OpenRouter API key.
- Immutable original transcripts, editable drafts, side-by-side formatting review, individual/bulk decisions, and history exports.
- Transcript-only mode, projects, search, night reading, audio playback, Word/Markdown/text export, and CSV word-count ledger.

## Install

Open the DMG and drag SoundDraft into Applications. These builds are ad-hoc signed and **not notarized**. After the first blocked launch, use **System Settings → Privacy & Security → Open Anyway** for SoundDraft. Do not disable Gatekeeper globally. See the repository README for details.

No Apple developer certificate is required. You need an OpenRouter key and account credit for transcription/formatting. The sample review works without a key.

## Preview limitations

Live transcription, waveform editing, cloud sync and direct spreadsheet/Grok integrations are deferred. Formatting supports up to 60,000 characters per pass. Section navigation uses five-minute boundaries. Current word counts are document totals rather than cumulative daily production. No in-app deletion yet.

Automated desktop tests use mocked provider responses; real transcription quality and paid OpenRouter requests have not been verified without an owner-supplied API key. Start with a short recording.
