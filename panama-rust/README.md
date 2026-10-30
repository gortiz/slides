# Native Speed, Java Comfort

Calling Rust from the JVM with Project Panama, compared with JNI, on a real Rust crate (`regex`).
45-minute slot. Built on `../_reveal-template`; the code and benchmarks live in the
`jrs-regex` repository.

```sh
../serve.sh panama-rust   # then open http://127.0.0.1:8000/
```

Press `S` for the speaker view. `talk.css` keeps the dark colour scheme of the original deck by
remapping the template tokens (teal = Panama, salmon = Rust, orange = accent, blue = Java).

| Chapter | File | Target |
|---|---|---|
| Opening | `chapters/00-opening.html` | 5 min |
| Primitives | `chapters/01-primitives.html` | 3 min |
| Strings | `chapters/02-strings.html` | 6 min |
| Handles | `chapters/03-handles.html` | 7 min |
| Structs | `chapters/04-structs.html` | 7 min |
| Bindings | `chapters/05-bindings.html` | 3 min |
| Callbacks | `chapters/06-callbacks.html` | 7 min |
| Wrapping up | `chapters/07-wrapping-up.html` | 6 min |
| Closing | `chapters/08-closing.html` | 1 min + Q&A |
