import { runUnit1Import } from './import-lib/unit1Importer';

runUnit1Import({
  mappingRelativePath: 'docs/unit-mapping/review-pack-unit1-partA-foundation-n14.jsonl',
  label: 'Unit1 n14',
}).catch((e) => {
  console.error(e);
  process.exit(1);
});
