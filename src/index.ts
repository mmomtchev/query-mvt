import proj4 from 'proj4';
import fetch from 'node-fetch';
import * as turf from '@turf/turf';

import { mvtMetadata } from './metadata';
import { resolveTile, retrieveNeighboringTiles, retrieveTile } from './tile.js';
import { debug } from './debug.js';

export async function acquire(metadata: string): Promise<mvtMetadata> {
  return fetch(metadata).then((data) => data.json()) as Promise<mvtMetadata>;
}

export async function search(opts: {
  url: string;
  metadata: mvtMetadata;
  lon: number;
  lat: number;
  maxRadius?: number;
  maxFeatures?: number;
  maxParallel?: number;
}) {
  const metadata: mvtMetadata = {
    tile_origin_upper_left_x: opts.metadata?.tile_origin_upper_left_x ?? -20037508.34,
    tile_origin_upper_left_y: opts.metadata?.tile_origin_upper_left_y ?? 20048966.1,
    tile_dimension_zoom_0: opts.metadata?.tile_dimension_zoom_0 ?? 20037508.34 * 2,
    crs: opts.metadata.crs ?? 'EPSG:3857',
    maxzoom: opts?.metadata?.maxzoom
  };
  const xform = proj4('EPSG:4326', metadata.crs);
  const coords = xform.forward([opts.lon, opts.lat]) as [number, number];

  const tileCoords = resolveTile({ coords, metadata: metadata });
  const targetCoords = turf.point([opts.lon, opts.lat]);

  let min = {
    d: Infinity as number,
    f: null as turf.Feature | null
  };
  let distance = 1;
  do {
    const features: turf.Feature[] = await Promise.all([
      distance == 1 ? retrieveTile({ coords: tileCoords, metadata: metadata, url: opts.url }).catch(() => []) : [],
      retrieveNeighboringTiles({ coords: tileCoords, metadata: metadata, url: opts.url, distance })
    ]).then(([first, next]) => [...first, ...next]);

    for (const f of features) {
      let d: number;
      const geom = f.geometry;
      if (geom.type === 'Point') {
        d = turf.distance(targetCoords, (geom as turf.Point).coordinates);
      } else {
        // TODO implement proper polygon distance
        d = turf.distance(targetCoords, turf.centroid(geom));
      }
      debug(f.properties, d);
      if (d < min.d) {
        min = { d, f };
      }
    }
    distance++;
  } while (min.f === null);

  // TODO one last pass for compensating distanceX != distanceY
  // (maybe [tile,tile-2] is a better match than [tile-1,tile])

  return {
    distance: min.d,
    feature: min.f
  };
}
