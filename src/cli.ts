import * as path from 'path';
import { inspect } from 'util';

import * as turf from '@turf/turf';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { acquire, MVTMetadata, search, constants } from '.';

(async function () {
  const argv = await yargs(hideBin(process.argv))
    .wrap(80)
    .scriptName('query-mvt')
    .usage('$0 [args] <lat> <lon>')
    .option('crs', {
      describe: 'Projection used',
      default: constants.EPSG3857.crs,
      alias: 'p'
    })
    .option('root', {
      describe: 'Root URL',
      default: 'https://tiles.qwant.com/default/',
      alias: 'u'
    })
    .option('template', {
      default: '{z}/{x}/{y}.pbf',
      describe: 'Template for tile numbering',
      alias: 'm'
    })
    .option('top', {
      describe: 'Topmost latitude boundary in projected coordinates',
      default: constants.EPSG3857.tile_origin_upper_left_y,
      alias: 't',
      number: true
    })
    .option('left', {
      describe: 'Leftmost longitude boundary in projected coordinates',
      default: constants.EPSG3857.tile_origin_upper_left_x,
      alias: 'l',
      number: true
    })
    .option('dimension', {
      describe: 'Longitude span in projected coordinates',
      default: constants.EPSG3857.tile_dimension_zoom_0,
      alias: 'd',
      number: true
    })
    .option('zoom', {
      describe: 'Zoom level to use',
      default: 12,
      alias: 'z',
      number: true
    })
    .option('features', {
      describe: 'Number of features to return',
      default: 1,
      alias: 'n',
      number: true
    })
    .option('radius', {
      describe: 'Maximum radius in km to search in',
      default: 10,
      alias: 'r',
      number: true
    })
    .option('radius', {
      describe: 'Maximum radius in km to search in',
      default: 10,
      alias: 'r',
      number: true
    })
    .option('filter', {
      describe: 'Filter by property, ANDed if it appears multiple times',
      array: true,
      number: false,
      alias: 'f'
    })
    .option('json', {
      describe: 'GeoJSON output',
      boolean: true,
      alias: 'j'
    })
    .option('full', {
      describe: 'Verbose output',
      boolean: true,
      alias: 'w'
    })
    .option('dedupe', {
      describe: 'Eliminate duplicates',
      default: true,
      boolean: true,
      alias: 'd'
    })
    .example('$0 45.779 6.22', 'query nearest feature')
    .example('$0 45.779 6.22 -f class=village ', 'query nearest village')
    .demandCommand(2)
    .help()
    .argv;

  let metadata: MVTMetadata = {};
  if (argv.crs)
    metadata.crs = argv.crs;
  if (argv.top)
    metadata.tile_origin_upper_left_y = argv.top;
  if (argv.left)
    metadata.tile_origin_upper_left_x = argv.left;
  if (argv.dimension)
    metadata.tile_dimension_zoom_0 = argv.dimension;
  if (argv.zoom)
    metadata.maxzoom = argv.zoom;

  metadata = await acquire(path.posix.join(argv.root, 'metadata.json'))
    .catch(() => null) as MVTMetadata;
  if (!argv.json) {
    if (metadata) {
      console.log('Loaded metadata.json');
    } else {
      metadata = {};
      console.log('No metadata.json found');
    }
  }

  const filter: ((f: turf.Feature) => boolean) | undefined = argv.filter ?
    (feature: turf.Feature) => {
      for (const flt of argv.filter as string[]) {
        const [key, value] = flt.split('=');
        const actual = feature.properties[key];
        if (!actual || actual != value)
          return false;
      }
      return true;
    } : undefined;

  const results = await search({
    url: path.posix.join(argv.root, argv.template),
    maxFeatures: argv.features,
    maxRadius: argv.radius,
    metadata,
    filter,
    dedupe: argv.dedupe,
    lat: argv._[0] as number,
    lon: argv._[1] as number
  });

  if (argv.json) {
    console.log(JSON.stringify(results));
  } else {
    if (!results.length)
      console.log('No features found');
    for (const r of results) {
      console.log(
        `${r.distance.toFixed(3)}km`,
        r.feature.id,
        r.feature.geometry.type,
        inspect(r.feature.properties, false, Infinity));
      if (argv.full) {
        console.log(inspect(r.feature.geometry, false, Infinity));
        console.log('');
      }
    }
  }
})();
