import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import mocha from 'eslint-plugin-mocha';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default defineConfig([
  globalIgnores(['dist/*']),
  {
    files: ['**/*.ts'],

    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.commonjs,
        ...globals.node,
        ...globals.mocha,
      },

      ecmaVersion: 2017,
      sourceType: 'module',
    },

    extends: compat.extends(
      'eslint:recommended',
      'plugin:@typescript-eslint/eslint-recommended',
      'plugin:@typescript-eslint/recommended',
    ),

    plugins: {
      mocha,
    },

    rules: {
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'mocha/no-exclusive-tests': 'error',
    },
  }, {
    files: ['**/*.js'],
    extends: compat.extends('eslint:recommended'),
  }, {
    files: ['**/*.cjs'],
    extends: compat.extends('eslint:recommended'),
    languageOptions: {
      globals: {
        ...globals.commonjs,
        ...globals.node,
        ...globals.mocha,
      },

      ecmaVersion: 2017,
      sourceType: 'commonjs',
    },
  }]);
