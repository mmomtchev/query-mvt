/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-require-imports */
const { search } = require('..');
const { assert } = require('chai');

describe('CommonJS', () => {
  it('require', () => {
    assert.isFunction(search);
  });
});
