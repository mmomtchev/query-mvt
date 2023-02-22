import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import fetch from 'node-fetch';
import * as turf from '@turf/turf';
import proj4 from 'proj4';

import { MVTMetadata } from './metadata';
import { debug } from './debug.js';

declare module '@mapbox/vector-tile' {
  interface VectorTileFeature {
    toGeoJSON(x: number, y: number, z: number, project?: (xy: [number, number]) => [number, number]): GeoJSON.Feature;
  }
}

export function resolveTile(opts: {
  coords: [number, number],
  metadata: MVTMetadata
}): [number, number] {
  const tiles = 2 ** opts.metadata.maxzoom;
  const tileSize = opts.metadata.tile_dimension_zoom_0 / tiles;
  const x = Math.floor((opts.coords[0] - opts.metadata.tile_origin_upper_left_x) / tileSize);
  const y = Math.floor((opts.metadata.tile_origin_upper_left_y - opts.coords[1]) / tileSize);

  return [x, y];
}

export function originTile(opts: {
  coords: [number, number],
  metadata: MVTMetadata
}): [number, number] {
  const tiles = 2 ** opts.metadata.maxzoom;
  const tileSize = opts.metadata.tile_dimension_zoom_0 / tiles;

  const x = opts.coords[0] * tileSize + opts.metadata.tile_origin_upper_left_x[0];
  const y = opts.metadata.tile_origin_upper_left_y[1] - opts.coords[1] * tileSize;

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
}): Promise<turf.Feature[]> {
  const url = resolveUrl({ url: opts.url, coords: opts.coords, zoom: opts.metadata.maxzoom });
  debug(`Retrieving ${url}`);
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
        const features = getTileFeatures(tile, {coords: opts.coords, metadata: opts.metadata});
        debug(`${url} contains ${features.length} features`);
        resolve(features);
      })
      .catch((e) => reject(e))
  );
}

export function retrieveNeighboringTiles(opts: {
  url: string;
  coords: [number, number];
  metadata: MVTMetadata;
  distance: number;
}): Promise<turf.Feature[]> {

  const tiles = [] as Promise<turf.Feature[]>[];

  for (let i = -opts.distance; i <= opts.distance; i++) {
    const tileCoords = [] as [number, number][];
    tileCoords.push([opts.coords[0] + i, opts.coords[1] - opts.distance]);
    tileCoords.push([opts.coords[0] + i, opts.coords[1] + opts.distance]);
    // TODO: wrap around the antimeridian
    tileCoords.push(i > -opts.distance && i < opts.distance ? [opts.coords[0] - opts.distance, opts.coords[1] + i] : [-1, -1]);
    tileCoords.push(i > -opts.distance && i < opts.distance ? [opts.coords[0] + opts.distance, opts.coords[1] + i] : [-1, -1]);

    for (const coords of tileCoords) {
      if (coords[0] >= 0)
        tiles.push(retrieveTile({ url: opts.url, coords: coords, metadata: opts.metadata }).catch(() => [] as turf.Feature[]));
    }
  }

  return Promise.all(tiles).then((features) => features.flat());
}
