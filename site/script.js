const menu = document.querySelector(".menu-button");
const links = document.querySelector(".nav-links");

function closeMenu() {
  menu?.setAttribute("aria-expanded", "false");
  menu?.setAttribute("aria-label", "Open navigation");
  links?.classList.remove("open");
}

menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute(
    "aria-label",
    open ? "Close navigation" : "Open navigation",
  );
  links?.classList.toggle("open", open);
});
document.querySelectorAll(".nav-links a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    menu?.getAttribute("aria-expanded") === "true"
  ) {
    closeMenu();
    menu.focus();
  }
});

// A local, reversible example. No API calls, storage, or edits to the original.
const changes = [...document.querySelectorAll("[data-change]")];
const states = changes.map(() => "pending");
const acceptAll = document.querySelector(".accept-all");
const reset = document.querySelector(".reset-demo");
const status = document.querySelector(".compare-status");

function renderReview() {
  changes.forEach((change, index) => {
    const state = states[index];
    change.classList.toggle("accepted", state === "accepted");
    change.classList.toggle("rejected", state === "rejected");
    change.querySelector(".change-status").textContent =
      state[0].toUpperCase() + state.slice(1);
    change.querySelectorAll("[data-decision]").forEach((button) => {
      button.hidden =
        button.dataset.decision === "pending"
          ? state === "pending"
          : state !== "pending";
    });
    const artifact = document.querySelector(`[data-artifact="${index}"]`);
    if (artifact) artifact.hidden = state !== "rejected";
  });
  const reviewed = states.filter((state) => state !== "pending").length;
  if (status) status.textContent = `${reviewed} of ${states.length} reviewed`;
  if (acceptAll) acceptAll.disabled = reviewed === states.length;
  if (reset) reset.disabled = reviewed === 0;
}

changes.forEach((change, index) => {
  change.querySelectorAll("[data-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      states[index] = button.dataset.decision;
      renderReview();
      // Keep keyboard focus on this decision after its control is replaced.
      change.querySelector("[data-decision]:not([hidden])")?.focus();
    });
  });
});
acceptAll?.addEventListener("click", () => {
  states.forEach((state, index) => {
    if (state === "pending") states[index] = "accepted";
  });
  renderReview();
  reset?.focus();
});
reset?.addEventListener("click", () => {
  states.fill("pending");
  renderReview();
  changes[0]?.querySelector("[data-decision]")?.focus();
});
renderReview();
