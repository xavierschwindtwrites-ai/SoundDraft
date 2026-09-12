import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  AudioLines,
  Upload,
  Mic,
  Square,
  BookOpen,
  Plus,
  Settings,
  Search,
  FileText,
  Check,
  X,
  ChevronRight,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  Headphones,
  FolderOpen,
  LoaderCircle,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  SlidersHorizontal,
  ShieldCheck,
  Sparkles,
  CheckCheck,
  Undo2,
  History,
  BarChart3,
  Sun,
  Moon,
} from "lucide-react";
import "./styles.css";

const api = window.sounddraft;
const words = (t) => (t?.trim().match(/\S+/g) || []).length;
const clock = (n) =>
  `${Math.floor((n || 0) / 60)}:${String(Math.floor((n || 0) % 60)).padStart(2, "0")}`;
const fmt = (n) => new Intl.NumberFormat().format(n);
function IconButton({ icon: Icon, label, ...props }) {
  return (
    <button className="icon-button" title={label} aria-label={label} {...props}>
      <Icon size={18} />
    </button>
  );
}
function App() {
  const [state, setState] = useState(null),
    [selected, setSelected] = useState(null),
    [project, setProject] = useState("all"),
    [view, setView] = useState("draft"),
    [page, setPage] = useState("workspace"),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [sidebar, setSidebar] = useState(true),
    [newProject, setNewProject] = useState(false),
    [projectName, setProjectName] = useState(""),
    [editing, setEditing] = useState(""),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [exportOpen, setExportOpen] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [recording, setRecording] = useState(false),
    [recordSeconds, setRecordSeconds] = useState(0);
  const recorder = useRef(null),
    recordStream = useRef(null),
    recordId = useRef(null),
    writeQueue = useRef(Promise.resolve()),
    editRef = useRef(null),
    saveTimer = useRef(null),
    saveQueue = useRef(Promise.resolve());
  const draft = state?.drafts.find((d) => d.id === selected),
    review = draft?.reviews.at(-1),
    pending = review?.spans.filter((s) => s.id && s.status === "pending") || [];
  const refresh = async () => {
    const s = await api.load();
    setState(s);
    return s;
  };
  const run = async (fn) => {
    setError("");
    try {
      return await fn();
    } catch (e) {
      setError(
        e.message.replace(/^Error invoking remote method '[^']+': Error: /, ""),
      );
      return null;
    }
  };
  useEffect(() => {
    if (!api) return;
    refresh().catch((e) => setError(e.message));
    return api.onUpdate(() => refresh().catch((e) => setError(e.message)));
  }, []);
  useEffect(() => {
    if (!draft) return;
    if (!editRef.current || editRef.current.id !== draft.id || !dirty) {
      setEditing(draft.working);
      editRef.current = { id: draft.id, text: draft.working };
    }
  }, [selected, draft?.working]);
  useEffect(() => {
    document.documentElement.dataset.theme = state?.settings.theme || "paper";
  }, [state?.settings.theme]);
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function flush() {
    clearTimeout(saveTimer.current);
    if (!editRef.current?.dirty) return saveQueue.current;
    const edit = { ...editRef.current };
    editRef.current.dirty = false;
    setSaving(true);
    const task = saveQueue.current
      .catch(() => {})
      .then(() => api.updateDraft(edit.id, { working: edit.text }));
    saveQueue.current = task;
    try {
      await task;
      if (
        editRef.current?.id === edit.id &&
        editRef.current?.text === edit.text
      )
        setDirty(false);
    } catch (e) {
      if (editRef.current?.id === edit.id) editRef.current.dirty = true;
      setError("Draft could not be saved: " + e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  }
  function changeText(value) {
    setEditing(value);
    setDirty(true);
    editRef.current = { id: selected, text: value, dirty: true };
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => flush().catch(() => {}), 650);
  }
  async function choose(id) {
    await flush();
    setSelected(id);
    setPage("workspace");
    setView("draft");
    setHistoryOpen(false);
    setDirty(false);
    editRef.current = null;
  }
  useEffect(() => {
    const before = (e) => {
      if (editRef.current?.dirty || recording) {
        e.preventDefault();
        e.returnValue = "";
        flush().catch(() => {});
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [recording]);
  async function importAudio() {
    setBusy(true);
    await run(async () => {
      await flush();
      const ids = await api.importAudio(project === "all" ? "inbox" : project);
      if (ids.length) {
        await refresh();
        await choose(ids[0]);
      }
    });
    setBusy(false);
  }
  async function startRecording() {
    await run(async () => {
      await flush();
      if (!(await api.microphone()))
        throw new Error(
          "Microphone access is off. Enable SoundDraft in macOS System Settings → Privacy & Security → Microphone.",
        );
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordStream.current = stream;
      let id;
      try {
        id = await api.recordStart(project === "all" ? "inbox" : project);
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        throw e;
      }
      recordId.current = id;
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm" });
      recorder.current = rec;
      writeQueue.current = Promise.resolve();
      let failed = false;
      rec.ondataavailable = (e) => {
        if (e.data.size)
          writeQueue.current = writeQueue.current
            .then(async () => {
              await api.recordAppend(
                id,
                new Uint8Array(await e.data.arrayBuffer()),
              );
            })
            .catch((err) => {
              failed = true;
              setError("Recording could not be saved: " + err.message);
              if (rec.state === "recording") rec.stop();
            });
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        await writeQueue.current;
        await run(() => api.recordFinish(id));
        setRecording(false);
        setNotice(
          failed
            ? "Recording stopped. Check the saved audio."
            : "Recording saved on this Mac.",
        );
        await refresh();
      };
      rec.onerror = () => {
        setError("Microphone recording failed. Your saved audio is retained.");
        rec.stop();
      };
      rec.start(1000);
      setRecordSeconds(0);
      setRecording(true);
      await refresh();
      await choose(id);
    });
  }
  function stopRecording() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }
  async function startJob(kind) {
    await run(async () => {
      await flush();
      if (kind === "format") setView("review");
      await api[kind](selected);
    });
  }
  async function decision(ids, status) {
    await run(() => api.decision(selected, review.id, ids, status));
  }
  async function exportFile(kind) {
    setExportOpen(false);
    await run(async () => {
      await flush();
      const path = await api.exportDraft(selected, kind);
      if (path) setNotice("Export saved.");
    });
  }
  if (!api)
    return (
      <div className="browser-message">
        <AudioLines size={40} />
        <h1>SoundDraft</h1>
        <p>
          This is a desktop app. Run <code>npm run desktop</code> to open your
          local writing studio.
        </p>
      </div>
    );
  if (!state)
    return (
      <div className="browser-message">
        <AudioLines size={40} />
        <h1>Opening SoundDraft</h1>
        <p>{error || "Loading your local library…"}</p>
      </div>
    );
  const filtered = state.drafts.filter(
    (d) =>
      (project === "all" || d.projectId === project) &&
      (!query ||
        `${d.title} ${d.working}`.toLowerCase().includes(query.toLowerCase())),
  );
  const projectLabel =
    project === "all"
      ? "All drafts"
      : state.projects.find((p) => p.id === project)?.name;
  const currentJob = state.job?.id === selected;
  const counts = state.drafts
    .filter((d) => !d.demo)
    .reduce(
      (a, d) => ({
        words: a.words + words(d.working),
        seconds: a.seconds + (d.duration || 0),
        drafts: a.drafts + 1,
      }),
      { words: 0, seconds: 0, drafts: 0 },
    );
  return (
    <div className={"app " + (!sidebar ? "collapsed" : "")}>
      <header className="titlebar">
        <div className="brand">
          <AudioLines size={20} />
          <span>SoundDraft</span>
        </div>
        <span className="titlebar-center">Your voice. Your next chapter.</span>
        <span className="local-status">
          <span /> On this Mac
        </span>
      </header>
      {sidebar && (
        <aside className="sidebar">
          <button
            className="import-button"
            onClick={importAudio}
            disabled={busy || recording}
          >
            <Upload size={17} />
            Import audio <kbd>⌘ I</kbd>
          </button>
          <button
            className={"record-button " + (recording ? "recording" : "")}
            onClick={recording ? stopRecording : startRecording}
            disabled={busy}
          >
            {recording ? <Square size={16} /> : <Mic size={17} />}{" "}
            {recording
              ? `Stop recording · ${clock(recordSeconds)}`
              : "Record a draft"}
          </button>
          <div className="search">
            <Search size={15} />
            <input
              aria-label="Search drafts"
              placeholder="Find a draft…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button
            className={
              "nav-row " +
              (project === "all" && page === "workspace" ? "active" : "")
            }
            onClick={() => {
              setProject("all");
              setPage("workspace");
            }}
          >
            <BookOpen size={17} />
            All drafts<span>{state.drafts.length}</span>
          </button>
          <div className="section-label">
            Projects
            <IconButton
              icon={Plus}
              label="New project"
              onClick={() => setNewProject(!newProject)}
            />
          </div>
          {newProject && (
            <form
              className="new-project"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const id = await api.createProject(projectName);
                  setProject(id);
                  setProjectName("");
                  setNewProject(false);
                });
              }}
            >
              <input
                autoFocus
                aria-label="Project name"
                placeholder="Book or project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
                maxLength={100}
              />
              <button type="submit" aria-label="Create project">
                <Check size={15} />
              </button>
            </form>
          )}
          <div className="project-list">
            {state.projects.map((p) => (
              <button
                key={p.id}
                className={"nav-row " + (project === p.id ? "active" : "")}
                onClick={() => {
                  setProject(p.id);
                  setPage("workspace");
                }}
              >
                <FolderOpen size={16} />
                <span className="project-name">{p.name}</span>
                <small>
                  {state.drafts.filter((d) => d.projectId === p.id).length}
                </small>
              </button>
            ))}
          </div>
          <div className="section-label">
            {query ? "Search results" : projectLabel}
            <span>{filtered.length}</span>
          </div>
          <div className="draft-list">
            {filtered.map((d) => (
              <button
                className={"draft-row " + (d.id === selected ? "selected" : "")}
                key={d.id}
                onClick={() => run(() => choose(d.id))}
              >
                <FileText size={16} />
                <div>
                  <strong>{d.title}</strong>
                  <small>
                    {d.demo
                      ? "Sample draft"
                      : new Date(d.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                    <span>·</span>{" "}
                    {d.status === "transcribing"
                      ? "Transcribing…"
                      : `${fmt(words(d.working))} words`}
                  </small>
                </div>
                {d.status === "transcribing" && (
                  <LoaderCircle className="spin" size={13} />
                )}
              </button>
            ))}
            {!filtered.length && (
              <p className="list-empty">
                {query
                  ? "No matching drafts."
                  : "Your next chapter starts here."}
              </p>
            )}
          </div>
          <div className="sidebar-bottom">
            <button
              className={"nav-row " + (page === "stats" ? "active" : "")}
              onClick={() => {
                run(async () => {
                  await flush();
                  setPage("stats");
                });
              }}
            >
              <BarChart3 size={17} />
              Writing activity
            </button>
            <button
              className={"nav-row " + (page === "settings" ? "active" : "")}
              onClick={() =>
                run(async () => {
                  await flush();
                  setPage("settings");
                })
              }
            >
              <Settings size={17} />
              Settings
              <span
                className={"key-dot " + (state.hasKey ? "connected" : "")}
              />
            </button>
            <div className="sidebar-foot">
              SoundDraft <span>0.1.0</span>
            </div>
          </div>
        </aside>
      )}
      <main style={{ "--editor-size": `${state.settings.fontSize}px` }}>
        <div className="toolbar">
          <IconButton
            icon={sidebar ? PanelLeftClose : PanelLeftOpen}
            label="Toggle sidebar"
            onClick={() => setSidebar(!sidebar)}
          />
          <div className="breadcrumb">
            {page === "settings" ? (
              "Settings"
            ) : page === "stats" ? (
              "Writing activity"
            ) : (
              <>
                <span>
                  {state.projects.find((p) => p.id === draft?.projectId)
                    ?.name || "Your writing studio"}
                </span>
                {draft && (
                  <>
                    <ChevronRight size={14} />
                    <strong>{draft.title}</strong>
                  </>
                )}
              </>
            )}
          </div>
          {page === "workspace" && draft && (
            <>
              <span className="save-state">
                {saving ? (
                  "Saving…"
                ) : dirty ? (
                  "Unsaved changes"
                ) : (
                  <>
                    <Check size={13} />
                    Saved locally
                  </>
                )}
              </span>
              <div className="export-wrap">
                <button
                  className="button"
                  onClick={() => setExportOpen(!exportOpen)}
                >
                  <Download size={15} />
                  Export
                </button>
                {exportOpen && (
                  <div className="export-menu">
                    {[
                      ["docx", "Word document"],
                      ["md", "Markdown"],
                      ["txt", "Plain text"],
                      ["raw", "Original transcript"],
                      ["json", "Full review history (JSON)"],
                    ].map(([id, label]) => (
                      <button key={id} onClick={() => exportFile(id)}>
                        {label}
                      </button>
                    ))}
                    <p>Draft exports include accepted changes only.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        {error && (
          <div className="message error" role="alert">
            <span>{error}</span>
            <IconButton
              icon={X}
              label="Dismiss error"
              onClick={() => setError("")}
            />
          </div>
        )}
        {notice && (
          <div className="message notice" role="status">
            <Check size={16} />
            {notice}
          </div>
        )}
        {page === "settings" ? (
          <SettingsPage
            state={state}
            api={api}
            run={run}
            setNotice={setNotice}
          />
        ) : page === "stats" ? (
          <div className="content-page">
            <h1>Every word adds up.</h1>
            <p className="lede">
              A record of your writing, kept on this Mac. Sample drafts are
              excluded from totals.
            </p>
            <div className="metrics">
              <div>
                <strong>{fmt(counts.words)}</strong>
                <span>Current draft words</span>
              </div>
              <div>
                <strong>{counts.drafts}</strong>
                <span>Audio drafts</span>
              </div>
              <div>
                <strong>{Math.round(counts.seconds / 60)}</strong>
                <span>Minutes recorded</span>
              </div>
            </div>
            <div className="section-heading">
              <h2>Draft ledger</h2>
              <button
                className="button"
                onClick={() =>
                  run(async () => {
                    if (await api.exportMetrics())
                      setNotice("Spreadsheet CSV exported.");
                  })
                }
              >
                <Download size={15} />
                Export spreadsheet CSV
              </button>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Draft</th>
                  <th>Original words</th>
                  <th>Current words</th>
                  <th>Reported cost</th>
                </tr>
              </thead>
              <tbody>
                {state.drafts
                  .filter((d) => !d.demo)
                  .map((d) => (
                    <tr key={d.id}>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => run(() => choose(d.id))}
                        >
                          {d.title}
                        </button>
                      </td>
                      <td>{fmt(words(d.raw))}</td>
                      <td>{fmt(words(d.working))}</td>
                      <td>{d.cost == null ? "—" : `$${d.cost.toFixed(4)}`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {!counts.drafts && (
              <p className="muted">
                Import your first recording to start your writing log.
              </p>
            )}
            <p className="muted">
              Counts reflect saved documents, not cumulative daily production.
              API costs appear only when reported by the provider. CSV opens in
              Numbers, Excel, or Google Sheets.
            </p>
          </div>
        ) : !draft ? (
          <div className="welcome">
            <div className="welcome-mark">
              <AudioLines size={38} strokeWidth={1.4} />
            </div>
            <h1>
              Make room for
              <br />
              <em>your next chapter.</em>
            </h1>
            <p>
              Bring your recording. Keep your voice.
              <br />
              Turn a spoken draft into words you can work with.
            </p>
            <button className="primary large" onClick={importAudio}>
              <Upload size={18} />
              Import your first recording
            </button>
            <span className="supported">MP3, M4A, WAV, FLAC and more</span>
            <button
              className="text-button sample"
              onClick={() =>
                run(async () => {
                  const id = await api.addDemo();
                  await refresh();
                  await choose(id);
                  setView("review");
                })
              }
            >
              Explore a sample formatting review <ChevronRight size={14} />
            </button>
            <div className="welcome-details">
              <span>
                <ShieldCheck size={16} />
                Local files
              </span>
              <span>
                <SlidersHorizontal size={16} />
                Your API key
              </span>
              <span>
                <BookOpen size={16} />
                Your words
              </span>
            </div>
            {!state.hasKey && (
              <button
                className="setup-callout"
                onClick={() => setPage("settings")}
              >
                Connect OpenRouter in Settings to transcribe{" "}
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="document-heading">
              <div>
                <input
                  className="document-title"
                  aria-label="Draft title"
                  value={draft.title}
                  onChange={(e) =>
                    run(() =>
                      api.updateDraft(selected, { title: e.target.value }),
                    )
                  }
                  disabled={currentJob}
                />
                <div className="document-meta">
                  {draft.demo && <span className="sample-tag">Sample</span>}
                  <span>
                    {new Date(draft.createdAt).toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                  <span>·</span>
                  <span>{fmt(words(draft.working))} words</span>
                  <span>·</span>
                  <select
                    aria-label="Move to project"
                    value={draft.projectId}
                    onChange={(e) =>
                      run(() =>
                        api.updateDraft(selected, {
                          projectId: e.target.value,
                        }),
                      )
                    }
                    disabled={currentJob}
                  >
                    {state.projects.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="mode-switch">
                <input
                  type="checkbox"
                  checked={draft.transcriptOnly}
                  disabled={currentJob}
                  onChange={(e) =>
                    run(() =>
                      api.updateDraft(selected, {
                        transcriptOnly: e.target.checked,
                      }),
                    )
                  }
                />
                <span className="switch-track" />
                <span>Transcript-only</span>
              </label>
            </div>
            <div className="document-controls">
              <div className="tabs">
                <button
                  className={view === "draft" ? "selected" : ""}
                  onClick={() => setView("draft")}
                >
                  Draft
                </button>
                <button
                  className={view === "raw" ? "selected" : ""}
                  onClick={() => setView("raw")}
                >
                  Original transcript
                </button>
                {!draft.transcriptOnly && (
                  <button
                    className={view === "review" ? "selected" : ""}
                    onClick={() => setView("review")}
                  >
                    Formatting review
                    {pending.length > 0 && <span>{pending.length}</span>}
                  </button>
                )}
              </div>
              <div className="doc-actions">
                {draft.audioUrl &&
                  !draft.transcriptionComplete &&
                  !draft.demo && (
                    <button
                      className="primary"
                      disabled={!!state.job || recording || !state.hasKey}
                      onClick={() => startJob("transcribe")}
                    >
                      <Headphones size={15} />
                      {draft.status === "interrupted"
                        ? "Resume transcription"
                        : "Transcribe"}
                    </button>
                  )}
                {!draft.transcriptOnly && draft.working && (
                  <button
                    className="button"
                    disabled={
                      !!state.job || pending.length > 0 || !state.hasKey
                    }
                    onClick={() => startJob("format")}
                  >
                    <SlidersHorizontal size={15} />
                    Format & remove artifacts
                  </button>
                )}
              </div>
            </div>
            {currentJob && (
              <div className="job-banner" role="status">
                <LoaderCircle className="spin" size={17} />
                <span>{draft.progress || "Starting…"}</span>
                <button
                  className="text-button"
                  onClick={() => run(() => api.cancel())}
                >
                  Cancel
                </button>
              </div>
            )}
            {draft.error && <div className="message error">{draft.error}</div>}
            {!state.hasKey && draft.audioUrl && !draft.raw && (
              <div className="message notice">
                Add your OpenRouter key in Settings, then choose Transcribe.
              </div>
            )}
            {draft.transcriptOnly && (
              <div className="mode-note">
                Transcript-only · AI formatting & artifact removal is off.
                Transcription still uses OpenRouter.
              </div>
            )}
            {view === "review" && !draft.transcriptOnly ? (
              <Review
                review={review}
                pending={pending}
                decision={decision}
                currentJob={currentJob}
                historyOpen={historyOpen}
                setHistoryOpen={setHistoryOpen}
              />
            ) : (
              <div
                className="editor-area"
                style={{ "--editor-size": `${state.settings.fontSize}px` }}
              >
                {view === "raw" ? (
                  <>
                    <div className="editor-caption">
                      <ShieldCheck size={14} />
                      Original transcript · preserved unchanged
                    </div>
                    <div className="manuscript raw">
                      {draft.raw ||
                        "Your original transcript will appear here after transcription."}
                    </div>
                  </>
                ) : (
                  <>
                    {pending.length > 0 && (
                      <div className="editor-caption">
                        Resolve {pending.length} formatting changes before
                        editing. This draft includes accepted changes only.
                      </div>
                    )}
                    <textarea
                      className="manuscript editor"
                      aria-label="Manuscript draft"
                      value={editing}
                      readOnly={currentJob || pending.length > 0 || recording}
                      onChange={(e) => changeText(e.target.value)}
                      placeholder={
                        recording
                          ? "Recording locally. Stop when you’re ready to transcribe."
                          : draft.audioUrl
                            ? "Your recording is ready. Choose Transcribe to turn it into a draft."
                            : "Write here, or import an audio recording…"
                      }
                      spellCheck
                    />
                  </>
                )}
              </div>
            )}
            <div className="document-footer">
              <span>
                {view === "raw"
                  ? "Original transcript"
                  : view === "review"
                    ? "Formatting review"
                    : "Working draft"}
              </span>
              <span>
                {fmt(words(view === "raw" ? draft.raw : editing))} words
              </span>
              <div className="footer-spacer" />
              <IconButton
                icon={state.settings.theme === "night" ? Sun : Moon}
                label="Toggle night reading mode"
                onClick={() =>
                  run(() =>
                    api.updateSettings({
                      theme:
                        state.settings.theme === "night" ? "paper" : "night",
                    }),
                  )
                }
              />
              <label className="font-control">
                Text size
                <input
                  aria-label="Manuscript text size"
                  type="range"
                  min="15"
                  max="28"
                  value={state.settings.fontSize}
                  onChange={(e) =>
                    run(() =>
                      api.updateSettings({ fontSize: Number(e.target.value) }),
                    )
                  }
                />
              </label>
            </div>
            <AudioPlayer
              key={draft.id}
              draft={draft}
              run={run}
              recording={recording}
              recordSeconds={recordSeconds}
            />
          </>
        )}
      </main>
      <Shortcuts importAudio={importAudio} flush={flush} />
    </div>
  );
}
function Shortcuts({ importAudio, flush }) {
  useEffect(() => {
    const key = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        importAudio();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        flush().catch(() => {});
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  return null;
}
function Review({
  review,
  pending,
  decision,
  currentJob,
  historyOpen,
  setHistoryOpen,
}) {
  if (!review)
    return (
      <div className="review-empty">
        <SlidersHorizontal size={30} strokeWidth={1.3} />
        <h2>A little polish. Still your words.</h2>
        <p>
          Formatting corrects punctuation, paragraph breaks, and dictation
          artifacts.
          <br />
          Every proposed change appears here for your approval.
        </p>
        <p className="muted">
          Choose “Format & remove artifacts” to start. Text is sent to
          OpenRouter.
        </p>
      </div>
    );
  const changes = review.spans.filter((s) => s.id),
    complete = changes.length - pending.length;
  return (
    <div className="review-workspace">
      <div className="review-summary">
        <span>
          {complete} of {changes.length} changes reviewed
        </span>
        <progress
          max={changes.length || 1}
          value={changes.length ? complete : 1}
        />
        <button
          className="text-button"
          onClick={() => setHistoryOpen(!historyOpen)}
        >
          <History size={14} />
          History
        </button>
      </div>
      <div className="review-columns">
        <section className="review-column">
          <header>
            <h2>Original pass</h2>
            <span>Before formatting</span>
          </header>
          <div className="review-text">
            {review.spans.map((s, i) =>
              s.id ? (
                <mark className={"removed " + s.status} key={i}>
                  {s.before}
                </mark>
              ) : (
                <React.Fragment key={i}>{s.text}</React.Fragment>
              ),
            )}
          </div>
        </section>
        <section className="review-column">
          <header>
            <h2>Proposed draft</h2>
            <span>Pending changes shown</span>
          </header>
          <div className="review-text">
            {review.spans.map((s, i) =>
              s.id ? (
                <mark className={"added " + s.status} key={i}>
                  {s.status === "rejected" ? s.before : s.after}
                </mark>
              ) : (
                <React.Fragment key={i}>{s.text}</React.Fragment>
              ),
            )}
          </div>
        </section>
        <aside className="changes">
          <header>
            <h2>Changes</h2>
            <span>{pending.length} remaining</span>
          </header>
          <div className="change-list">
            {historyOpen ? (
              <div className="history">
                <h3>Pass details</h3>
                <p>{review.model}</p>
                <p>{new Date(review.createdAt).toLocaleString()}</p>
                <p>{review.events.length} decisions recorded</p>
                {review.events
                  .slice()
                  .reverse()
                  .map((e, i) => (
                    <p key={i}>
                      {e.from} → {e.to}
                      <br />
                      <small>{new Date(e.at).toLocaleTimeString()}</small>
                    </p>
                  ))}
                <p>
                  Export full review history as JSON for all passes and prompts.
                </p>
              </div>
            ) : (
              changes.map((s, i) => (
                <div className={"change " + s.status} key={s.id}>
                  <div className="change-heading">
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <strong>
                      {!s.before.trim()
                        ? "Formatting added"
                        : !s.after.trim()
                          ? "Artifact removed"
                          : "Text adjusted"}
                    </strong>
                    {s.status === "accepted" && <Check size={14} />}
                  </div>
                  {s.before && (
                    <del>{s.before.replaceAll("\n", " ↵ ") || " "}</del>
                  )}
                  {s.after && <ins>{s.after.replaceAll("\n", " ↵ ")}</ins>}
                  <div className="change-buttons">
                    {s.status === "pending" ? (
                      <>
                        <button
                          disabled={currentJob}
                          onClick={() => decision([s.id], "accepted")}
                        >
                          <Check size={13} />
                          Accept
                        </button>
                        <button
                          disabled={currentJob}
                          onClick={() => decision([s.id], "rejected")}
                        >
                          <X size={13} />
                          Reject
                        </button>
                      </>
                    ) : (
                      <>
                        <span>
                          {s.status === "accepted" ? "Accepted" : "Rejected"}
                        </span>
                        <button
                          title="Undo decision"
                          onClick={() => decision([s.id], "pending")}
                        >
                          <Undo2 size={13} />
                          Undo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="bulk-actions">
            <button
              className="primary"
              disabled={!pending.length || currentJob}
              onClick={() =>
                decision(
                  pending.map((s) => s.id),
                  "accepted",
                )
              }
            >
              <CheckCheck size={15} />
              Accept remaining
            </button>
            <button
              className="text-button"
              disabled={!pending.length || currentJob}
              onClick={() =>
                decision(
                  pending.map((s) => s.id),
                  "rejected",
                )
              }
            >
              Reject remaining
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
function AudioPlayer({ draft, run, recording, recordSeconds }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    [duration, setDuration] = useState(draft.duration || 0),
    [speed, setSpeed] = useState(1);
  useEffect(() => {
    if (!recording && draft.audioUrl) {
      ref.current?.load();
      if (ref.current) ref.current.playbackRate = speed;
    }
  }, [recording, draft.audioUrl]);
  function seek(n) {
    if (ref.current)
      ref.current.currentTime = Math.max(0, Math.min(duration, n));
  }
  return (
    <div className="audio-player">
      <div className="playback-buttons">
        <IconButton
          icon={RotateCcw}
          label="Back 15 seconds"
          onClick={() => seek(time - 15)}
          disabled={!draft.audioUrl || recording}
        />
        <button
          className="play-button"
          aria-label={playing ? "Pause" : "Play recording"}
          disabled={!draft.audioUrl || recording}
          onClick={() =>
            run(async () => {
              if (playing) ref.current.pause();
              else await ref.current.play();
            })
          }
        >
          {playing ? (
            <Pause size={20} fill="currentColor" />
          ) : (
            <Play size={20} fill="currentColor" />
          )}
        </button>
        <IconButton
          icon={RotateCw}
          label="Forward 15 seconds"
          onClick={() => seek(time + 15)}
          disabled={!draft.audioUrl || recording}
        />
      </div>
      <span className="audio-time">
        {recording ? clock(recordSeconds) : clock(time)}{" "}
        <span>/ {clock(duration)}</span>
      </span>
      <div className="audio-scrubber">
        <input
          aria-label="Audio position"
          type="range"
          min="0"
          max={duration || 1}
          step="0.1"
          value={time}
          onChange={(e) => seek(Number(e.target.value))}
          disabled={!draft.audioUrl || recording}
        />
        <div className="audio-label">
          {recording
            ? "Recording to this Mac…"
            : draft.audioUrl
              ? "Original recording"
              : draft.demo
                ? "Sample text · no audio recording"
                : "No audio attached"}
        </div>
      </div>
      <select
        aria-label="Playback speed"
        value={speed}
        onChange={(e) => {
          setSpeed(Number(e.target.value));
          ref.current.playbackRate = Number(e.target.value);
        }}
        disabled={!draft.audioUrl}
      >
        {[0.75, 1, 1.25, 1.5, 2].map((n) => (
          <option value={n} key={n}>
            {n}×
          </option>
        ))}
      </select>
      {draft.segments?.length > 0 && (
        <select
          aria-label="Jump to audio section"
          value=""
          onChange={(e) => seek(Number(e.target.value))}
        >
          <option value="">Sections</option>
          {draft.segments.map((s, i) => (
            <option key={i} value={s.start}>
              {clock(s.start)} · Section {i + 1}
            </option>
          ))}
        </select>
      )}
      <audio
        ref={ref}
        src={draft.audioUrl || undefined}
        onLoadedMetadata={(e) => {
          const d = e.target.duration;
          if (Number.isFinite(d)) {
            setDuration(d);
            if (Math.abs((draft.duration || 0) - d) > 1 && !recording)
              run(() => api.updateDraft(draft.id, { duration: d }));
          }
        }}
        onTimeUpdate={(e) => setTime(e.target.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          if (draft.audioUrl && !recording)
            run(() =>
              Promise.reject(
                new Error(
                  "Audio playback is unavailable for this format. Transcription still accepts it; WAV, MP3, and M4A are recommended for playback.",
                ),
              ),
            );
        }}
      />
    </div>
  );
}
function SettingsPage({ state, api, run, setNotice }) {
  const [key, setKey] = useState(""),
    [remember, setRemember] = useState(true),
    [models, setModels] = useState(null),
    [loading, setLoading] = useState(false),
    [form, setForm] = useState({ ...state.settings });
  const save = async () =>
    run(async () => {
      await api.updateSettings(form);
      setNotice("Settings saved.");
    });
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <div className="content-page settings-page">
      <h1>Your studio, your settings.</h1>
      <p className="lede">
        Keep your work local. Choose the models that work for you.
      </p>
      <section className="settings-section">
        <div>
          <h2>OpenRouter connection</h2>
          <p>
            Audio is sent only when you choose Transcribe. Text is sent only
            when you request formatting. Provider charges apply to your own
            account.
          </p>
        </div>
        <div className="settings-fields">
          <label>
            API key{" "}
            <span className={state.hasKey ? "connected-label" : ""}>
              {state.hasKey ? "Key configured" : "Not connected"}
            </span>
            <input
              type="password"
              autoComplete="off"
              placeholder={state.hasKey ? "Enter a replacement key" : "sk-or-…"}
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember using macOS Keychain encryption
          </label>
          <p className="field-help">
            Unchecked keeps the key for this session only. Unsigned app updates
            may ask for Keychain access again.
          </p>
          <div className="button-row">
            <button
              className="primary"
              disabled={!key.trim()}
              onClick={() =>
                run(async () => {
                  await api.saveKey(key, remember);
                  setKey("");
                  setNotice("API key saved.");
                })
              }
            >
              Save key
            </button>
            {state.hasKey && (
              <button
                className="button"
                onClick={() => run(() => api.saveKey("", false))}
              >
                Remove key
              </button>
            )}
          </div>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Models & language</h2>
          <p>
            Transcription and formatting have separate model choices. Refresh
            the catalog to see models available through your OpenRouter account.
          </p>
        </div>
        <div className="settings-fields">
          <button
            className="button"
            disabled={!state.hasKey || loading}
            onClick={async () => {
              setLoading(true);
              await run(async () => setModels(await api.models()));
              setLoading(false);
            }}
          >
            {loading ? (
              <LoaderCircle className="spin" size={15} />
            ) : (
              <RotateCw size={15} />
            )}
            Refresh model catalog
          </button>
          <label>
            Transcription model
            <input
              list="stt-models"
              value={form.transcriptionModel}
              onChange={(e) => update("transcriptionModel", e.target.value)}
            />
            <datalist id="stt-models">
              {models?.stt.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </datalist>
          </label>
          <label>
            Formatting model
            <input
              placeholder="Choose a text model from the catalog"
              list="text-models"
              value={form.formattingModel}
              onChange={(e) => update("formattingModel", e.target.value)}
            />
            <datalist id="text-models">
              {models?.chat.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </datalist>
          </label>
          <label>
            Audio language
            <select
              value={form.language}
              onChange={(e) => update("language", e.target.value)}
            >
              {[
                ["", "Detect automatically"],
                ["en", "English"],
                ["es", "Spanish"],
                ["fr", "French"],
                ["de", "German"],
                ["it", "Italian"],
                ["pt", "Portuguese"],
                ["ja", "Japanese"],
                ["zh", "Chinese"],
              ].map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Author’s reference</h2>
          <p>
            Character names, places, and preferred spellings to help the
            formatting model preserve your world.
          </p>
        </div>
        <div className="settings-fields">
          <label>
            Names & spellings
            <textarea
              rows="4"
              maxLength={5000}
              placeholder="Mara, Asterfall, the Grey Reach…"
              value={form.glossary}
              onChange={(e) => update("glossary", e.target.value)}
            />
          </label>
          <label>
            Reading appearance
            <select
              value={form.theme}
              onChange={(e) => update("theme", e.target.value)}
            >
              <option value="paper">Paper · light reading surface</option>
              <option value="night">Night · dark reading surface</option>
            </select>
          </label>
          <button className="primary" onClick={save}>
            <Check size={15} />
            Save preferences
          </button>
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Project defaults</h2>
          <p>
            Start new audio drafts in Transcript-only mode for selected
            projects. Existing drafts keep their own setting.
          </p>
        </div>
        <div className="settings-fields">
          {state.projects.map((p) => (
            <label className="checkbox-label" key={p.id}>
              <input
                type="checkbox"
                checked={p.transcriptOnly}
                onChange={(e) =>
                  run(() =>
                    api.updateSettings({
                      projectId: p.id,
                      transcriptOnly: e.target.checked,
                    }),
                  )
                }
              />
              {p.name} · Transcript-only
            </label>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <div>
          <h2>Local files & backup</h2>
          <p>
            Audio, drafts, and review history live in your SoundDraft library.
            Quit the app before copying the library folder for a complete
            backup. Your encrypted key is stored separately from manuscript
            exports.
          </p>
        </div>
        <div className="settings-fields">
          <button
            className="button"
            onClick={() => run(() => api.revealLibrary())}
          >
            <FolderOpen size={15} />
            Show library in Finder
          </button>
          <p className="field-help">
            SoundDraft has no account, telemetry, or automatic cloud sync.
            Spreadsheet integration uses CSV export in Writing activity.
          </p>
        </div>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
