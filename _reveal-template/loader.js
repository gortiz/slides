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

  function frame(section, label) {
    const notes = [...section.children].filter((el) => el.matches("aside.notes"));
    const wrapper = document.createElement("div");
    wrapper.className = "frame";
    wrapper.dataset.chapter = section.dataset.chapter ?? label ?? "";
    [...section.childNodes].forEach((node) => {
      if (!notes.includes(node)) wrapper.appendChild(node);
    });
    section.prepend(wrapper);
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
        deck.chapters.map(async ({ file }) => {
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
          frame(section, deck.chapters[i].label);
          slides.appendChild(section);
        });
    });
    document.dispatchEvent(new CustomEvent("deck:assembled"));
    const plugins = window.RevealNotes ? [window.RevealNotes] : [];
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
