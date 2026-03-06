module.exports = {
  extends: ['expo'],
  rules: {
    // any já coberto pelo tsc strict; não duplicar como erro no lint gate inicial
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  ignorePatterns: [
    'node_modules/',
    '.expo/',
    'dist/',
    'coverage/',
    'android/',
    'ios/',
  ],
};
