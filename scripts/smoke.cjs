const { _electron: electron } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sounddraft-desktop-"));
  const screenshots = path.resolve("test-results");
  fs.mkdirSync(screenshots, { recursive: true });
  const audio = path.join(root, "test.wav");
  const samples = 32000,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16000, 24);
  wav.writeUInt32LE(32000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(Math.sin((i / 16000) * 440 * 2 * Math.PI) * 3000),
      44 + i * 2,
    );
  fs.writeFileSync(audio, wav);
  let app;
  const errors = [];
  try {
    app = await electron.launch({
      args: [path.resolve(".")],
      env: { ...process.env, SOUNDDRAFT_TEST_DIR: root },
    });
    await app.evaluate(({ systemPreferences }) => {
      systemPreferences.askForMediaAccess = async () => false;
    });
    const page = await app.firstWindow();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page
      .getByRole("heading", { name: "Make room for your next chapter." })
      .waitFor();
    await page.screenshot({ path: path.join(screenshots, "welcome.png") });
    await page
      .getByRole("button", { name: "Explore a sample formatting review" })
      .click();
    await page.getByRole("heading", { name: "Proposed draft" }).waitFor();
    await page.screenshot({ path: path.join(screenshots, "review.png") });
    console.log("Rendered sample review");
    const original = await page.evaluate(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0].raw;
    });
    await page
      .getByRole("button", { name: "Accept", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Reject", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Accept remaining", exact: true })
      .click();
    const reviewed = await page.evaluate(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0];
    });
    assert.equal(reviewed.raw, original);
    assert.ok(!reviewed.reviews[0].spans.some((s) => s.status === "pending"));
    assert.ok(reviewed.reviews[0].events.length >= 3);
    console.log("Review decisions passed");
    await page.getByRole("button", { name: "Draft", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Manuscript draft" })
      .fill("A saved sentence.\n\nAnother paragraph.");
    await page.keyboard.press("Meta+s");
    await page.waitForFunction(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0].working === "A saved sentence.\n\nAnother paragraph.";
    });
    console.log("Autosave passed");
    await page
      .getByRole("checkbox", { name: "Transcript-only", exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector(".mode-switch input").checked,
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Format & remove artifacts" })
        .count(),
      0,
    );
    await page
      .getByRole("button", { name: "Toggle night reading mode" })
      .click();
    await page.waitForFunction(
      () => document.documentElement.dataset.theme === "night",
    );
    await page.screenshot({ path: path.join(screenshots, "night.png") });
    await page
      .getByRole("button", { name: "Toggle night reading mode" })
      .click();
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, audio);
    await page.getByRole("button", { name: /Import audio/ }).click();
    await page.getByRole("textbox", { name: "Draft title" }).waitFor();
    await page.waitForFunction(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0].title === "test";
    });
    await page.evaluate(async () => {
      await window.sounddraft.saveKey("test-fixture-key", false);
      await window.sounddraft.updateSettings({
        formattingModel: "fixture/format",
      });
    });
    await page.evaluate(async () => {
      const s = await window.sounddraft.load();
      const id = s.drafts[0].id;
      await window.sounddraft.updateDraft(id, {working:'Keep this authored text.'});
      let protectedText = false;
      try {await window.sounddraft.transcribe(id);} catch {protectedText = true;}
      if (!protectedText || (await window.sounddraft.load()).drafts[0].working !== 'Keep this authored text.') throw new Error('Pre-transcription text was not protected');
      await window.sounddraft.updateDraft(id, {working:''});
    });
    await app.evaluate(() => {
      globalThis.fetch = async (url, opts) => {
        const body = opts.body ? JSON.parse(opts.body) : null;
        if (url.endsWith("audio/transcriptions")) {
          if (body.input_audio.format !== "wav" || !body.input_audio.data)
            throw new Error("Invalid audio request");
          return new Response(
            JSON.stringify({
              text: "A quiet quiet morning.",
              usage: { cost: 0.001, seconds: 2 },
            }),
            { status: 200 },
          );
        }
        if (url.endsWith("chat/completions"))
          return new Response(
            JSON.stringify({
              choices: [
                {
                  finish_reason: "stop",
                  message: { content: "A quiet morning." },
                },
              ],
              usage: { cost: 0.002 },
            }),
            { status: 200 },
          );
        throw new Error("Unexpected network request");
      };
    });
    await page.getByRole("button", { name: "Transcribe", exact: true }).click();
    await page.waitForFunction(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0].transcriptionComplete;
    });
    await page
      .getByRole("button", { name: "Format & remove artifacts" })
      .click();
    await page.waitForFunction(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0].reviews.length === 1;
    });
    const live = await page.evaluate(async () => {
      const s = await window.sounddraft.load();
      return s.drafts[0];
    });
    assert.equal(live.raw, "A quiet quiet morning.");
    assert.equal(live.working, live.raw);
    assert.equal(live.cost, 0.003);
    await page
      .getByRole("button", { name: "Accept remaining", exact: true })
      .click();
    const out = path.join(root, "export.docx");
    await app.evaluate(({ dialog }, file) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: file });
    }, out);
    await page.evaluate(
      async (id) => window.sounddraft.exportDraft(id, "docx"),
      live.id,
    );
    assert.ok(fs.statSync(out).size > 1000);
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page
      .getByRole("heading", { name: "Your studio, your settings." })
      .waitFor();
    await page.screenshot({ path: path.join(screenshots, "settings.png") });
    const sampleId = await page.evaluate(() => window.sounddraft.addDemo());
    await page.evaluate(
      (id) =>
        window.sounddraft.updateDraft(id, { title: "Small viewport review" }),
      sampleId,
    );
    await page
      .locator(".draft-row")
      .filter({ hasText: "Small viewport review" })
      .click();
    await page.getByRole("button", { name: /Formatting review/ }).click();
    await page.getByRole("heading", { name: "Proposed draft" }).waitFor();
    await page.evaluate(()=>window.sounddraft.updateSettings({fontSize:24}));
    await page.waitForFunction(()=>getComputedStyle(document.querySelector('.review-text')).fontSize==='24px');
    await page.evaluate(()=>window.sounddraft.updateSettings({fontSize:19}));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1024, 768),
    );
    await page.waitForFunction(() => innerWidth === 1024);
    await page.screenshot({ path: path.join(screenshots, "review-small.png") });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(errors, []);
    await app.evaluate(({systemPreferences})=>{systemPreferences.askForMediaAccess=async()=>true;});
    await page.evaluate(()=>{
      navigator.mediaDevices.getUserMedia=async()=>{
        const ctx=new AudioContext();const oscillator=ctx.createOscillator();const destination=ctx.createMediaStreamDestination();oscillator.connect(destination);oscillator.start();window.__testAudio=ctx;return destination.stream;
      };
    });
    await page.getByRole('button',{name:'Record a draft',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('.record-button').textContent.includes('0:02'));
    await page.getByRole('button',{name:/Stop recording/}).click();
    await page.waitForFunction(async()=>{const s=await window.sounddraft.load();return s.drafts[0].status==='imported' && s.drafts[0].duration>0;});
    await page.getByRole('button',{name:'Play recording',exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('audio').paused);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>window.__testAudio.close());
    console.log('Recording finalized and played immediately; text protection and review scaling passed');
    console.log("Desktop workflows and screenshots passed");
    await app.close();
    app = null;
    app = await electron.launch({
      args: [path.resolve(".")],
      env: { ...process.env, SOUNDDRAFT_TEST_DIR: root },
    });
    const reopened = await app.firstWindow();
    await reopened.waitForFunction(() => !!window.sounddraft);
    const after = await reopened.evaluate(() => window.sounddraft.load());
    assert.equal(
      after.drafts.find((d) => d.id === live.id).working,
      "A quiet morning.",
    );
    assert.equal(after.hasKey, false);
    console.log(
      "Desktop smoke passed: startup, review, accept/reject, autosave, transcript-only, night mode, real audio preparation, mocked OpenRouter transcription/formatting, DOCX export, responsive layout, restart persistence.",
    );
  } finally {
    if (app) {
      await app
        .evaluate(({ BrowserWindow }) =>
          BrowserWindow.getAllWindows().forEach((w) => w.destroy()),
        )
        .catch(() => {});
      await app.close().catch(() => {});
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
