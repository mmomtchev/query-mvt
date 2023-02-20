import { VectorTile, VectorTileFeature } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import proj4 from 'proj4';
import fetch from 'node-fetch';
import Queue from 'async-await-queue';

function resolveTile(opts: {
  coords: [number, number],
  zoom: number,
  extent: [number, number, number, number];
}): [number, number] {
  const tiles = 2 ** opts.zoom;
  const tileSize = (opts.extent[2] - opts.extent[0]) / tiles;
  const x = Math.floor((opts.coords[0] - opts.extent[0]) / tileSize);
  const y = Math.floor((opts.extent[1] - opts.coords[1]) / tileSize);

  return [x, y];
}

function resolveUrl(opts: {
  coords: [number, number];
  url: string;
  zoom: number;
}): string {
  return opts.url
    .replace('{x}', opts.coords[0].toString())
    .replace('{y}', opts.coords[1].toString())
    .replace('{z}', opts.zoom.toString());
}

function retrieveTile(opts: {
  url: string;
  coords: [number, number];
  zoom: number;
}): Promise<VectorTile> {
  const url = resolveUrl({ url: opts.url, coords: opts.coords, zoom: opts.zoom });
  return new Promise((resolve, reject) =>
    fetch(url, {
      headers: {
        'accept-encoding': 'gzip,deflate'
      }
    })
      .then((data) => {
        if (!data.ok) {
          throw new Error(`${url}: HTTP ${data.status} ${data.statusText}`);
        }
        return data;
      })
      .then((data) => data.arrayBuffer())
      .then((data) => {
        const tile = new VectorTile(new Protobuf(data));
        resolve(tile);
      })
      .catch((e) => reject(e))
  );
}

function retrieveNeighboringTiles(opts: {
  url: string;
  coords: [number, number];
  zoom: number;
  distance: number;
}): Promise<(VectorTile | null)[]> {

  const tiles = [] as Promise<VectorTile | null>[];

  for (let i = -opts.distance; i <= opts.distance; i++) {
    let tileCoords = [] as [number, number][];
    tileCoords.push([opts.coords[0] + i, opts.coords[1] - opts.distance]);
    tileCoords.push([opts.coords[0] + i, opts.coords[1] + opts.distance]);
    // TODO: wrap around the antimeridian
    tileCoords.push(i > -opts.distance && i < opts.distance ? [opts.coords[0] - opts.distance, opts.coords[1] + i] : [-1, -1]);
    tileCoords.push(i > -opts.distance && i < opts.distance ? [opts.coords[0] + opts.distance, opts.coords[1] + i] : [-1, -1]);

    for (const coords of tileCoords) {
      if (coords[0] >= 0)
        tiles.push(retrieveTile({ url: opts.url, coords: coords, zoom: opts.zoom }).catch(() => null));
    }
  }

  return Promise.all(tiles);
}

export async function search(opts: {
  url: string;
  lon: number;
  lat: number;
  maxRadius?: number;
  maxFeatures?: number;
  projection?: string;
  zoom: number;
  extent?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  maxParallel?: number;
}) {
  const xform = proj4('EPSG:4326', opts.projection ?? 'EPSG:3857');
  const coords = xform.forward([opts.lon, opts.lat]) as [number, number];
  const extent = [
    ...xform.forward([opts.extent?.left ?? -180, opts.extent?.top ?? 85]),
    ...xform.forward([opts.extent?.right ?? 180, opts.extent?.bottom ?? -85])
  ] as [number, number, number, number];

  const tileCoords = resolveTile({ coords, zoom: opts.zoom, extent });

  let min = {
    d2: Infinity as number,
    f: null as VectorTileFeature | null
  };
  let distance = 1;
  do {
    const tiles: (VectorTile | null)[] = await Promise.all([
      distance == 1 ? retrieveTile({ coords: tileCoords, zoom: opts.zoom, url: opts.url }).catch(() => null) : null,
      retrieveNeighboringTiles({ coords: tileCoords, zoom: opts.zoom, url: opts.url, distance: 1 })
    ]).then(([first, next]) => [first, ...next]);

    for (const t of tiles) {
      if (t !== null) {
        for (const layerName of Object.keys(t.layers)) {
          const l = t.layers[layerName];
          for (let idx = 0; idx < l.length; idx++) {
            const f = l.feature(idx);
            const bbox = f.bbox();
            const dx = Math.max(bbox[0] - coords[0], 0, coords[0] - bbox[2]);
            const dy = Math.max(coords[1] - bbox[1], 0, bbox[3] - coords[1]);
            const d2 = dx * dx + dy * dy;
            if (d2 < min.d2) {
              min = {
                d2,
                f
              };
            }
          }
        }
      }
      distance++;
    }
  } while (min.f === null);

  return {
    distance: Math.sqrt(min.d2),
    feature: min.f
  };
}
