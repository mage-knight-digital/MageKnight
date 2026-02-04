import { defineConfig } from "bunup";

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["esm", "cjs"],
  dts: {
    // Use tsgo (TypeScript native compiler) - 10x faster than tsc
    inferTypes: true,
    tsgo: true,
  },
  clean: true,
});
