// .vitepress/config.ts  —  relevant excerpts (merge into your own config)
import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'distribu-tron',
  description: 'Weighted, plot-ready distribution statistics from a frequency table.',

  // Light + dark palettes ship in custom.css. `true` shows the toggle and
  // remembers the choice (default dark via the .dark class). Use 'dark' to
  // default-dark, or 'force-dark' to lock it.
  appearance: true,

  head: [
    // Fonts (preferred over the @import in custom.css — delete that @import if you use these)
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href:
      'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;1,400&family=IBM+Plex+Sans:wght@400;500;600;700&family=Orbitron:wght@600;700;900&display=swap' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicons/favicon-32.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/favicons/apple-touch-icon.png' }],
  ],

  // Neon-on-dark syntax highlighting. Pick a dark Shiki theme that fits the palette;
  // these two read well against #0c1022. Swap to taste.
  markdown: {
    theme: { light: 'github-light', dark: 'material-theme-palenight' },
  },

  themeConfig: {
    logo: '/logo.svg',           // place theme/logo.svg in your /public folder
    siteTitle: 'distribu-tron',  // styled in Orbitron via custom.css

    nav: [
      { text: 'Guide', link: '/guide/what-is-it' },
      { text: 'Reference', link: '/reference/' },
      { text: 'Roadmap', link: '/roadmap' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is distribu-tron?', link: '/guide/what-is-it' },
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'The model', link: '/guide/the-model' },
        ],
      },
      {
        text: 'Statistics',
        items: [
          { text: 'Descriptives', link: '/guide/descriptives' },
          { text: 'Quantiles & box plot', link: '/guide/quantiles' },
          { text: 'Shape & density', link: '/guide/shape-density' },
        ],
      },
      {
        text: 'Grouping',
        items: [
          { text: 'group() & ROLLUP', link: '/guide/grouping' },
          { text: 'summarize()', link: '/guide/summarize' },
          { text: 'Grouped plots', link: '/guide/grouped-plots' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/your-org/distribu-tron' },
    ],
  },
})
