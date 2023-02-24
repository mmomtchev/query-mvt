import * as path from 'path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { acquire, MVTMetadata, search } from '.';

(async function () {
  const argv = await yargs(hideBin(process.argv))
    .wrap(80)
    .scriptName('query-mvt')
    .usage('$0 [args] <lat> <lon>')
    .describe('crs', 'Projection used')
    .default('crs', 'EPSG:3587')
    .describe('root', 'Root URL')
    .default('root', 'https://www.qwant.com/maps/tiles/ozbasemap/')
    .describe('template', 'Template for tile numbering')
    .default('template', '{z}/{x}/{y}.pbf')
    .example('$0  ', 'query Qwant Maps')
    .demandCommand(2)
    .help()
    .argv;

  const metadata = await acquire(path.posix.join(argv.root, 'metadata.json'))
    .catch(() => undefined) as MVTMetadata | undefined;
  if (!metadata)
    console.log('No metadata.json found');

  const results = await search({
    url: path.posix.join(argv.root, argv.template),
    metadata,
    lat: argv._[0] as number,
    lon: argv._[1] as number
  });

  console.dir(results);
})();