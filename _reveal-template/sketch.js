// Hand-drawn diagrams for reveal.js, built on Rough.js.
//
// Author a diagram as plain SVG inside <svg class="sketch">, then this script redraws every
// shape with Rough.js. Plain SVG keeps diagrams small, diffable and easy to edit.
//
//   <svg class="sketch" viewBox="0 0 1136 520">
//     <rect x="10" y="10" width="200" height="80" data-tone="ice" data-fill="wash"/>
//     <line x1="110" y1="90" x2="110" y2="200" class="arrow"/>
//     <text x="110" y="55">label</text>
//     <g class="fragment"> …shapes that appear on the next click… </g>
//   </svg>
//
// Shapes: rect, ellipse, circle, line, polyline, path. Attributes:
//   data-tone   ink (default) | ice | wine | amber | muted   stroke colour, from theme.css
//   data-fill   none (default) | wash | hachure | solid       fill style, in the tone's colour
//   class=arrow on line / path / polyline                     adds a hand-drawn arrowhead
//   data-color  explicit stroke colour (overrides data-tone); data-wash: explicit wash colour
//   data-rough  "off" keeps the shape exactly as written
// Text stays real SVG text in the hand font (see theme.css), so it is crisp and searchable.
//
// Strokes "draw themselves" when their fragment appears. Animation is skipped when fragments
// are off (?all-fragments), in print mode, and for prefers-reduced-motion.
(function () {
  "use strict";

  const SHAPES = "rect, ellipse, circle, line, polyline, path";
  const TONES = {
    ink: ["--ink", "--surface-sunk"],
    ice: ["--accent-1", "--accent-1-wash"],
    wine: ["--accent-2", "--accent-2-wash"],
    amber: ["--accent-3", "--accent-3-wash"],
    muted: ["--muted", "--surface-sunk"],
  };

  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // Stable seed per shape, so a diagram looks the same on every reload and in the PDF.
  function seedFor(svgIndex, shapeIndex) {
    return ((svgIndex + 1) * 7919 + (shapeIndex + 1) * 104729) % 2147483647 || 1;
  }

  function options(el, seed) {
    const [strokeVar, washVar] = TONES[el.dataset.tone] ?? TONES.ink;
    // data-color overrides the tone with an explicit colour (e.g. extra greys in a chart)
    const stroke = el.dataset.color ?? cssVar(strokeVar);
    const fill = el.dataset.fill ?? "none";
    const opts = {
      seed,
      stroke,
      strokeWidth: Number(el.dataset.strokeWidth ?? 2),
      roughness: Number(el.dataset.roughness ?? 1.1),
      bowing: 1,
    };
    if (fill === "wash") Object.assign(opts, { fill: el.dataset.wash ?? cssVar(washVar), fillStyle: "solid" });
    if (fill === "solid") Object.assign(opts, { fill: stroke, fillStyle: "solid" });
    if (fill === "hachure") Object.assign(opts, { fill: stroke, fillStyle: "hachure", hachureGap: 7, fillWeight: 1 });
    return opts;
  }

  const num = (el, name) => Number(el.getAttribute(name) ?? 0);

  function points(el) {
    return el
      .getAttribute("points")
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .reduce((acc, v, i) => (i % 2 ? (acc[acc.length - 1].push(v), acc) : (acc.push([v]), acc)), []);
  }

  // Last segment of a shape, for the arrowhead direction.
  function lastSegment(el) {
    switch (el.tagName) {
      case "line":
        return [[num(el, "x1"), num(el, "y1")], [num(el, "x2"), num(el, "y2")]];
      case "polyline": {
        const p = points(el);
        return [p[p.length - 2], p[p.length - 1]];
      }
      case "path": {
        const len = el.getTotalLength();
        const a = el.getPointAtLength(Math.max(0, len - 12));
        const b = el.getPointAtLength(len);
        return [[a.x, a.y], [b.x, b.y]];
      }
      default:
        return null;
    }
  }

  function arrowhead(rc, el, opts) {
    const seg = lastSegment(el);
    if (!seg) return null;
    const [[x1, y1], [x2, y2]] = seg;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const size = Number(el.dataset.head ?? 14);
    const wing = (sign) => [x2 - size * Math.cos(angle + sign * 0.45), y2 - size * Math.sin(angle + sign * 0.45)];
    return rc.linearPath([wing(1), [x2, y2], wing(-1)], { ...opts, fill: undefined });
  }

  function draw(rc, el, opts) {
    switch (el.tagName) {
      case "rect":
        return rc.rectangle(num(el, "x"), num(el, "y"), num(el, "width"), num(el, "height"), opts);
      case "ellipse":
        return rc.ellipse(num(el, "cx"), num(el, "cy"), 2 * num(el, "rx"), 2 * num(el, "ry"), opts);
      case "circle":
        return rc.circle(num(el, "cx"), num(el, "cy"), 2 * num(el, "r"), opts);
      case "line":
        return rc.line(num(el, "x1"), num(el, "y1"), num(el, "x2"), num(el, "y2"), opts);
      case "polyline":
        return rc.linearPath(points(el), opts);
      case "path":
        return rc.path(el.getAttribute("d"), opts);
      default:
        return null;
    }
  }

  // Prepare strokes for the draw-on animation: each path gets its own length as dash pattern.
  function prepareDrawOn(group) {
    group.querySelectorAll("path").forEach((path) => {
      const length = Math.ceil(path.getTotalLength());
      path.classList.add("draw");
      path.style.setProperty("--len", String(length));
    });
  }

  function renderSvg(svg, svgIndex) {
    if (svg.dataset.sketched) return;
    const rc = rough.svg(svg);
    [...svg.querySelectorAll(SHAPES)].forEach((el, i) => {
      if (el.dataset.rough === "off" || el.closest("defs")) return;
      const opts = options(el, seedFor(svgIndex, i));
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.classList.add("rough");
      const shape = draw(rc, el, opts);
      if (!shape) return;
      group.appendChild(shape);
      if (el.classList.contains("arrow")) {
        const head = arrowhead(rc, el, opts);
        if (head) group.appendChild(head);
      }
      prepareDrawOn(group);
      el.replaceWith(group);
    });
    svg.dataset.sketched = "true";
  }

  function renderAll() {
    if (!window.rough) {
      console.warn("sketch.js: Rough.js is not loaded");
      return;
    }
    document.querySelectorAll("svg.sketch").forEach(renderSvg);
  }

  // Shapes need layout (getTotalLength), so render once reveal.js has the slides in place.
  document.addEventListener("deck:assembled", () => {
    renderAll();
    Reveal.on("ready", () => {
      const params = new URLSearchParams(location.search);
      const staticMode =
        !Reveal.getConfig().fragments ||
        params.has("print-pdf") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.documentElement.classList.toggle("sketch-static", staticMode);
    });
  });
})();
