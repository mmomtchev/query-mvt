import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import * as turf from '@turf/turf';
import proj4 from 'proj4';
import { Queue } from 'async-await-queue';

import { MVTMetadata } from './metadata';
import { debug } from './debug.js';

//useFetch;

declare module '@mapbox/vector-tile' {
  interface VectorTileFeature {
    toGeoJSON(x: number, y: number, z: number, project?: (xy: [number, number]) => [number, number]): GeoJSON.Feature;
  }
}

// wrap X tile coordinates around the AM
function wrapAM(x: number, tiles: number): number {
  return (x + tiles) % tiles;
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
  const tiles = 2 ** opts.metadata.maxzoom;

  for (let i = -opts.distance; i <= opts.distance; i++) {
    // Horizontal row on top
    tileCoords.push([opts.coords[0] + i, opts.coords[1] - opts.distance]);

    // Horizontal row on bottom
    tileCoords.push([opts.coords[0] + i, opts.coords[1] + opts.distance]);

    if (i > -opts.distance && i < opts.distance) {
      // Vertical column on the left (excluding the corners)
      tileCoords.push([wrapAM(opts.coords[0] - opts.distance, tiles), opts.coords[1] + i]);

      // Vertical column on the right (excluding the corners)
      tileCoords.push([wrapAM(opts.coords[0] + opts.distance, tiles), opts.coords[1] + i]);
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
  const tiles = 2 ** opts.metadata.maxzoom;
  const tileSize = opts.metadata.tile_dimension_zoom_0 / tiles;

  const ulTile = [
    wrapAM(opts.tileCoords[0] - opts.distance, tiles),
    opts.tileCoords[1] - opts.distance
  ] as [number, number];
  const urTile = [
    wrapAM(opts.tileCoords[0] + opts.distance, tiles),
    opts.tileCoords[1] - opts.distance
  ] as [number, number];
  const blTile = [
    wrapAM(opts.tileCoords[0] - opts.distance, tiles),
    opts.tileCoords[1] + opts.distance
  ] as [number, number];
  const brTile = [
    wrapAM(opts.tileCoords[0] + opts.distance, tiles),
    opts.tileCoords[1] + opts.distance
  ] as [number, number];

  const ulOrigin = originTile({ ...opts, coords: ulTile });
  const urOrigin = originTile({ ...opts, coords: urTile });
  const blOrigin = originTile({ ...opts, coords: blTile });
  const brOrigin = originTile({ ...opts, coords: brTile });

  const ulCoords = xform.forward([ulOrigin[0] + tileSize, ulOrigin[1] - tileSize]);
  const urCoords = xform.forward([urOrigin[0], urOrigin[1] - tileSize]);
  const blCoords = xform.forward([blOrigin[0] + tileSize, blOrigin[1]]);
  const brCoords = xform.forward([brOrigin[0], brOrigin[1]]);

  const topEdge = turf.lineString([ulCoords, urCoords]);
  const leftEdge = turf.lineString([ulCoords, blCoords]);
  const rightEdge = turf.lineString([brCoords, urCoords]);
  const bottomEdge = turf.lineString([brCoords, blCoords]);

  return Math.min(
    turf.pointToLineDistance(opts.targetCoords, topEdge),
    turf.pointToLineDistance(opts.targetCoords, leftEdge),
    turf.pointToLineDistance(opts.targetCoords, rightEdge),
    turf.pointToLineDistance(opts.targetCoords, bottomEdge)
  );
}