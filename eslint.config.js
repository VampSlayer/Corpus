import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(eslint.configs.recommended, ...tseslint.configs.recommended, {
  ignores: ['dist', 'corpus', 'node_modules'],
  languageOptions: {
    globals: {
      process: 'readonly',
      console: 'readonly',
      fetch: 'readonly',
      Buffer: 'readonly'
    }
  },
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': 'off'
  }
});
