import { defineConfig } from "vitepress";

// GitHub Pages project site → served under /distribu-tron/.
const base = "/distribu-tron/";

export default defineConfig({
  base,
  lang: "en-US",
  title: "distribu-tron",
  description: "Weighted, plot-ready distribution statistics from a frequency table.",
  appearance: true,
  cleanUrls: true,
  head: [
    // TEMP: keep the site out of search indexes while building/testing.
    // Remove this line before the public launch.
    ["meta", { name: "robots", content: "noindex, nofollow" }],
    ["link", { rel: "preconnect", href: "https://fonts.googleapis.com" }],
    ["link", { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" }],
    [
      "link",
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=Orbitron:wght@600;700;900&display=swap",
      },
    ],
    // base-prefixed by hand: VitePress does NOT rewrite raw head hrefs for `base`.
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}logo.svg` }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: `${base}favicons/favicon-32.png` }],
    ["link", { rel: "apple-touch-icon", sizes: "180x180", href: `${base}favicons/apple-touch-icon.png` }],
  ],
  markdown: {
    theme: { light: "github-light", dark: "material-theme-palenight" },
  },
  themeConfig: {
    logo: "/logo.svg", // VitePress prefixes `base` for themeConfig assets automatically.
    siteTitle: "distribu-tron",
    socialLinks: [{ icon: "github", link: "https://github.com/dm-p/distribu-tron" }],
    nav: [
      { text: "Guide", link: "/guide/what-is-it" },
      { text: "Reference", link: "/reference/" },
      { text: "Roadmap", link: "/roadmap" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "What is distribu-tron?", link: "/guide/what-is-it" },
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "The model", link: "/guide/the-model" },
          ],
        },
        {
          text: "Statistics",
          items: [
            { text: "Descriptives", link: "/guide/descriptives" },
            { text: "Quantiles & box plot", link: "/guide/quantiles" },
            { text: "Shape & density", link: "/guide/shape-density" },
          ],
        },
        {
          text: "Grouping",
          items: [
            { text: "group() & ROLLUP", link: "/guide/grouping" },
            { text: "summarize()", link: "/guide/summarize" },
            { text: "Grouped plots", link: "/guide/grouped-plots" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "Reference",
          items: [
            { text: "Overview", link: "/reference/" },
            { text: "distribution()", link: "/reference/distribution" },
            { text: "Descriptives", link: "/reference/descriptives" },
            { text: "Quantiles & box plot", link: "/reference/quantiles-boxplot" },
            { text: "Histogram, KDE & ECDF", link: "/reference/histogram-kde-ecdf" },
            { text: "Grouping", link: "/reference/grouping" },
            { text: "Utilities", link: "/reference/utilities" },
          ],
        },
      ],
    },
  },
});
