// .vitepress/theme/index.js
// distribu-tron "Neon Grid" theme — extends the VitePress default theme.
import DefaultTheme from "vitepress/theme";
import "./custom.css";
import IoFigure from "./components/IoFigure.vue";
import KernelComparison from "./components/KernelComparison.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("IoFigure", IoFigure);
    app.component("KernelComparison", KernelComparison);
  },
};
