import proj4 from 'proj4';
import * as turf from '@turf/turf';
import { Queue } from 'async-await-queue';
import { Heap } from 'heap-js';
export { Queue } from 'async-await-queue';
import md5 from 'crypto-js/md5.js';
import Base64 from 'crypto-js/enc-base64.js';

import { MVTMetadata } from './metadata';
export { MVTMetadata } from './metadata';
import { resolveTile, retrieveNeighboringTiles, retrieveTile, shortestDistanceInNeighboringTiles } from './tile';
import * as constants from './constants';
export * as constants from './constants';
import { debug } from './debug';

/**
 * @type
 */
export type Result = {
  /**
   * Distance in km
   */
  distance: number;
  /**
   * Feature (turf.js and GeoJSON compatible)
   */
  feature: turf.Feature;
};
const compareResults = (a: Result, b: Result) => b.distance - a.distance;

/**
 * @param {string} url URL of a GDAL-style metadata.json
 * @param {RequestInit} [fetchOpts] optional fetch options (AbortController, authorization headers...)
 * @returns {MVTMetadata}
 */
export async function acquire(url: string, fetchOpts?: RequestInit): Promise<MVTMetadata> {
  return fetch(url, fetchOpts).then((data) => data.json()) as Promise<MVTMetadata>;
}

/**
 * @param {Record<string, any>} opts options
 * @param {string} opts.url Openlayers-style URL template for requesting tiles, must contain {x}, {y} and {z}
 * @param {MVTMetadata} [opts.metadata] optional GDAL-style metadata.json, may be empty for world-wide EPSG:3857 tilesets
 * @param {number} opts.lon longitude
 * @param {number} opts.lat latitude
 * @param {Queue} opts.queue optional shared Queue to be used for limiting concurrency, @default Queue(8,0)
 * @param {number} opts.maxFeatures optional number of features to return, @default 1
 * @param {number} opts.maxRadius optional maximum radius in km to search in, @default 10
 * @param {number} opts.filter optional filter function, will receive features one by one, must return keep (true) or discard (false)
 * @param {RequestInit} [opts.fetchOpts] optional fetch options (AbortController, authorization headers...)
 * @param {boolean} [opts.dedupe] dedupe the returned features (as the text will usually stretch across several tiles)
 * 
 * @returns {Promise<Result[]>}
 */
export async function search(opts: {
  url: string;
  metadata?: MVTMetadata;
  lon: number;
  lat: number;
  maxRadius?: number;
  maxFeatures?: number;
  filter?: (feature: turf.Feature) => boolean,
  queue?: Queue;
  fetchOpts?: RequestInit;
  dedupe?: boolean;
}): Promise<Result[]> {
  const metadata: MVTMetadata = {
    tile_origin_upper_left_x:
      opts.metadata?.tile_origin_upper_left_x ??
      constants.EPSG3857.tile_origin_upper_left_x,
    tile_origin_upper_left_y:
      opts.metadata?.tile_origin_upper_left_y ??
      constants.EPSG3857.tile_origin_upper_left_y,
    tile_dimension_zoom_0:
      opts.metadata?.tile_dimension_zoom_0 ??
      constants.EPSG3857.tile_dimension_zoom_0,
    crs: opts.metadata?.crs ?? constants.EPSG3857.crs,
    maxzoom: opts?.metadata?.maxzoom ?? 12
  };
  const xform = proj4('EPSG:4326', metadata.crs);
  const coords = xform.forward([opts.lon, opts.lat]) as [number, number];

  const tileCoords = resolveTile({ coords, metadata: metadata });
  const targetCoords = turf.point([opts.lon, opts.lat]);

  const maxFeatures = opts.maxFeatures ?? 1;
  const maxRadius = opts.maxRadius ?? 10;
  const queue = opts.queue ?? new Queue(8, 0);

  const fetchOpts: RequestInit = opts.fetchOpts ?? {};
  if (!fetchOpts.headers) fetchOpts.headers = {};
  fetchOpts.headers['accept-encoding'] = 'gzip,deflate';
  const results = new Heap<Result>(compareResults);

  const seen = new Set<string>();
  let distance = 1;
  let shortestDistance: number;
  do {
    let features: turf.Feature[] = await Promise.all([
      distance == 1 ? retrieveTile({ coords: tileCoords, metadata: metadata, url: opts.url, queue, fetchOpts }).catch(() => []) : [],
      retrieveNeighboringTiles({ coords: tileCoords, metadata: metadata, url: opts.url, distance, queue, fetchOpts })
    ]).then(([first, next]) => [...first, ...next]);
    if (opts.filter)
      features = features.filter(opts.filter);

    for (const f of features) {
      let d: number;
      const geom = f.geometry;
      if (opts.dedupe) {
        const hash = Base64.stringify(md5(JSON.stringify(f)));
        if (seen.has(hash))
          continue;
        seen.add(hash);
      }
      if (geom.type === 'Point') {
        d = turf.distance(targetCoords, (geom as turf.Point).coordinates);
      } else {
        // TODO implement proper polygon distance
        d = turf.distance(targetCoords, turf.centroid(geom));
      }
      debug(f.properties, d);
      if (d <= maxRadius && (results.size() < maxFeatures || d < (results.peek()?.distance ?? Infinity))) {
        results.push({ distance: d, feature: f });
        if (results.size() > maxFeatures) {
          results.pop();
        }
      }
    }
    distance++;
    // Get the shortest possible distance that a feature from the next iteration can have
    shortestDistance = shortestDistanceInNeighboringTiles({
      targetCoords,
      tileCoords,
      metadata,
      distance
    });

    if (shortestDistance > maxRadius)
      break;

  } while (results.size() < maxFeatures || (results.peek()?.distance ?? Infinity) > shortestDistance);

  return Array.from(results).reverse();
}
