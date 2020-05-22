module.exports = {
  env: {
    node: true,
  },
  extends: ['prettier', 'airbnb-base'],
  plugins: ['prettier'],
  rules: {
    'max-len': ['error', { code: 120, ignoreUrls: true, ignoreStrings: true }],
    'no-underscore-dangle': [2, { allow: ['_id'] }],
    'class-methods-use-this': 0,
    'no-plusplus': 0,
    'no-empty': ['error', { allowEmptyCatch: true }],
    'import/no-dynamic-require': 0,
    'import/prefer-default-export': 0,
    quotes: [2, 'single', { avoidEscape: true }],
    'comma-dangle': ['error', 'always-multiline'],
    'no-unused-vars': 'warn',
    'no-param-reassign': ['error', { props: false }],
  },
};
