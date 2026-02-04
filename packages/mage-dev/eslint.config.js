import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import oxlint from "eslint-plugin-oxlint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  oxlint.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: ["dist/**", "*.config.*"],
  }
);
