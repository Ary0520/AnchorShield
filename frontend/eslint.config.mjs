import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Dead code / unused vars are warnings, not errors
      "@typescript-eslint/no-unused-vars": "warn",
      // <img> vs <Image> — we're intentionally using <img> for SVG logos and external assets
      "@next/next/no-img-element": "off",
      // JSX comment style — cosmetic, not a bug
      "react/jsx-no-comment-textnodes": "warn",
      // Unescaped entities — cosmetic
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
