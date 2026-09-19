import js from "@eslint/js";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: "readonly",
      },
    },
    rules: {
      "no-console": "error",
    },
  },
];
