#!/usr/bin/env python3
"""Builds one self-contained HTML file from a talk folder: open it with a double click, no server.

    template/build-single.py                 # run from the talk folder -> <folder>.html
    template/build-single.py out.html
    template/build-single.py out.html --public              # no speaker notes, no time slots
    template/build-single.py out.html --public --extended   # same, plus the slides hidden for time

Hidden slides (data-visibility="hidden") are left out unless --extended. Slides marked
data-superseded (old versions kept only for rollback) are always left out.

Inlines the stylesheets (fonts as data: URIs), the scripts, every chapter (images as data: URIs) and
the QR logos. Python is needed only to build; the output needs nothing but a browser.
"""
import base64
import mimetypes
import os
import re
import sys

TALK = os.getcwd()
ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
PUBLIC = "--public" in sys.argv[1:]
EXTENDED = "--extended" in sys.argv[1:]
OUT = ARGS[0] if ARGS else os.path.basename(TALK) + ".html"
MIME = {".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp"}


def data_uri(path):
    ext = os.path.splitext(path)[1].lower()
    mime = MIME.get(ext) or mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode()


def is_local(ref):
    return not re.match(r"^(data:|https?:|//|#)", ref)


def inline_css(path):
    """Reads a stylesheet, inlining @import and turning url(...) into data: URIs."""
    base = os.path.dirname(path)
    css = open(path, encoding="utf-8").read()
    css = re.sub(r'@import\s+url\(["\']?([^"\')]+)["\']?\)\s*;',
                 lambda m: inline_css(os.path.join(base, m.group(1))) if is_local(m.group(1)) else m.group(0), css)
    return re.sub(r'url\(["\']?([^"\')]+)["\']?\)',
                  lambda m: f'url("{data_uri(os.path.join(base, m.group(1)))}")' if is_local(m.group(1)) else m.group(0),
                  css)


def script(src):
    path = os.path.join(TALK, src)
    if os.path.basename(src) == "poll-token.js" and PUBLIC:
        return "<!-- poll token left out of the public build -->"
    if not os.path.exists(path):  # optional scripts such as poll-token.js
        return f"<!-- {src} not found, skipped -->"
    js = open(path, encoding="utf-8").read()
    if os.path.basename(path) == "qr.js":  # logos are fetched by path: embed them instead
        logo_dir = os.path.dirname(path)
        js = re.sub(r'file: "([^"]+)"', lambda m: f'file: "{data_uri(os.path.join(logo_dir, m.group(1)))}"', js)
    return "<script>\n" + js.replace("</script", "<\\/script") + "\n</script>"


def chapter(file):
    html = open(os.path.join(TALK, file), encoding="utf-8").read()
    base = os.path.dirname(os.path.join(TALK, file))

    def img(m):
        ref = m.group(2)
        if not is_local(ref):
            return m.group(0)
        path = os.path.normpath(os.path.join(TALK, ref))
        if not os.path.exists(path):  # chapter-relative paths, just in case
            path = os.path.normpath(os.path.join(base, ref))
        return f'{m.group(1)}"{data_uri(path)}"'
    html = re.sub(r'(<img[^>]*?\ssrc=)"([^"]+)"', img, html)
    # superseded slides (kept only for rollback) never ship; hidden slides ship only in --extended builds
    html = re.sub(r'<section\b[^>]*data-superseded[^>]*>.*?</section>\s*', '', html, flags=re.S)
    if EXTENDED:
        html = re.sub(r'(<section\b[^>]*?)\s+data-visibility="hidden"', r'\1', html)
    else:
        html = re.sub(r'<section\b[^>]*data-visibility="hidden"[^>]*>.*?</section>\s*', '', html, flags=re.S)
    if PUBLIC:  # speaker notes are for the speaker, not for readers of a published deck
        html = re.sub(r'\s*<aside class="notes">.*?</aside>', '', html, flags=re.S)
    return html


def main():
    page = open(os.path.join(TALK, "index.html"), encoding="utf-8").read()
    page = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                  lambda m: "<style>\n" + inline_css(os.path.join(TALK, m.group(1))) + "\n</style>", page)
    files = re.findall(r'file:\s*"([^"]+)"', page)
    if PUBLIC:  # no time slots in the speaker view of a published deck
        page = re.sub(r',\s*minutes:\s*[0-9.]+', '', page)
    templates = "\n".join(f'<template id="chapter-{i}">\n{chapter(f)}\n</template>' for i, f in enumerate(files))
    embed = ("<script>window.DECK.chapters.forEach((c, i) => "
             "{ c.html = document.getElementById(`chapter-${i}`).innerHTML; });</script>")
    page = re.sub(r'<script src="([^"]+)"></script>', lambda m: script(m.group(1)), page)
    # chapter templates and the embed step go right after the DECK definition, before loader.js runs
    page = page.replace("</body>", "</body>", 1)
    marker = "window.DECK = {"
    end = page.index("</script>", page.index(marker)) + len("</script>")
    page = page[:end] + "\n" + templates + "\n" + embed + page[end:]
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(page)
    kind = ("public, no speaker notes" if PUBLIC else "with speaker notes") + (", extended" if EXTENDED else "")
    print(f"Wrote {OUT} ({os.path.getsize(OUT) / 2**20:.1f} MB, {len(files)} chapters, {kind})")


if __name__ == "__main__":
    main()
