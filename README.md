# query-mvt

Find the nearest feature to a given point from a remote MVT vector tiles layer

# Usage

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

```js
import * as queryMVT from 'query-mvt';

// Configure manually the layer metadata
// (EPSG:3857 with world coverage in this case)
queryMVT.search({
  url: 'https://github.com/mapbox/mvt-fixtures/raw/main/real-world/bangkok/{z}-{x}-{y}.mvt',
  lon: 100.493782,
  lat: 13.751126,
  metadata: {
    maxzoom: 12,
    tile_dimension_zoom_0: 20037508.34 * 2,
    tile_origin_upper_left_x: -20037508.34,
    tile_origin_upper_left_y: 20048966.1,
    crs: 'EPSG:3857'
  }
})
.then((result) => {
  assert.strictEqual(result.feature.properties['class'], 'school');
  assert.strictEqual(result.feature.properties['type'], 'university');
  assert.closeTo(result.distance, 0.11, 0.1);
})

```