import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  {
    ignores: ["dist", "node_modules", ".venv"]
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        browser: true,
        es2022: true,
        React: "writable"
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      "react-refresh/only-export-components": "warn",
      "react-hooks/exhaustive-deps": "warn"
    }
  }
];
