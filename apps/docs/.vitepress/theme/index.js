// .vitepress/theme/index.js
// distribu-tron "Neon Grid" theme — extends the VitePress default theme.
import DefaultTheme from "vitepress/theme";
import "./custom.css";
import IoFigure from "./components/IoFigure.vue";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("IoFigure", IoFigure);
  },
};
