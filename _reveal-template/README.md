# Reveal.js talk template

A reusable reveal.js setup for every talk in this repo. It gives each slide the same frame — title
row, body and footer at fixed positions — and builds the deck from several small HTML files, so
edits stay fast.

Everything is vendored (reveal.js 5.1.0, Rough.js 4.6.6, fonts), so a deck works offline.

## Use it in a new talk

```sh
mkdir my-talk && cd my-talk
ln -s ../_reveal-template template
cp ../_template-example/index.html .
mkdir chapters
python3 -m http.server          # then open http://localhost:8000/
```

Edit `window.DECK.chapters` in `index.html` to list your chapter files in order. Press `S` for the
speaker view and `?` for all shortcuts. Add `?all-fragments` to the URL to see every fragment at
once while reviewing.

To drop a slide without deleting it, add `data-visibility="hidden"` to its `<section>`: it leaves the
deck, the slide count, the PDF and the single-file build. Add `?show-hidden` to the URL to review
those slides; they come back tagged HIDDEN. For backup slides you may need during Q&A, put them after
the last slide with `data-visibility="uncounted"` and jump to them with `G`.

## Export to PDF

```sh
template/export-pdf.sh                  # one page per slide, all fragments shown -> <folder>.pdf
template/export-pdf.sh talk.pdf --steps # one page per fragment step
```

The script serves the folder, runs [DeckTape](https://github.com/astefanutti/decktape) through `npx`
with your local Chrome, and stops the server. Text stays selectable.

## Share as one HTML file

```sh
template/build-single.py                         # -> <folder>.html, with speaker notes
template/build-single.py out.html --public       # no speaker notes, no time slots: for publishing
template/build-single.py out.html --public --extended   # also the slides hidden for time
```

Hidden slides are left out of a build unless `--extended`. Mark an old version kept only for rollback
with `data-superseded` (besides `data-visibility="hidden"`): no build ever includes it.

Builds one self-contained HTML file with the transitions and fragments: scripts, styles, fonts,
chapters, images and QR logos are all inlined. Open it with a double click (no server). Python is
needed only to build it.

Without Node: open `http://localhost:8000/?print-pdf` in Chrome and print to PDF (Cmd+P, margins
*None*, background graphics on). Wait until the slides are visible before printing — Chrome's
own headless `--print-to-pdf` prints before the chapters load and is not usable.

## Files

The sibling folder `../_template-example/` holds one slide per layout. Open it to check the
template after a change.


| File | Purpose |
|---|---|
| `theme.css` | Palette, fonts, the slide frame and the layouts |
| `loader.js` | Fetches the chapter files, wraps each slide in its frame, starts reveal.js |
| `export-pdf.sh` | PDF export with DeckTape |
| `build-single.py` | One self-contained HTML file to share |
| `poll.js` | Live audience polls (see `../_poll-server/`) |
| `sketch.js` | Redraws `<svg class="sketch">` diagrams by hand with Rough.js |
| `qr.js` | Renders `<a class="qr">` source links as QR codes with a centre logo |
| `logos/` | Centre logos for QR codes (Simple Icons, CC0, plus raster brand icons) |
| `vendor/` | reveal.js, its notes plugin, Rough.js |
| `fonts/` | Archivo (titles), Source Sans 3 (body), JetBrains Mono (code, labels), Kalam (hand-drawn labels) |

## Writing a slide

Write flat markup. The loader adds the frame.

```html
<section class="layout-split">
  <h2>A commit is one pointer swap</h2>
  <ul class="points">
    <li>Write new files</li>
    <li class="fragment">Swap the pointer</li>
  </ul>
  <figure class="diagram"> <svg>…</svg> </figure>
  <aside class="notes">What you say goes here, in full sentences.</aside>
</section>
```

### Layouts

| Class on `<section>` | Shape |
|---|---|
| `layout-cover` | Title slide. Content in `<div class="cover">` with `h1`, `.deck`, `.who` |
| `layout-chapter` | Chapter divider. Content in `<div class="chapter">` with `.num`, `.name`, `.tagline` |
| `layout-split` | Bullets left, diagram right (5:7). Add `even` for 1:1. Wrap bullets plus a footnote in `<div class="left-stack">` |
| `layout-full` | Title plus one wide diagram or table, and an optional `<p class="footnote">` below it |
| `layout-statement` | One sentence in a `<p>` or `<blockquote>`, optional `<cite>`. No title |

The footer shows the chapter label from `index.html`. Set `data-chapter` on a `<section>` to
override it.

A corner badge marks a slide's category, left of the slide number. Define the badges once in
`index.html` and reference them by key:

```js
window.DECK = { chapters: [...], badges: { oss: { label: "Open source", tone: "ice" } } };
```
```html
<section class="layout-split" data-badge="oss">…</section>
```

Tones: `ice`, `wine`, `amber`, `good`, `muted`. Table rows take `class="highlight"` (second accent)
or `class="highlight good"` (positive green).

### Rules for slide text

- **Bullets, not sentences.** At most five bullets, about six words each. They must fit in half a
  slide.
- **Prose goes in the speaker notes** (`<aside class="notes">`), never on the slide.
- **Never move the title.** Do not add margins or padding to `h2` or to the frame on one slide. To
  change the geometry, change the variables at the top of `theme.css`.
- **One diagram per slide.** Use `<figure class="diagram todo">label</figure>` as a placeholder until
  the real one exists.
- Use `class="fragment"` to build bullets and diagram steps in sync.

### Colours

`--accent-1` and `--accent-2` are the two main actors of a talk (use `.ice` and `.wine` for inline
text), and `--accent-3` marks costs and warnings. Change the values in `:root` for another talk.

## Hand-drawn diagrams

Write the diagram as plain SVG inside `<figure class="diagram"><svg class="sketch" viewBox="…">`.
`sketch.js` redraws every `rect`, `ellipse`, `circle`, `line`, `polyline` and `path` with Rough.js
when the deck loads. Text stays real SVG text in the hand font.

| Attribute | Values |
|---|---|
| `data-tone` | `ink` (default), `ice`, `wine`, `amber`, `muted` — the stroke colour |
| `data-fill` | `none` (default), `wash`, `hachure`, `solid` |
| `class="arrow"` | On `line`, `polyline` or `path`: adds an arrowhead |
| `data-color`, `data-wash` | Explicit colours, overriding the tone (e.g. extra greys in a chart) |
| `data-rough="off"` | Keep the shape exactly as written |
| `data-stroke-width`, `data-roughness` | Fine tuning |

Text classes: `title` (mono label), `small`, `center`, and the tone names (`ice`, `wine`, …).

Wrap a step in `<g class="fragment">`: its strokes draw themselves when it appears. The animation is
off with `?all-fragments`, in PDF export and for reduced-motion users. Seeds are fixed, so a
diagram looks the same on every reload.

To show a diagram first and then make room for a table under it, give the table (or any element)
`class="fragment lift"` and the figure a `style="--lift: -110px"`. When the fragment appears, the
diagram slides up by `--lift`; a `table.grid.lift` in `layout-full` sits at the bottom of the body.
Text that should go away at the same step goes in a `<g class="fragment fade-out">` with the same
`data-fragment-index`. That text fades while the diagram moves, and the fragments that appear at that step wait
until the diagram stops.

The body of a `layout-full` slide is about 1136 × 520 canvas pixels, so `viewBox="0 0 1136 520"`
maps one SVG unit to one pixel. For the right column of `layout-split`, use about 640 × 520.

## Source links as QR codes

Put `<a class="qr" href="https://…" data-logo="spotify"></a>` anywhere in a slide. It renders at
170 px in the bottom-left corner of the body, so keep that corner free on slides with a QR. On a
`layout-full` slide the footnote moves right to make room. Add `class="qr at-right"` to use the
bottom-right corner instead when the bottom-left is busy. `class="qr at-top-right"` puts the code
beside the title, for slides whose bottom corners are both busy. `data-logo` is one of the
keys in `qr.js` (`spotify`, `youtube`, `apache`, `startree`); add a file under `logos/` and a key to
add more. `data-label` overrides the caption, which defaults to the host name; `data-label=""` drops it.

The code has no background of its own: the quiet zone shows the slide ground, so keep the ground light.
The code uses error correction level H, so the logo does not break it. In the PDF export the code
stays a clickable link. A `.link-grid` of `.link` cards makes a closing slide with every link.

A `.watch-card` (thumbnail, QR, kicker, title, author) recommends a video or article; on a
`layout-chapter` slide it sits in the bottom-right corner.

## Live polls

`poll.js` turns a slide into a live audience poll backed by the poll server (`../_poll-server/`):

```html
<section data-poll="parquet">
  <h2>Have you written a Parquet file?</h2>
  <div class="poll" data-question="Have you written a Parquet file?" data-options="Yes|No"></div>
  <span class="fragment poll-reveal"></span>
  <a class="qr" href="https://poll.gortizja.com/" data-label="poll.gortizja.com"></a>
</section>
```

Set `window.DECK.poll = { url: "https://poll.gortizja.com" }` and load `poll-token.js` (the admin
token, never committed) and `template/poll.js` before `template/loader.js`. When the slide becomes
current, the deck opens the question; it shows the number of votes until the `poll-reveal` fragment,
then the bars. Leaving the slide closes the question. Without a token, in review mode and in PDF
export, the slide shows the options and asks for a show of hands. `build-single.py --public` leaves
the token out.

## Cover and chapter art

Put `<img class="art" src="assets/….png" alt="">` in a `layout-cover` or `layout-chapter` section to
show a transparent PNG on the right of the frame. The title column narrows to make room. Crop the
image to its content first, so it sits where you expect.
