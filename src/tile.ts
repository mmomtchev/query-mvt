import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import fetch from 'node-fetch';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import { Queue } from 'async-await-queue';

import { MVTMetadata } from './metadata';
import { debug } from './debug.js';

declare module '@mapbox/vector-tile' {
  interface VectorTileFeature {
    toGeoJSON(x: number, y: number, z: number, project?: (xy: [number, number]) => [number, number]): GeoJSON.Feature;
  }
}

// Find the tile coordinates from the projected coordinates
export function resolveTile(opts: {
  coords: [number, number],
  metadata: MVTMetadata;
}): [number, number] {
  const tiles = 2 ** opts.metadata.maxzoom;
  const tileSize = opts.metadata.tile_dimension_zoom_0 / tiles;
  const x = Math.floor((opts.coords[0] - opts.metadata.tile_origin_upper_left_x) / tileSize);
  const y = Math.floor((opts.metadata.tile_origin_upper_left_y - opts.coords[1]) / tileSize);

  return [x, y];
}

// Find the projected coordinates of the origin of the tile from the tile coordinates
export function originTile(opts: {
  coords: [number, number],
  metadata: MVTMetadata;
}): [number, number] {
  const tiles = 2 ** opts.metadata.maxzoom;
  const tileSize = opts.metadata.tile_dimension_zoom_0 / tiles;

  const x = opts.coords[0] * tileSize + opts.metadata.tile_origin_upper_left_x;
  const y = opts.metadata.tile_origin_upper_left_y - opts.coords[1] * tileSize;

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

function getTileFeatures(tile: VectorTile, opts: {
  coords: [number, number];
  metadata: MVTMetadata;
}): turf.Feature[] {
  const features: turf.Feature[] = [];
  const xform = proj4(opts.metadata.crs, 'EPSG:4326');

  const project = ([x, y]: [number, number]) => xform.forward([
    x * opts.metadata.tile_dimension_zoom_0 + opts.metadata.tile_origin_upper_left_x,
    opts.metadata.tile_origin_upper_left_y - y * opts.metadata.tile_dimension_zoom_0
  ]) as [number, number];

  for (const layerName of Object.keys(tile.layers)) {
    const l = tile.layers[layerName];
    for (let idx = 0; idx < l.length; idx++) {
      const vectorFeature = l.feature(idx);
      const geojson = vectorFeature.toGeoJSON(opts.coords[0], opts.coords[1], opts.metadata.maxzoom, project);
      const feature = turf.feature(geojson.geometry as turf.Geometry, geojson.properties);
      features.push(feature);
    }
  }
  return features;
}

export function retrieveTile(opts: {
  url: string;
  coords: [number, number];
  metadata: MVTMetadata;
  queue: Queue;
}): Promise<turf.Feature[]> {
  const url = resolveUrl({ url: opts.url, coords: opts.coords, zoom: opts.metadata.maxzoom });
  debug(`Retrieving ${url}`);
  return new Promise((resolve, reject) =>
    opts.queue.run(() =>
      fetch(url, {
        headers: {
          'accept-encoding': 'gzip,deflate'
        }
      }))
      .then((data) => {
        if (!data.ok) {
          throw new Error(`${url}: HTTP ${data.status} ${data.statusText}`);
        }
        return data;
      })
      .then((data) => data.arrayBuffer())
      .then((data) => {
        const tile = new VectorTile(new Protobuf(data));
        const features = getTileFeatures(tile, { coords: opts.coords, metadata: opts.metadata });
        debug(`${url} contains ${features.length} features`);
        resolve(features);
      })
      .catch((e) => reject(e))
  );
}

/* Get the tile coordinates of a square of tiles around the target tile */
function getNeighboringTiles(opts: {
  coords: [number, number];
  metadata: MVTMetadata;
  distance: number;
}) {
  const tileCoords = [] as [number, number][];

  for (let i = -opts.distance; i <= opts.distance; i++) {
    // Horizontal row on top
    tileCoords.push([opts.coords[0] + i, opts.coords[1] - opts.distance]);

    // Horizontal row on bottom
    tileCoords.push([opts.coords[0] + i, opts.coords[1] + opts.distance]);
    // TODO: wrap around the antimeridian

    if (i > -opts.distance && i < opts.distance) {
      // Vertical column on the left (excluding the corners)
      tileCoords.push([opts.coords[0] - opts.distance, opts.coords[1] + i]);

      // Vertical column on the right (excluding the corners)
      tileCoords.push([opts.coords[0] + opts.distance, opts.coords[1] + i]);
    }
  }

  return tileCoords;
}

/* Get a square of tiles around the target tile */
export function retrieveNeighboringTiles(opts: {
  url: string;
  coords: [number, number];
  metadata: MVTMetadata;
  distance: number;
  queue: Queue;
}): Promise<turf.Feature[]> {
  const tileCoords = getNeighboringTiles(opts);
  const tiles = [] as Promise<turf.Feature[]>[];
  for (const coords of tileCoords) {
    if (coords[0] >= 0)
      tiles.push(retrieveTile({
        url: opts.url,
        coords: coords,
        metadata: opts.metadata,
        queue: opts.queue
      }).catch(() => [] as turf.Feature[]));
  }

  return Promise.all(tiles).then((features) => features.flat());
}

/* Find the shortest possible distance in a square of tiles around the target tile */
export function shortestDistanceInNeighboringTiles(opts: {
  // Geographical coordinates of the target point
  targetCoords: turf.Feature<turf.Point>;
  // Tile coordinates of the target tile
  tileCoords: [number, number];
  metadata: MVTMetadata;
  distance: number;
}) {
  const xform = proj4(opts.metadata.crs, 'EPSG:4326');
  const tileSize = opts.metadata.tile_dimension_zoom_0 / (2 ** opts.metadata.maxzoom);

  // TODO: wrap around the antimeridian
  const topTile = [opts.tileCoords[0], opts.tileCoords[1] - opts.distance] as [number, number];
  const leftTile = [opts.tileCoords[0] - opts.distance, opts.tileCoords[1]] as [number, number];
  const rightTile = [opts.tileCoords[0] + opts.distance, opts.tileCoords[1]] as [number, number];
  const bottomTile = [opts.tileCoords[0], opts.tileCoords[1] + opts.distance] as [number, number];

  const topOrigin = originTile({ ...opts, coords: topTile });
  const leftOrigin = originTile({ ...opts, coords: leftTile });
  const rightOrigin = originTile({ ...opts, coords: rightTile });
  const bottomOrigin = originTile({ ...opts, coords: bottomTile });

  const targetCoords = xform.inverse(opts.targetCoords.geometry.coordinates);
  const topMin = turf.point(xform.forward([targetCoords[0], topOrigin[1] - tileSize]));
  const leftMin = turf.point(xform.forward([leftOrigin[0] + tileSize, targetCoords[1]]));
  const rightMin = turf.point(xform.forward([rightOrigin[0], targetCoords[1]]));
  const bottomMin = turf.point(xform.forward([targetCoords[0], bottomOrigin[1]]));

  return Math.min(
    turf.distance(opts.targetCoords, topMin),
    turf.distance(opts.targetCoords, leftMin),
    turf.distance(opts.targetCoords, rightMin),
    turf.distance(opts.targetCoords, bottomMin)
  );
}