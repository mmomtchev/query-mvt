import { acquire, search } from '../src/index.js';

import { assert } from 'chai';

describe('should search for features', () => {
  it('EPSG:4326 w/ metadata', (done) => {
    acquire('https://velivole.b-cdn.net/tiles/place/2/metadata.json')
      .then((metadata) => search({
        url: 'https://velivole.b-cdn.net/tiles/place/2/{z}/{x}/{y}.pbf',
        lon: 6.220432,
        lat: 45.779170,
        metadata
      }))
      .then((result) => {
        assert.strictEqual(result.feature.properties['n'], 'Doussard');
        assert.closeTo(result.distance, 0.34, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  it('EPSG:3857 w/o metadata', (done) => {
    search({
      url: 'https://github.com/mapbox/mvt-fixtures/raw/main/real-world/bangkok/{z}-{x}-{y}.mvt',
      lon: 100.493782,
      lat: 13.751126,
      metadata: { maxzoom: 12 }
    })
      .then((result) => {
        assert.strictEqual(result.feature.properties['class'], 'school');
        assert.strictEqual(result.feature.properties['type'], 'university');
        assert.closeTo(result.distance, 0.11, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  it.only('EPSG:3857 w/ explicit metadata', (done) => {
    search({
      url: 'https://github.com/mapbox/mvt-fixtures/raw/main/real-world/nepal/{z}-{x}-{y}.mvt',
      lon: 85.48914669754195,
      lat: 28.290583497785597,
      metadata: {
        maxzoom: 13,
        tile_dimension_zoom_0: 20037508.34 * 2,
        tile_origin_upper_left_x: -20037508.34,
        tile_origin_upper_left_y: 20048966.1,
        crs: 'EPSG:3857'
      }
    })
      .then((result) => {
        assert.strictEqual(result.feature.properties['class'], 'shadow');
        assert.closeTo(result.distance, 0.07, 0.1);
        done();
      })
      .catch((e) => done(e));
  });
});
