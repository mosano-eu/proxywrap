module.exports = {
  env: {
    node: true,
    commonjs: true,
    mocha: true,
    es2021: true,
  },
  extends: [
    'eslint:recommended',
  ],
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
     "no-var": "error",
     "prefer-const": "error",
  },
};
