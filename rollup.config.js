import deckyPlugin from '@decky/rollup';

const config = deckyPlugin();
// Source is published in Git; avoid bundling entire dependency source trees in the runtime ZIP.
config.output.sourcemap = false;
export default config;
