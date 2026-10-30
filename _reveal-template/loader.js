// Builds a reveal.js deck from several HTML files, then starts reveal.js.
//
// index.html defines `window.DECK` before loading this script:
//
//   window.DECK = {
//     chapters: [ { file: "chapters/01-intro.html", label: "Intro" }, ... ],
//     reveal: { /* optional reveal.js overrides */ },
//   };
//
// Each chapter file holds plain <section> elements. For every top-level <section> the loader:
//   1. wraps its content (all but <aside class="notes">) in <div class="frame">, which carries the
//      fixed title / body / footer grid from theme.css;
//   2. stamps the chapter label on the frame (shown in the footer) unless the section sets its own
//      data-chapter attribute.
//
// Chapter files are fetched, so the deck must be served over HTTP (python3 -m http.server).
(function () {
  "use strict";

  const DEFAULTS = {
    width: 1280,
    height: 720,
    margin: 0,
    center: false,          // keeps every title in the same place
    hash: true,
    slideNumber: "c/t",
    transition: "fade",
    transitionSpeed: "fast",
    backgroundTransition: "none",
    controls: false,
    progress: true,
    pdfSeparateFragments: false,
  };

  function showError(message) {
    const box = document.createElement("pre");
    box.className = "deck-error";
    box.textContent = message;
    document.body.appendChild(box);
  }

  // `data-badge="key"` on a <section> shows a corner badge defined in window.DECK.badges:
  //   badges: { oss: { label: "Apache Pinot · OSS", tone: "ice" } }
  function badge(section, wrapper) {
    const key = section.dataset.badge;
    if (!key) return;
    const spec = window.DECK?.badges?.[key] ?? { label: key, tone: "muted" };
    const el = document.createElement("span");
    el.className = `badge tone-${spec.tone ?? "muted"}`;
    el.textContent = spec.label;
    wrapper.appendChild(el);
  }

  function frame(section, label) {
    const notes = [...section.children].filter((el) => el.matches("aside.notes"));
    const wrapper = document.createElement("div");
    wrapper.className = "frame";
    wrapper.dataset.chapter = section.dataset.chapter ?? label ?? "";
    [...section.childNodes].forEach((node) => {
      if (!notes.includes(node)) wrapper.appendChild(node);
    });
    badge(section, wrapper);
    section.prepend(wrapper);
    if (section.classList.contains("night")) night(section);
  }

  // class="night" on a section: dark slide. Reveal paints the background and, through data-state,
  // tags the viewport so the slide number and progress bar can change colour too.
  function night(section) {
    const ground = getComputedStyle(document.documentElement).getPropertyValue("--night-ground").trim();
    section.dataset.backgroundColor ??= ground || "#092653";
    section.dataset.state = [section.dataset.state, "night"].filter(Boolean).join(" ");
  }

  // `minutes` on a chapter in window.DECK.chapters spreads that time over the chapter's visible slides
  // and prints the slot ("⏱ 14:05 → 15:10") at the top of each slide's speaker notes. A slide weighs 1
  // plus 0.25 per fragment step; cover and chapter slides weigh 0.35, statements 0.6. data-weight on a
  // <section> overrides the computed weight.
  function slideWeight(section) {
    if (section.dataset.weight) return Number(section.dataset.weight);
    if (section.matches(".layout-cover, .layout-chapter")) return 0.35;
    if (section.matches(".layout-statement")) return 0.6;
    const indexes = new Set([...section.querySelectorAll("[data-fragment-index]")].map((f) => f.dataset.fragmentIndex));
    const steps = indexes.size || section.querySelectorAll(".fragment").length;
    return 1 + 0.25 * steps;
  }

  function clock(seconds) {
    const s = Math.round(seconds);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }

  function stampTimings(slides, chapters) {
    if (!chapters.some((c) => typeof c.minutes === "number")) return;
    let start = 0;
    chapters.forEach((chapter, i) => {
      const sections = [...slides.children].filter(
        (s) => s.dataset.chapterIndex === String(i) && s.dataset.visibility !== "hidden"
      );
      const weights = sections.map(slideWeight);
      const total = weights.reduce((a, b) => a + b, 0) || 1;
      sections.forEach((section, k) => {
        const length = ((chapter.minutes ?? 0) * 60 * weights[k]) / total;
        let notes = section.querySelector(":scope > aside.notes");
        if (!notes) {
          notes = document.createElement("aside");
          notes.className = "notes";
          section.appendChild(notes);
        }
        const stamp = document.createElement("p");
        stamp.className = "timing";
        stamp.innerHTML = `<strong>⏱ ${clock(start)} → ${clock(start + length)}</strong>`;
        notes.prepend(stamp);
        start += length;
      });
    });
  }

  async function load() {
    const deck = window.DECK;
    if (!deck || !Array.isArray(deck.chapters)) {
      showError("window.DECK.chapters is missing: define it in index.html before loader.js.");
      return;
    }
    const slides = document.querySelector(".reveal .slides");
    let texts;
    try {
      texts = await Promise.all(
        deck.chapters.map(async ({ file, html }) => {
          // A single-file build (build-single.py) embeds each chapter's HTML: no fetch needed.
          if (typeof html === "string") return html;
          const response = await fetch(file, { cache: "no-store" });
          if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
          return response.text();
        })
      );
    } catch (error) {
      showError(
        `Could not load the chapter files (${error.message}).\n\n` +
          "Serve the deck over HTTP from the talk folder:\n  python3 -m http.server\n" +
          "then open http://localhost:8000/"
      );
      return;
    }
    texts.forEach((html, i) => {
      const holder = document.createElement("div");
      holder.innerHTML = html;
      [...holder.children]
        .filter((el) => el.tagName === "SECTION")
        .forEach((section) => {
          section.dataset.chapterIndex = String(i);
          frame(section, deck.chapters[i].label);
          slides.appendChild(section);
        });
    });
    // data-visibility="hidden" removes a slide from the deck; `?show-hidden` brings those slides back,
    // tagged HIDDEN, so you can review them without editing the chapter files.
    if (new URLSearchParams(location.search).has("show-hidden")) {
      slides.querySelectorAll('section[data-visibility="hidden"]').forEach((section) => {
        section.removeAttribute("data-visibility");
        section.classList.add("was-hidden");
      });
    }
    stampTimings(slides, deck.chapters);
    document.dispatchEvent(new CustomEvent("deck:assembled"));
    // Plugins load only when index.html includes their script: notes always, highlight for talks with code.
    const plugins = [window.RevealNotes, window.RevealHighlight].filter(Boolean);
    // `?all-fragments` shows every fragment at once: handy to review a deck for overflow.
    const reviewMode = new URLSearchParams(location.search).has("all-fragments");
    await Reveal.initialize({
      ...DEFAULTS,
      plugins,
      ...(deck.reveal ?? {}),
      ...(reviewMode ? { fragments: false } : {}),
    });
  }

  load();
})();
