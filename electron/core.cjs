const { diffWordsWithSpace } = require("diff");
const { randomUUID } = require("node:crypto");

function wordCount(text = "") {
  return (text.trim().match(/\S+/gu) || []).length;
}
function makeReview(original, proposed, metadata = {}) {
  const parts = diffWordsWithSpace(original, proposed);
  const spans = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (!part.added && !part.removed) {
      spans.push({ text: part.value });
      continue;
    }
    let before = "",
      after = "";
    while (i < parts.length && (parts[i].added || parts[i].removed)) {
      if (parts[i].removed) before += parts[i].value;
      else after += parts[i].value;
      i++;
    }
    i--;
    spans.push({ id: randomUUID(), before, after, status: "pending" });
  }
  return {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    source: original,
    proposed,
    spans,
    events: [],
    ...metadata,
  };
}
function reviewText(review, proposal = false) {
  return review.spans
    .map((p) =>
      !p.id
        ? p.text
        : p.status === "accepted" || (proposal && p.status === "pending")
          ? p.after
          : p.before,
    )
    .join("");
}
function decide(review, ids, status) {
  if (!["accepted", "rejected", "pending"].includes(status))
    throw new Error("Invalid decision");
  const selected = new Set(ids);
  for (const span of review.spans)
    if (span.id && selected.has(span.id) && span.status !== status) {
      review.events.push({
        changeId: span.id,
        from: span.status,
        to: status,
        at: new Date().toISOString(),
      });
      span.status = status;
    }
  return review;
}
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function metricsCSV(drafts, projects) {
  return [
    [
      "Title",
      "Project",
      "Created",
      "Status",
      "Raw words",
      "Draft words",
      "Audio seconds",
      "Reported API cost USD",
    ],
    ...drafts.map((d) => [
      d.title,
      projects.find((p) => p.id === d.projectId)?.name || "",
      d.createdAt,
      d.status,
      wordCount(d.raw),
      wordCount(d.working),
      d.duration || 0,
      d.cost ?? "",
    ]),
  ]
    .map((r) => r.map(csvCell).join(","))
    .join("\r\n");
}
module.exports = { wordCount, makeReview, reviewText, decide, metricsCSV };
