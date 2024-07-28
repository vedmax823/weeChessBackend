import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import jest from 'eslint-plugin-jest'


export default [
  {
    ignores: ['dist']
  },

  {files: ["**/*.{js,mjs,cjs,ts}"]},
  {languageOptions: { globals: globals.browser }},
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files : ["*.test.{js, ts, tsx, jsx"],
    ...jest.configs["flat/recommended"],
    rules : {
      ...jest.configs["flat/recommended"].rules,
      "jest/prefer-expect-assertions" : "off",
    }
  }
];
