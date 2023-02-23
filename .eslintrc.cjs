module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es6: true,
        node: true,
        mocha: true
    },
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    plugins: [
        'mocha'
    ],
    parserOptions: {
        ecmaVersion: 2017,
        sourceType: 'module'
    },
    rules: {
        quotes: ['error', 'single'],
        semi: ['error', 'always'],
        'mocha/no-exclusive-tests': 'error'
    }
};
