import proj4 from 'proj4';
import fetch from 'node-fetch';
import * as turf from '@turf/turf';
import { Queue } from 'async-await-queue';
import { Heap } from 'heap-js';
export { Queue } from 'async-await-queue';

import { MVTMetadata } from './metadata';
export { MVTMetadata } from './metadata';
import { resolveTile, retrieveNeighboringTiles, retrieveTile } from './tile.js';
import { debug } from './debug.js';

export type Result = {
  /**
   * Distance in km
   */
  distance: number;
  /**
   * Feature (turf.js and GeoJSON compatible)
   */
  feature: turf.Feature;
}
const compareResults = (a: Result, b: Result) => b.distance - a.distance;

/**
 * @param {string} url URL of a GDAL-style metadata.json
 * @returns {MVTMetadata}
 */
export async function acquire(url: string): Promise<MVTMetadata> {
  return fetch(url).then((data) => data.json()) as Promise<MVTMetadata>;
}

/**
 * @param {Record<string, any>} opts options
 * @param {string} opts.url Openlayers-style URL template for requesting tiles, must contain {x}, {y} and {z}
 * @param {MVTMetadata} [opts.metadata] optional GDAL-style metadata.json, may be empty for world-wide EPSG:3857 tilesets
 * @param {number} opts.lon longitude
 * @param {number} opts.lat latitude
 * @param {Queue} opts.queue optional shared Queue to be used for limiting concurrency, @default Queue(8,0)
 * @param {number} opts.maxFeature optional number of features to return, @default 1
 * @returns {turf.Feature}
 */
export async function search(opts: {
  url: string;
  metadata?: MVTMetadata;
  lon: number;
  lat: number;
  maxRadius?: number;
  maxFeatures?: number;
  queue?: Queue;
}): Promise<Result[]> {
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

  const maxFeatures = opts.maxFeatures ?? 1;
  let distance = 1;
  const queue = opts.queue ?? new Queue(8, 0);
  const results = new Heap<Result>(compareResults);
  do {
    const features: turf.Feature[] = await Promise.all([
      distance == 1 ? retrieveTile({ coords: tileCoords, metadata: metadata, url: opts.url, queue }).catch(() => []) : [],
      retrieveNeighboringTiles({ coords: tileCoords, metadata: metadata, url: opts.url, distance, queue })
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
      if (results.size() < maxFeatures || d < (results.peek()?.distance ?? Infinity)) {
        results.push({distance: d, feature: f});
        if (results.size() > maxFeatures) {
          results.pop();
        }
      }
    }
    distance++;
  } while (results.size() < maxFeatures);

  // TODO one last pass for compensating distanceX != distanceY
  // (maybe [tile,tile-2] is a better match than [tile-1,tile])

  return Array.from(results).reverse();
}
