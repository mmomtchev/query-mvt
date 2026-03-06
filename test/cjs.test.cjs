const { search } = require('..');
const { assert } = require('chai');

describe('CommonJS', () => {
  it('require', () => {
    assert.isFunction(search);
  });
});
