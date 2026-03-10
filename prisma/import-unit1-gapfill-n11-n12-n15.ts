import { runUnit1Import } from './import-lib/unit1Importer';

runUnit1Import({
  mappingRelativePath: 'docs/unit-mapping/review-pack-unit1-partA-foundation-gapfill-n11-n12-n15.jsonl',
  label: 'Unit1 gapfill n11-n12-n15',
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
