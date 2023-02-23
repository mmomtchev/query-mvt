import { search } from '../dist/es6/index.mjs';
import { assert } from 'chai';

describe('ES6', () => {
  it('import', () => {
    assert.isFunction(search);
  });
});
