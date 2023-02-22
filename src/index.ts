import proj4 from 'proj4';
import fetch from 'node-fetch';
import * as turf from '@turf/turf';

import { MVTMetadata } from './metadata';
import { resolveTile, retrieveNeighboringTiles, retrieveTile } from './tile.js';
import { debug } from './debug.js';

/**
 * @param {string} url URL of a GDAL-style metadata.json
 * @returns {MVTMetadata}
 */
export async function acquire(url: string): Promise<MVTMetadata> {
  return fetch(url).then((data) => data.json()) as Promise<MVTMetadata>;
}

/**
 * 
 * @param {Record<string, any>} opts options
 * @param {string} opts.url Openlayers-style URL template for requesting tiles, must contain {x}, {y} and {z}
 * @param {MVTMetadata} [opts.metadata] optional GDAL-style metadata.json, may be empty for world-wide EPSG:3857 tilesets
 * @param {lon} opts.lon longitude
 * @param {lat} opts.lat latitude
 * @returns {turf.Feature}
 */
export async function search(opts: {
  url: string;
  metadata?: MVTMetadata;
  lon: number;
  lat: number;
  maxRadius?: number;
  maxFeatures?: number;
  maxParallel?: number;
}) {
  const metadata: MVTMetadata = {
    tile_origin_upper_left_x: opts.metadata?.tile_origin_upper_left_x ?? -20037508.34,
    tile_origin_upper_left_y: opts.metadata?.tile_origin_upper_left_y ?? 20048966.1,
    tile_dimension_zoom_0: opts.metadata?.tile_dimension_zoom_0 ?? 20037508.34 * 2,
    crs: opts.metadata?.crs ?? 'EPSG:3857',
    maxzoom: opts?.metadata?.maxzoom ?? 12
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
