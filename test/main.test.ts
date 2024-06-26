import { acquire, search, constants } from '..';

import * as turf from '@turf/turf';

import { assert } from 'chai';

describe('search()', () => {
  it('EPSG:4326 w/ automatic metadata', (done) => {
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

  it('EPSG:4326 w/ explicit metadata', (done) => {
    search({
      url: 'https://velivole.b-cdn.net/tiles/place/2/{z}/{x}/{y}.pbf',
      lon: 6.220432,
      lat: 45.779170,
      metadata: constants.EPSG4326,
      maxFeatures: 3
    })
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

  it('EPSG:3857 w/o metadata (Mapbox fixtures)', (done) => {
    search({
      url: 'https://github.com/mapbox/mvt-fixtures/raw/main/real-world/bangkok/{z}-{x}-{y}.mvt',
      lon: 100.493782,
      lat: 13.751126
    })
      .then((results) => {
        assert.strictEqual(results[0].feature.properties['class'], 'tertiary');
        assert.strictEqual(results[0].feature.properties['type'], 'tertiary');
        assert.closeTo(results[0].distance, 0.09, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  it('EPSG:3857 w/ explicit metadata (Mapbox fixtures)', (done) => {
    search({
      url: 'https://github.com/mapbox/mvt-fixtures/raw/main/real-world/nepal/{z}-{x}-{y}.mvt',
      lon: 85.50263284446696, 
      lat: 28.224049026770835,
      metadata: {
        ...constants.EPSG3857,
        maxzoom: 13,
      }
    })
      .then((results) => {
        assert.strictEqual(results[0].feature.properties['class'], 'stream');
        assert.closeTo(results[0].distance, 0.07, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  // The proof I do not discriminate based on past actions of past CEOs
  it('EPSG:3857 w/ explicit metadata (Qwant)', (done) => {
    search({
      url: 'https://tiles.qwant.com/default/{z}/{x}/{y}',
      lon: 2.35586,
      lat: 48.83115,
      metadata: {
        ...constants.EPSG3857,
        maxzoom: 13,
      }
    })
      .then((results) => {
        assert.isString(results[0].feature.properties.class);
        assert.isString(results[0].feature.properties.qwant_id);
        assert.closeTo(results[0].distance, 0.03, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  it('search by class', (done) => {
    search({
      url: 'https://tiles.qwant.com/default/{z}/{x}/{y}',
      lon: 2.348942,
      lat: 48.853289,
      filter: (f) => f.properties['class'] === 'city',
      metadata: {
        ...constants.EPSG3857,
        maxzoom: 13,
      }
    })
      .then((results) => {
        assert.lengthOf(results, 1);
        assert.strictEqual(results[0].feature.properties['class'], 'city');
        assert.strictEqual(results[0].feature.properties['name'], 'Paris');
        assert.closeTo(results[0].distance, 0.04, 0.1);
        done();
      })
      .catch((e) => done(e));
  });

  it('search across the antimeridian', (done) => {
    search({
      url: 'https://tiles.qwant.com/default/{z}/{x}/{y}',
      lon: 179.999999,
      lat: -16.160655,
      maxFeatures: 50,
      metadata: {
        ...constants.EPSG3857,
        maxzoom: 13,
      }
    })
      .then((results) => {
        const am = results.map((f) => turf.centroid(f.feature).geometry.coordinates[0] >= 0);
        assert.isAtLeast(am.filter(v => v == true).length, 1);
        assert.isAtLeast(am.filter(v => v == false).length, 1);
        done();
      })
      .catch((e) => done(e));
  });

  it('restrict search radius', (done) => {
    search({
      url: 'https://tiles.qwant.com/default/{z}/{x}/{y}',
      lon: 2.35586,
      lat: 48.83115,
      maxFeatures: 100,
      maxRadius: 0.05,
      metadata: {
        ...constants.EPSG3857,
        maxzoom: 13,
      }
    })
      .then((results) => {
        assert.lengthOf(results, 42);
        done();
      })
      .catch((e) => done(e));
  });

  it('dedupe identical features', (done) => {
    search({
      url: 'https://tiles.qwant.com/default/{z}/{x}/{y}',
      lon: 6.220432,
      lat: 45.779170,
      maxFeatures: 100,
      filter: (f) => f.properties['rank'] === 11 && f.properties['class'] === 'village',
      metadata: {
        ...constants.EPSG3857,
        maxzoom: 13,
      },
      dedupe: true
    })
      .then((results) => {
        assert.strictEqual(results[0].feature.properties['name'], 'Doussard');
        assert.strictEqual(results[1].feature.properties['name'], 'Chevaline');
        done();
      })
      .catch((e) => done(e));
  });
});
