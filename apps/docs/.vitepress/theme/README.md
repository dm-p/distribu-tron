# distribu-tron · VitePress theme ("Neon Grid")

Crisp neon. Cyan is the brand, magenta the accent, **no blur effects**
(vestibular-safe). Display type (Orbitron) is reserved for the wordmark; body copy is
IBM Plex Sans, code is IBM Plex Mono. Ships **light + dark** palettes — the neon-on-near-black
dark mode is the signature; light is a cool off-white with deepened cyan/magenta for contrast.

## Files

```
.vitepress/
  theme/
    index.js          → extends the default theme, imports custom.css
    custom.css        → light + dark tokens + reusable doc components
  config.ts           → merge in the excerpts from config-snippet.ts
public/
  logo.svg            → the robot mark — antenna + histogram visor (copy theme/logo.svg here)
  logo-bars.svg       → alternate bare-bars mark, if you prefer it
  favicons/           → copy theme/favicons/* here (PNG 16–512 + apple-touch)
```

## Install

1. Copy `index.js` and `custom.css` into `.vitepress/theme/`.
2. Copy `logo.svg` and the `favicons/` folder into your project's `public/` folder.
3. Merge the excerpts from `config-snippet.ts` into your `.vitepress/config.ts`
   (title, `head` font + favicon links, `markdown.theme`, `themeConfig.logo`, nav, sidebar).
4. `appearance: true` ships the light/dark toggle (defaults to dark). Use `'force-dark'`
   to lock it dark-only.

That's it — the default theme does the layout; `custom.css` only re-skins it via
`--vp-*` variables plus a few targeted rules (Orbitron title/hero, static grid backdrop,
active-sidebar accent).

## Syntax highlighting

Token colors come from a Shiki theme, not CSS, so they're set in config:

```ts
markdown: { theme: { light: 'material-theme-palenight', dark: 'material-theme-palenight' } }
```

`material-theme-palenight` reads well on the dark `#0c1022`; `github-light` suits the light
mode. Swap for any Shiki theme — or build a custom one if you want exact cyan/magenta tokens.

## The input → output figure

The signature doc component: input on the left, rendered chart on the right. Drop raw
HTML into any markdown file (classes live in `custom.css`):

```html
<figure class="dt-io">
  <div class="dt-io-in">
    <div class="dt-io-head"><span class="dot" style="background:#ff5fcf"></span>input</div>

    <!-- a normal fenced code block goes here -->
  </div>
  <figure class="dt-io-out">
    <div class="dt-io-head"><span class="dot" style="background:#5fe9ff"></span>output</div>
    <svg class="dt-chart" viewBox="0 0 320 170"><!-- your chart --></svg>
    <figcaption>11 bins · <b>weights conserved</b></figcaption>
  </figure>
</figure>
```

For real charts, feed distribu-tron's plot-ready arrays (`histogram()`, `kde()`, `ecdf()`)
into your renderer of choice — Vega-Lite, Observable Plot, or a tiny inline-SVG helper.
A reference SVG histogram + KDE renderer lives in `vitepress-preview.html` (the `bars()`
and `kdeChart()` functions) if you want a zero-dependency starting point. Wrap it in a Vue
component and register it in `index.js` for reuse across pages.

## Palette reference

| Token | Value | Use |
| --- | --- | --- |
| bg | `#05060d` | page |
| bg-soft | `#0c1022` | cards, code blocks |
| brand (cyan) | `#5fe9ff` | links, active, buttons |
| accent (magenta) | `#ff5fcf` | hero gradient, 2nd chart series, danger |
| amber | `#ffb86b` | warnings |
| text-1 / 2 / 3 | `#e7eeff` / `#9db0d4` / `#61749a` | body / muted / faint |
