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

## Export to PDF

```sh
template/export-pdf.sh                  # one page per slide, all fragments shown -> <folder>.pdf
template/export-pdf.sh talk.pdf --steps # one page per fragment step
```

The script serves the folder, runs [DeckTape](https://github.com/astefanutti/decktape) through `npx`
with your local Chrome, and stops the server. Text stays selectable.

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
