import * as cp from 'node:child_process';
import { assert } from 'chai';

describe('test the CLI', () => {
  it('retrieve a village from Qwant', (done) => {
    cp.exec('node ./dist/cli.js 45.779 6.22 -f class=village -j', (err, result) => {
      if (err) done(err);
      try {
        const data = JSON.parse(result);
        assert.strictEqual(data[0].feature.properties.class, 'village');
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});
