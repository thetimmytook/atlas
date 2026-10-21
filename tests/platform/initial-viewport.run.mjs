import { startVitest } from 'vitest/node';

// Opt-in, bounded probe using the same helpers/configuration as test:platform.
// First build once with npm run build:example. No retries and no first-pass exit.
const runner = await startVitest('test', [], {
  config: 'vitest.platform.config.mts',
  include: ['tests/platform/initial-viewport.probe.ts'],
  watch: false,
});
await runner.close();
