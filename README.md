# query-mvt

Query features nearest to a given point from a remote MVT vector tiles layer

[![License: ISC](https://img.shields.io/github/license/mmomtchev/query-mvt)](https://github.com/mmomtchev/query-mvt/blob/master/LICENSE)
[![Node.js CI](https://github.com/mmomtchev/query-mvt/actions/workflows/node.js.yml/badge.svg)](https://github.com/mmomtchev/query-mvt/actions/workflows/node.js.yml)[![codecov](https://codecov.io/gh/mmomtchev/query-mvt/branch/main/graph/badge.svg?token=oT28J2XMYB)](https://codecov.io/gh/mmomtchev/query-mvt)

`query-mvt` allows you query remote vector tile sets for features. It enables API-like access through the front door, behaving as a browser displaying the map.

It works both in Node.js and in the browser. It supports all vector mapping services that use MVT/PBF and can adapt to different projections and different world bounds.

# Usage

Vector tile sets created by GDAL and a few other tools come with a de-facto standard `metadata.json` that allows `query-mvt` to automatically acquire all the needed parameters:

## with `metadata.json`

```js
import * as queryMVT from 'query-mvt';

// Automatically imports the layer metadata
// (EPSG:4326 with world coverage in this case)
queryMVT.acquire('https://velivole.b-cdn.net/tiles/place/2/metadata.json')
  .then((metadata) => queryMVT.search({
    url: 'https://velivole.b-cdn.net/tiles/place/2/{z}/{x}/{y}.pbf',
    lon: 6.220432,
    lat: 45.779170,
    metadata
  }))
  .then((result) => {
    assert.strictEqual(result.feature.properties['n'], 'Doussard');
    assert.closeTo(result.distance, 0.34, 0.1);
  })
```

## raw MVT tiles

Most commercial public mapping services such as Qwant do not have a `metadata.json` but tend to use the same `EPSG:3857` projection and world bounds:

```js
import * as queryMVT from 'query-mvt';

// Configure manually the layer metadata
// (EPSG:3857 with world coverage in this case)
queryMVT.search({
  url: 'https://www.qwant.com/maps/tiles/ozbasemap/{z}/{x}/{y}.pbf',
  lon: 2.348942,
  lat: 48.853289,
  // You can filter the results
  filter: (f) => f.properties['class'] === 'city',
  maxFeatures: 20,
  maxRadius: 10,
  metadata: queryMVT.constants.EPSG3857
})
  .then((results) => {
    assert.strictEqual(results[0].feature.properties['class'], 'city');
    assert.strictEqual(results[0].feature.properties['name'], 'Paris');
    assert.closeTo(results[0].distance, 0.04, 0.1);
  })
```
