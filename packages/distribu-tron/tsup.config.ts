import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  treeshake: true,
  banner: { js: "/* distribu-tron — MIT. Includes ticks/nice from d3-array (ISC) © Mike Bostock */" },
});
