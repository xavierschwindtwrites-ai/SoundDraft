const { _electron } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sounddraft-icon-"));
  const app = await _electron.launch({
    args: [path.resolve(".")],
    env: { ...process.env, SOUNDDRAFT_TEST_DIR: root },
  });
  try {
    const page = await app.firstWindow();
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].setSize(1100, 1100),
    );
    await page.setContent(
      '<body style="margin:0;background:transparent">' +
        fs.readFileSync("assets/icon.svg", "utf8") +
        "</body>",
    );
    await page
      .locator("svg")
      .screenshot({ path: "assets/icon.png", omitBackground: true });
  } finally {
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
