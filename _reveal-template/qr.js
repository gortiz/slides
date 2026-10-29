// QR codes that link a slide to its source, with an optional logo in the middle.
//
//   <a class="qr" href="https://…" data-logo="spotify" data-label="engineering.atspotify.com"></a>
//
// Inside a slide, the code sits in the top-right corner (see theme.css). Inside a .watch-card it
// flows inline. The code uses error correction level H (30%), so the centre logo does not stop
// phones from reading it. data-label defaults to the link's host name; data-label="" drops the caption.
(function () {
  "use strict";

  // Inline scripts (single-file build) have no src: resolve logos against the page instead.
  const BASE = new URL(".", document.currentScript?.src || location.href);
  // Brand icons: Simple Icons (CC0) paths, coloured here; raster logos used as they are.
  const LOGOS = {
    spotify: { file: "logos/spotify.svg", color: "#1DB954" },
    youtube: { file: "logos/youtube.svg", color: "#FF0000" },
    apache: { file: "logos/apache.svg", color: "#D22128" },
    slack: { file: "logos/slack.svg", color: "#4A154B" },
    startree: { file: "logos/startree.png" },
  };
  const NS = "http://www.w3.org/2000/svg";
  const svgCache = new Map();

  function el(name, attrs) {
    const node = document.createElementNS(NS, name);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }

  function modules(url) {
    const qr = qrcode(0, "H");
    qr.addData(url);
    qr.make();
    return qr;
  }

  // One path with a square per dark module: small DOM, crisp at any size.
  function codePath(qr, quiet) {
    const n = qr.getModuleCount();
    let d = "";
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
      }
    }
    return d;
  }

  async function logoNode(name, center, size) {
    const logo = LOGOS[name];
    if (!logo) return null;
    const group = el("g", {});
    const pad = size * 0.14;
    group.appendChild(el("rect", {
      x: center - size / 2 - pad, y: center - size / 2 - pad,
      width: size + 2 * pad, height: size + 2 * pad, rx: pad, style: "fill: var(--ground)",
    }));
    if (logo.file.endsWith(".svg") || logo.file.startsWith("data:image/svg+xml")) {
      if (!svgCache.has(logo.file)) {
        const text = await (await fetch(new URL(logo.file, BASE))).text();
        svgCache.set(logo.file, new DOMParser().parseFromString(text, "image/svg+xml"));
      }
      const source = svgCache.get(logo.file).documentElement;
      const [, , w] = (source.getAttribute("viewBox") ?? "0 0 24 24").split(/\s+/).map(Number);
      const inner = el("g", {
        transform: `translate(${center - size / 2} ${center - size / 2}) scale(${size / w})`,
        fill: logo.color,
      });
      source.querySelectorAll("path").forEach((p) => inner.appendChild(el("path", { d: p.getAttribute("d") })));
      group.appendChild(inner);
    } else {
      group.appendChild(el("image", {
        href: new URL(logo.file, BASE).href,
        x: center - size / 2, y: center - size / 2, width: size, height: size,
      }));
    }
    return group;
  }

  async function render(anchor) {
    if (anchor.dataset.rendered) return;
    const qr = modules(anchor.href);
    const quiet = 3;
    const n = qr.getModuleCount() + 2 * quiet;
    const svg = el("svg", { viewBox: `0 0 ${n} ${n}`, class: "qr-code", "shape-rendering": "crispEdges" });
    // No background rect: the quiet zone shows the slide ground (light in every theme of this template).
    svg.appendChild(el("path", { d: codePath(qr, quiet), fill: "#121A1D" }));
    if (anchor.dataset.logo) {
      const logo = await logoNode(anchor.dataset.logo, n / 2, n * 0.16);
      if (logo) svg.appendChild(logo);
    }
    anchor.replaceChildren(svg);
    const text = anchor.dataset.label ?? new URL(anchor.href).hostname.replace(/^www\./, "");
    if (text) {  // data-label="" means no caption
      const label = document.createElement("span");
      label.className = "qr-label";
      label.textContent = text;
      anchor.appendChild(label);
    }
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.dataset.rendered = "true";
  }

  document.addEventListener("deck:assembled", () => {
    if (!window.qrcode) {
      console.warn("qr.js: qrcode-generator is not loaded");
      return;
    }
    document.querySelectorAll("a.qr").forEach(render);
  });
})();
