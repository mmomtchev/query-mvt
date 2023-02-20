# query-mvt

Find the nearest feature to a given point from a remote MVT vector tiles layer

# Usage

```js
import * as queryMVT from 'query-mvt';

const r = queryMVT.search({
  url: 'https://velivole.b-cdn.net/tiles/place/2/{z}/{x}/{y}.pbf',
  projection: 'EPSG:4326',
  extent: {left: -180, top: 90, right: 180, bottom: -90},
  lon: 0,
  lat: 45,
  zoom: 12
});
```
