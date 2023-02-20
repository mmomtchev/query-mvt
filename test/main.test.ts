import { search } from '../src/index.js';

import { assert } from 'chai';

describe('test', () => {
  it('should search for features', (done) => {
    search({
      url: 'https://velivole.b-cdn.net/tiles/place/2/{z}/{x}/{y}.pbf',
      projection: 'EPSG:4326',
      extent: {left: -180, top: 90, right: 180, bottom: -90},
      lon: 0,
      lat: 45,
      zoom: 12
    })
      .then((result) => {
        assert.strictEqual(result.feature.properties['n'], 'Puynormand');
        assert.closeTo(result.distance, 780, 10);
        done();
      })
      .catch((e) => done(e));
  });
});
