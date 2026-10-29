# CLAUDE.md - slides

Private repo with Gonzalo's conference talks. Each talk is a folder. New talks use the reveal.js
template in `_reveal-template/`. The older talks (`pinot/`, `java-offheap/`) use earlier formats:
leave them as they are unless asked.

## Layout

| Path | What it is |
|---|---|
| `_reveal-template/` | Shared template: theme, loader, Rough.js sketches, QR codes, PDF export, single-file build. Its `README.md` documents every layout and helper. |
| `_template-example/` | One slide per layout. Copy it to start a new talk. |
| `<talk>/index.html` | Deck entry: `window.DECK` lists the chapter files in order, their footer labels and the corner badges. |
| `<talk>/chapters/NN-name.html` | Plain `<section>` elements, one file per chapter. |
| `<talk>/template` | Symlink to `../_reveal-template`. |
| `<talk>/assets/` | Images the slides use. |
| `<talk>/research/` | Notes, sources and drafts. Never published. |
| `serve.sh` | `./serve.sh <talk> [port]` serves one talk at http://127.0.0.1:8000/. |

## Start a new talk

```sh
cp -R _template-example <slug>          # slug in kebab-case, e.g. iceberg-pinot
cd <slug> && ln -sfn ../_reveal-template template
```

Then edit `index.html` (title, chapters, badges) and the chapter files. Read
`_reveal-template/README.md` before writing slides; reuse its layouts instead of adding per-slide CSS.

## Writing slides

- Slides, notes and every file in this repo are in English.
- Prefer a diagram over bullets. When the diagram says the same as the bullets, drop the bullets and
  use `layout-full` so the figure is centred.
- Keep bullets short: they fit in half a slide.
- Titles are short names, not sentences.
- Put what the speaker says in `<aside class="notes">`: numbers, sources, caveats, transitions.
- Cite every external source with a QR code (`<a class="qr" …>`) and list it on the closing Links
  slide. Label two links from the same site so they can be told apart.
- Mark illustrative numbers as illustrative in the notes. Never present an estimate as a measurement.
- Fragments build a slide step by step. Use them when the order of the story matters, not by default.
- Keep customer names, internal tickets and unpublished numbers off the slides. Internal context
  belongs in `research/`.
- Change the template (`_reveal-template/`) when a fix or feature is generic, and document it in
  its README, so every talk gets it.

## Review

- `?all-fragments` in the URL shows every fragment at once.
- Check each changed slide in a screenshot (headless Chrome, 1280x720) for overlaps and overflow.
  Use a fresh `--user-data-dir` per screenshot, or Chrome serves cached CSS/JS.
- Decode QR codes from a screenshot before trusting them.

## Build and export

Run these from the talk folder:

```sh
./template/export-pdf.sh <slug>.pdf              # PDF, every fragment shown (--steps: one page per step)
./template/build-single.py                       # one self-contained <slug>.html, with speaker notes
./template/build-single.py out.html --public     # the same without speaker notes, for publishing
```

The single-file build opens with a double click: no server, no Python. Python is needed only to
build it. The generated `.html` and `.pdf` in a talk folder are outputs: regenerate them, do not
edit them.

## Publish

Published talks live in the public GitHub Pages repo `gortiz/gortiz.github.io`, served at
https://gortizja.com. The site is plain static files (`.nojekyll`, no build step):

| Path in the site repo | Content |
|---|---|
| `talks/<slug>/index.html` | `build-single.py … --public` output |
| `talks/<slug>/<slug>.pdf` | `export-pdf.sh` output |
| `index.html`, `talks/index.html` | Lists of talks: add an entry for each new talk |

```sh
cd <slides-repo>/<slug>
./template/build-single.py <site-repo>/talks/<slug>/index.html --public
./template/export-pdf.sh <site-repo>/talks/<slug>/<slug>.pdf
```

Then commit and push in the site repo, and check that the URLs answer 200.

- Always publish with `--public`: speaker notes are private.
- Everything in the site repo is public, including any notes or config files committed there.
- Ask before pushing to the site repo.

## Git

- Ask before committing. Talks in progress may stay uncommitted on purpose.
- Do not commit copies of third-party articles or other material kept only for reference.
