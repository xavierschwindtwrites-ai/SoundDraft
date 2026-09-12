const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const postcss = require("postcss");

const site = path.resolve(__dirname, "../site");
const html = fs.readFileSync(path.join(site, "index.html"), "utf8");
const css = fs.readFileSync(path.join(site, "styles.css"), "utf8");
const script = fs.readFileSync(path.join(site, "script.js"), "utf8");

function baseDeclarations(styles, selector) {
  const declarations = new Map();
  styles.walkRules((rule) => {
    if (rule.parent.type !== "root" || !rule.selectors.includes(selector))
      return;
    rule.walkDecls((declaration) => {
      declarations.set(declaration.prop, declaration.value);
    });
  });
  return declarations;
}

test("showcase stylesheet parses through layout, footer, and responsive rules", () => {
  // A backslash before a URL's opening quote made browsers discard almost the
  // entire stylesheet. PostCSS alone accepts that token, so check it explicitly.
  assert.doesNotMatch(css, /url\(\s*\\["']/i);
  const styles = postcss.parse(css, { from: "site/styles.css" });
  assert.equal(baseDeclarations(styles, ".nav").get("display"), "flex");
  assert.equal(baseDeclarations(styles, ".hero").get("display"), "grid");
  assert.ok(
    baseDeclarations(styles, ".footer").size,
    "footer styling survives parsing",
  );
  const mediaQueries = [];
  styles.walkAtRules("media", (rule) => mediaQueries.push(rule.params));
  assert.ok(
    mediaQueries.some((query) => /max-width/.test(query)),
    "small-screen styles exist",
  );
  assert.ok(
    mediaQueries.some((query) => /prefers-reduced-motion/.test(query)),
    "reduced-motion styles exist",
  );
});

test("showcase content remains visible before or without JavaScript", () => {
  const styles = postcss.parse(css);
  const reveal = baseDeclarations(styles, ".reveal");
  assert.notEqual(
    reveal.get("opacity"),
    "0",
    "progressive enhancement must not hide the page by default",
  );
  assert.notEqual(reveal.get("visibility"), "hidden");
  assert.notEqual(reveal.get("display"), "none");
});

test("showcase local assets and section links resolve from GitHub Pages subpaths", () => {
  const ids = new Set(
    Array.from(html.matchAll(/\bid=["']([^"']+)["']/g), (match) => match[1]),
  );
  for (const [, reference] of html.matchAll(
    /\b(?:src|href)=["']([^"']+)["']/g,
  )) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)) continue;
    if (reference.startsWith("#")) {
      assert.ok(
        ids.has(decodeURIComponent(reference.slice(1))),
        `missing section ${reference}`,
      );
      continue;
    }
    assert.ok(
      !reference.startsWith("/"),
      `root-relative asset breaks project Pages hosting: ${reference}`,
    );
    const file = path.resolve(
      site,
      decodeURIComponent(reference.split(/[?#]/)[0]),
    );
    assert.ok(
      file.startsWith(`${site}${path.sep}`),
      `asset escapes published site: ${reference}`,
    );
    assert.ok(fs.statSync(file).isFile(), `missing site asset ${reference}`);
  }
});

test("showcase JavaScript is valid without a bundler", () => {
  assert.doesNotThrow(
    () => new vm.Script(script, { filename: "site/script.js" }),
  );
});

// Only the DOM surface this unbundled script uses. Unexpected selectors fail
// loudly so a markup/script change cannot silently make these tests ineffective.
function showcaseDOM() {
  let focused = null;
  function element(initialAttributes = {}) {
    const attributes = new Map(Object.entries(initialAttributes));
    const classes = new Set();
    const listeners = new Map();
    return {
      dataset: {},
      hidden: false,
      disabled: false,
      textContent: "",
      getAttribute: (key) => attributes.get(key) ?? null,
      setAttribute: (key, value) => attributes.set(key, String(value)),
      classList: {
        contains: (name) => classes.has(name),
        remove: (name) => classes.delete(name),
        toggle(name, force) {
          const add = force ?? !classes.has(name);
          if (add) classes.add(name);
          else classes.delete(name);
          return add;
        },
      },
      addEventListener(event, listener) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(listener);
      },
      dispatch(event, detail = {}) {
        for (const listener of listeners.get(event) ?? []) {
          listener({ currentTarget: this, target: this, ...detail });
        }
      },
      focus() {
        assert.equal(
          this.hidden,
          false,
          "focus must not move to a hidden control",
        );
        assert.equal(
          this.disabled,
          false,
          "focus must not move to a disabled control",
        );
        focused = this;
      },
      click() {
        assert.equal(this.hidden, false, "test must use a visible control");
        assert.equal(this.disabled, false, "test must use an enabled control");
        this.dispatch("click");
      },
    };
  }
  const changeIds = Array.from(
    html.matchAll(/\bdata-change="(\d+)"/g),
    (match) => match[1],
  );
  assert.deepEqual(
    changeIds,
    ["0", "1"],
    "demo markup supplies two independently tracked changes",
  );
  const artifactIds = Array.from(
    html.matchAll(/\bdata-artifact="(\d+)"/g),
    (match) => match[1],
  );
  assert.deepEqual(
    artifactIds,
    changeIds,
    "each change controls its matching proposed artifact",
  );
  for (const decision of ["accepted", "rejected", "pending"]) {
    assert.equal(
      html.match(new RegExp(`data-decision="${decision}"`, "g"))?.length,
      2,
    );
  }
  const menu = element({
    "aria-expanded": "false",
    "aria-label": "Open navigation",
  });
  const links = element();
  const navLinks = [element(), element(), element()];
  const status = element();
  const acceptAll = element();
  const reset = element();
  const artifacts = changeIds.map(() => element());
  const changes = changeIds.map((id) => {
    const change = element();
    change.dataset.change = id;
    change.status = element();
    change.buttons = ["accepted", "rejected", "pending"].map((decision) => {
      const button = element();
      button.dataset.decision = decision;
      return button;
    });
    change.querySelectorAll = (selector) => {
      assert.equal(selector, "[data-decision]");
      return change.buttons;
    };
    change.querySelector = (selector) => {
      if (selector === ".change-status") return change.status;
      if (selector === "[data-decision]") return change.buttons[0];
      assert.equal(selector, "[data-decision]:not([hidden])");
      return change.buttons.find((button) => !button.hidden) ?? null;
    };
    return change;
  });
  const selectors = new Map([
    [".menu-button", menu],
    [".nav-links", links],
    [".compare-status", status],
    [".accept-all", acceptAll],
    [".reset-demo", reset],
    ...artifacts.map((artifact, index) => [
      `[data-artifact="${index}"]`,
      artifact,
    ]),
  ]);
  const document = element();
  document.querySelector = (selector) => {
    assert.ok(
      selectors.has(selector),
      `unexpected document selector ${selector}`,
    );
    return selectors.get(selector);
  };
  document.querySelectorAll = (selector) => {
    if (selector === ".nav-links a") return navLinks;
    assert.equal(selector, "[data-change]");
    return changes;
  };
  // No network, storage, animation observer, or browser globals are provided.
  new vm.Script(script, { filename: "site/script.js" }).runInNewContext({
    document,
  });
  return {
    document,
    menu,
    links,
    navLinks,
    status,
    acceptAll,
    reset,
    artifacts,
    changes,
    focused: () => focused,
  };
}

test("showcase mobile menu toggles, closes on links, and returns focus on Escape", () => {
  const demo = showcaseDOM();
  demo.menu.click();
  assert.equal(demo.menu.getAttribute("aria-expanded"), "true");
  assert.equal(demo.menu.getAttribute("aria-label"), "Close navigation");
  assert.equal(demo.links.classList.contains("open"), true);
  demo.document.dispatch("keydown", { key: "a" });
  assert.equal(demo.menu.getAttribute("aria-expanded"), "true");
  demo.document.dispatch("keydown", { key: "Escape" });
  assert.equal(demo.menu.getAttribute("aria-expanded"), "false");
  assert.equal(demo.menu.getAttribute("aria-label"), "Open navigation");
  assert.equal(demo.links.classList.contains("open"), false);
  assert.equal(demo.focused(), demo.menu);
  for (const link of demo.navLinks) {
    demo.menu.click();
    link.click();
    assert.equal(demo.menu.getAttribute("aria-expanded"), "false");
    assert.equal(demo.links.classList.contains("open"), false);
  }
  demo.menu.click();
  demo.menu.click();
  assert.equal(demo.menu.getAttribute("aria-expanded"), "false");
});

test("showcase comparison decisions are reversible and accept remaining preserves rejections", () => {
  const demo = showcaseDOM();
  const [first, second] = demo.changes;
  function state(change, expected) {
    assert.equal(
      change.status.textContent,
      expected[0].toUpperCase() + expected.slice(1),
    );
    assert.equal(
      change.classList.contains("accepted"),
      expected === "accepted",
    );
    assert.equal(
      change.classList.contains("rejected"),
      expected === "rejected",
    );
    for (const button of change.buttons) {
      assert.equal(
        button.hidden,
        button.dataset.decision === "pending"
          ? expected === "pending"
          : expected !== "pending",
      );
    }
  }
  state(first, "pending");
  state(second, "pending");
  assert.equal(demo.status.textContent, "0 of 2 reviewed");
  assert.equal(demo.reset.disabled, true);
  assert.ok(demo.artifacts.every((artifact) => artifact.hidden));

  first.buttons[0].click();
  state(first, "accepted");
  assert.equal(demo.status.textContent, "1 of 2 reviewed");
  assert.equal(demo.artifacts[0].hidden, true);
  assert.equal(demo.focused(), first.buttons[2]);

  second.buttons[1].click();
  state(second, "rejected");
  assert.equal(
    demo.artifacts[1].hidden,
    false,
    "rejected removal restores the original artifact",
  );
  assert.equal(demo.status.textContent, "2 of 2 reviewed");
  assert.equal(demo.acceptAll.disabled, true);

  first.buttons[2].click();
  state(first, "pending");
  assert.equal(demo.status.textContent, "1 of 2 reviewed");
  assert.equal(demo.acceptAll.disabled, false);
  assert.equal(demo.focused(), first.buttons[0]);
  demo.acceptAll.click();
  state(first, "accepted");
  state(second, "rejected");
  assert.equal(
    demo.artifacts[1].hidden,
    false,
    "accept remaining must preserve an explicit rejection",
  );
  assert.equal(demo.focused(), demo.reset);

  second.buttons[2].click();
  state(second, "pending");
  assert.equal(
    demo.artifacts[1].hidden,
    true,
    "undo restores the pending proposal",
  );
  demo.reset.click();
  state(first, "pending");
  state(second, "pending");
  assert.equal(demo.status.textContent, "0 of 2 reviewed");
  assert.equal(demo.reset.disabled, true);
  assert.equal(demo.focused(), first.buttons[0]);
  demo.acceptAll.click();
  state(first, "accepted");
  state(second, "accepted");
  assert.equal(demo.status.textContent, "2 of 2 reviewed");
  assert.equal(demo.acceptAll.disabled, true);
});
