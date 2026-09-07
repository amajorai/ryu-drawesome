<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./icon-dark.png" />
    <img src="./icon-light.png" alt="Drawesome" width="144" />
  </picture>
</p>

<div align="center">

# Drawesome

</div>

A lightweight sketching studio with seven natural-feeling pens, area erasing, and SVG/PNG export; the current sketch persists through Ryu's app storage.

> **The public home of `ryu-drawesome`.** Source, builds, and releases live here —
> binaries for every platform are attached to each release.
>
> This tree is generated from the Ryu monorepo, so commits pushed here
> directly are replaced on the next sync. **Pull requests are welcome** —
> open them here and they are ported into the monorepo, then flow back out.
> Ryu as a whole: https://github.com/amajorai/ryu

## Install

**App:** [Install](ryu://apps/@ryu/drawesome) (opens the Ryu desktop app and asks you to confirm)

**CLI:**

```bash
ryu apps add @ryu/drawesome
```

## Source & build

This is the **source of record** for the app UI. It imports Ryu's private
`@ryu/ui` design system, so it does **not** build standalone outside the
monorepo — it **builds inside the amajorai/ryu monorepo workspace**.
The **shipped bundle below is the built artifact**: a prebuilt single-file
companion bundle is included at [`dist/drawesome.ui.html`](./dist/drawesome.ui.html) —
the runnable UI Ryu loads for this app.

## License

Apache-2.0 — see [LICENSE](./LICENSE).

## Included workflow

- Draw with pencil, pen, fineliner, marker, highlighter, brush, or fountain pen.
- Erase part of a stroke instead of deleting an entire stroke.
- Undo, redo, clear, choose ink, and tune size/opacity from the floating tray.
- Export the visible sketch as SVG or a 2× PNG.
- Persist the current title and stroke data through Ryu's app-scoped storage.

The app has no sidecar and makes no direct network requests. When it runs in a
standalone browser preview, it uses browser-local storage; inside Ryu, the host
storage bridge is the source of truth. A missing live bridge is shown as a demo
state rather than treated as a successful remote save.

## Build and test

```sh
bun run --cwd apps-store/drawesome/ui test
bun run --cwd apps-store/drawesome/ui check-types
bun run --cwd apps-store/drawesome/ui build
```

The UI build emits one self-contained `dist/index.html` for the sandboxed
Companion host.
