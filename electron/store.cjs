const fs = require("node:fs");
const path = require("node:path");
class Store {
  constructor(root) {
    this.root = root;
    fs.mkdirSync(root, { recursive: true });
    this.file = path.join(root, "library.json");
    this.data = {
      version: 1,
      projects: [{ id: "inbox", name: "Inbox", transcriptOnly: false }],
      drafts: [],
      settings: {
        transcriptionModel: "openai/whisper-1",
        formattingModel: "",
        language: "",
        glossary: "",
        theme: "paper",
        fontSize: 19,
      },
    };
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, "utf8"));
      } catch {
        throw new Error(
          "SoundDraft could not read library.json. Your files have been preserved. Restore library.backup.json before reopening.",
        );
      }
    }
    let changed = false;
    for (const d of this.data.drafts)
      if (["transcribing", "formatting"].includes(d.status)) {
        d.status = "interrupted";
        d.error = "Interrupted when the app closed. Retry to continue.";
        changed = true;
      }
    if (changed) this.save();
  }
  save() {
    const temp = this.file + ".tmp";
    fs.writeFileSync(temp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    const fd = fs.openSync(temp, "r");
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    if (fs.existsSync(this.file))
      fs.copyFileSync(this.file, path.join(this.root, "library.backup.json"));
    fs.renameSync(temp, this.file);
  }
  draft(id) {
    const d = this.data.drafts.find((d) => d.id === id);
    if (!d) throw new Error("Draft not found");
    return d;
  }
}
module.exports = { Store };
