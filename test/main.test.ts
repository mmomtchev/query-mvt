import { acquire, search } from '../src/index.js';

import { assert } from 'chai';

describe('should search for features', () => {
  it('EPSG:4326 w/ metadata', (done) => {
    acquire('https://velivole.b-cdn.net/tiles/place/2/metadata.json')
      .then((metadata) => search({
        url: 'https://velivole.b-cdn.net/tiles/place/2/{z}/{x}/{y}.pbf',
        lon: 6.220432,
        lat: 45.779170,
        metadata,
        maxFeatures: 3
      }))
      .then((results) => {
        assert.lengthOf(results, 3);
        assert.strictEqual(results[0].feature.properties['n'], 'Doussard');
        assert.closeTo(results[0].distance, 0.34, 0.01);
        assert.strictEqual(results[1].feature.properties['n'], 'Lathuile');
        assert.closeTo(results[1].distance, 1.23, 0.01);
        assert.strictEqual(results[2].feature.properties['n'], 'Chevaline');
        assert.closeTo(results[2].distance, 1.86, 0.01);
        done();
      })
      .catch((e) => done(e));
  });

  it('EPSG:3857 w/o metadata (mapbox fixtures)', (done) => {
    search({
      url: 'https://github.com/mapbox/mvt-fixtures/raw/main/real-world/bangkok/{z}-{x}-{y}.mvt',
      lon: 100.493782,
      lat: 13.751126,
      metadata: { maxzoom: 12 }
    })
      .then((results) => {
        assert.strictEqual(results[0].feature.properties['class'], 'school');
        assert.strictEqual(results[0].feature.properties['type'], 'university');
        assert.closeTo(results[0].distance, 0.11, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  it('EPSG:3857 w/ explicit metadata (mapbox fixtures)', (done) => {
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
      .then((results) => {
        assert.strictEqual(results[0].feature.properties['class'], 'shadow');
        assert.closeTo(results[0].distance, 0.07, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  // The proof I do not discriminate based on past actions of past CEOs
  it('EPSG:3857 w/o metadata (qwant)', (done) => {
    search({
      url: 'https://www.qwant.com/maps/tiles/ozbasemap/{z}/{x}/{y}.pbf',
      lon: 2.35586,
      lat: 48.83115
    })
      .then((results) => {
        assert.strictEqual(results[0].feature.properties['class'], 'service');
        assert.strictEqual(results[0].feature.properties['service'], 'parking_aisle');
        assert.closeTo(results[0].distance, 0.03, 0.1);
        done();
      })
      .catch((e) => done(e));
  });
});
