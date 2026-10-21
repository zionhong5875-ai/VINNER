// Keep native details/summary semantics and keyboard activation, but delay
// closing `open` until the answer's height animation has finished.
export function initFaqAccordion(root, { reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches } = {}) {
  const entries = [...root.querySelectorAll("details")].map(detail => ({
    detail,
    summary: detail.querySelector("summary"),
    panel: detail.querySelector(".faq-panel"),
    expanded: detail.open,
    animation: null
  }));

  const setExpanded = (entry, expanded) => {
    const { detail, summary, panel } = entry;
    const startHeight = detail.open ? panel.getBoundingClientRect().height : 0;
    if (entry.animation) {
      entry.animation.onfinish = null;
      entry.animation.cancel();
      entry.animation = null;
    }
    entry.expanded = expanded;
    detail.dataset.expanded = String(expanded);
    summary.setAttribute("aria-expanded", String(expanded));
    if (expanded) {
      detail.open = true;
      panel.hidden = false;
    }
    // Clip content throughout every frame, even if preview CSS is stale.
    panel.style.overflow = "hidden";
    const endHeight = expanded ? panel.scrollHeight : 0;
    panel.style.height = `${endHeight}px`;

    const finish = () => {
      detail.open = entry.expanded;
      panel.hidden = !entry.expanded;
      panel.style.height = entry.expanded ? "auto" : "0px";
      entry.animation = null;
    };
    if (reducedMotion() || !panel.animate) {
      finish();
      return;
    }
    entry.animation = panel.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 360, easing: "cubic-bezier(.22,1,.36,1)" }
    );
    entry.animation.onfinish = finish;
  };

  entries.forEach(entry => {
    entry.panel.style.overflow = "hidden";
    entry.panel.style.height = entry.expanded ? "auto" : "0px";
    entry.panel.hidden = !entry.expanded;
    entry.summary.setAttribute("aria-expanded", String(entry.expanded));
    entry.summary.addEventListener("click", event => {
      event.preventDefault();
      const expanded = !entry.expanded;
      if (expanded) entries.filter(other => other !== entry && other.expanded).forEach(other => setExpanded(other, false));
      setExpanded(entry, expanded);
    });
  });
}
