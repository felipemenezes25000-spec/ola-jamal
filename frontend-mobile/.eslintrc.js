module.exports = {
  extends: ['expo'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { vars: 'all', args: 'none', ignoreRestSiblings: true, caughtErrors: 'all', argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  overrides: [
    {
      files: ['scripts/**/*.js'],
      env: { node: true },
      rules: { 'no-console': 'off' },
    },
    {
      files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
      rules: {
        '@typescript-eslint/no-require-imports': 'off',
        'import/first': 'off',
      },
    },
    {
      files: ['**/register.tsx', '**/video/**/*.tsx', '**/AuthContext.tsx'],
      rules: { 'unicode-bom': 'off' },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'coverage/',
    'android/',
    'ios/',
  ],
};
