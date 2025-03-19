import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

export default [
    {
        files: ["**/*.{js,ts}"],
        languageOptions: {
            parser: tsParser,
            globals: {
                ...globals.node
            }
        },
        plugins: {
            "@typescript-eslint": tseslint,
            prettier
        },
        rules: {
            ...tseslint.configs.recommended.rules,
            ...prettierConfig.rules,
            "prettier/prettier": "error",
        },
    }
];
