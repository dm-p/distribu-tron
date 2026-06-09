// .vitepress/theme/index.js
// distribu-tron "Neon Grid" theme — extends the VitePress default theme.
import DefaultTheme from 'vitepress/theme'
import './custom.css'

export default {
  extends: DefaultTheme,
  // Register the input→output chart component here if you build one as Vue, e.g.:
  // enhanceApp({ app }) { app.component('IoFigure', IoFigure) }
}
