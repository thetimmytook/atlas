/* eslint-disable security/detect-non-literal-fs-filename -- Explicit local evidence directory. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { SourceMap } from 'node:module';
import process from 'node:process';
import { URL } from 'node:url';

// Analysis is deliberately offline; never run it alongside capture.
const input = process.argv[2];
const output = process.argv[3];

if (!input) {
  throw new Error(
    'Usage: node examples/prototype-zoom.analyze.mjs EVIDENCE_DIRECTORY [OUTPUT_PREFIX]',
  );
}

const raw = JSON.parse(await readFile(`${input}/raw.json`, 'utf8'));

for (const capture of raw.captures) {
  for (const [name, expected] of Object.entries(capture.files ?? {})) {
    const bytes = await readFile(`${input}/${name}`);

    if (
      createHash('sha256').update(bytes).digest('hex') !== expected.sha256 ||
      bytes.length !== expected.bytes
    ) {
      throw new Error(`Capture artifact changed: ${name}`);
    }
  }
}

const timing = raw.runs
  .filter(run => run.mode === 'timing' && run.measured)
  .flatMap(run =>
    run.result.rows.map(row => ({
      roots: run.roots,
      profile: run.profile,
      repeat: run.repeat,
      ...row,
    })),
  );
const expectedRows = 4 * raw.options.repeats * 24 * 2;
const keys = timing.map(
  row => `${row.roots}/${row.profile}/${row.repeat}/${row.step}/${row.metric}`,
);

if (
  raw.status !== 'pass' ||
  timing.length !== expectedRows ||
  new Set(keys).size !== expectedRows ||
  timing.some(row => !Number.isFinite(row.value) || row.value < 0 || row.step < 0 || row.step > 23)
) {
  throw new Error('Failed capture, incomplete/duplicate timing rows or invalid samples.');
}

const summary = [];

for (const roots of [3000, 5000]) {
  for (const profile of ['control', 'materials-labels']) {
    for (const metric of ['raf_interval_ms', 'camera_api_sync_ms']) {
      const rows = timing.filter(
        row => row.roots === roots && row.profile === profile && row.metric === metric,
      );
      const values = rows.map(row => row.value).sort((a, b) => a - b);
      const middle = values.length / 2;
      summary.push({
        roots,
        profile,
        metric,
        samples: values.length,
        repeats: new Set(rows.map(row => row.repeat)).size,
        median: (values[Math.floor(middle)] + values[Math.ceil(middle) - 1]) / 2,
        p95: values[Math.ceil(values.length * 0.95) - 1],
        max: values.at(-1),
      });
    }
  }
}

function csv(rows) {
  const keys = Object.keys(rows[0]);

  return `${[keys.join(','), ...rows.map(row => keys.map(key => JSON.stringify(row[key])).join(','))].join('\n')}\n`;
}

// Complete trace intervals, clipped to marker bounds. Union never adds overlaps.
function union(intervals) {
  let end = -Infinity;
  let total = 0;

  for (const [start, finish] of intervals.sort((a, b) => a[0] - b[0])) {
    total += Math.max(0, finish - Math.max(start, end));
    end = Math.max(end, finish);
  }

  return total / 1000;
}

function duration(events, predicate, lo, hi) {
  return union(
    events
      .filter(predicate)
      .map(event => [Math.max(lo, event.ts), Math.min(hi, event.ts + event.dur)])
      .filter(([a, b]) => b > a),
  );
}

const sourceMaps = new Map();

for (const file of Object.keys(raw.buildFiles).filter(file => file.endsWith('.map'))) {
  sourceMaps.set(file, new SourceMap(JSON.parse(await readFile(`${input}/build/${file}`, 'utf8'))));
}

function sourceLocation(frame) {
  if (!frame.url?.startsWith('http')) {
    return undefined;
  }

  const map = sourceMaps.get(`${new URL(frame.url).pathname.slice(1)}.map`);
  const entry = map?.findEntry(frame.lineNumber, frame.columnNumber);

  return entry?.originalSource
    ? {
        source: entry.originalSource,
        line: entry.originalLine + 1,
        column: entry.originalColumn + 1,
        name: entry.name,
      }
    : undefined;
}

const diagnostics = [];

for (const run of raw.runs.filter(run => run.mode === 'trace')) {
  const trace = JSON.parse(await readFile(`${input}/${run.id}.trace.json`, 'utf8'));
  const cpu = JSON.parse(await readFile(`${input}/${run.id}.cpuprofile`, 'utf8'));
  const start = trace.traceEvents.find(event => event.name === 'atlas-zoom-start');
  const end = trace.traceEvents.find(event => event.name === 'atlas-zoom-end');

  if (!start || !end) {
    throw new Error(`Missing markers: ${run.id}`);
  }

  const main = trace.traceEvents.filter(
    event => event.ph === 'X' && event.pid === start.pid && event.tid === start.tid && event.dur,
  );
  const all = trace.traceEvents.filter(event => event.ph === 'X' && event.dur);
  const markers = trace.traceEvents.filter(event => /^atlas-zoom-step-\d+$/.test(event.name));

  if (markers.length !== 24 || new Set(markers.map(event => event.name)).size !== 24) {
    throw new Error(`Expected 24 unique step markers: ${run.id}`);
  }

  const lo = start.ts;
  const hi = end.ts;
  const perName = {};

  for (const name of new Set(main.map(event => event.name))) {
    const ms = duration(main, event => event.name === name, lo, hi);

    if (ms) {
      perName[name] = ms;
    }
  }

  const samples = new Map(
    cpu.nodes.map(node => [node.id, { ...node, parent: undefined, selfUs: 0, inclusiveUs: 0 }]),
  );

  for (const node of samples.values()) {
    for (const child of node.children ?? []) {
      samples.get(child).parent = node.id;
    }
  }

  // V8 may return out-of-order samples (negative deltas). Recover absolute
  // timestamps then sort, as a timeline must not double count these intervals.
  let time = cpu.startTime;
  const chronological = cpu.samples
    .map((id, index) => {
      time += cpu.timeDeltas[index];

      return { id, time };
    })
    .sort((a, b) => a.time - b.time);
  let selected = 0;

  for (let index = 0; index < chronological.length; index++) {
    const sample = chronological[index];
    const finish = chronological[index + 1]?.time ?? cpu.endTime;
    const clipped = Math.max(0, Math.min(finish, hi) - Math.max(sample.time, lo));

    if (!clipped) {
      continue;
    }

    selected += clipped;
    let node = samples.get(sample.id);
    node.selfUs += clipped;

    while (node) {
      node.inclusiveUs += clipped;
      node = samples.get(node.parent);
    }
  }

  if (Math.abs(selected - (hi - lo)) > 1) {
    throw new Error(`CPU profile does not cover marker window: ${run.id}`);
  }

  const frames = [...samples.values()]
    .filter(node => node.inclusiveUs)
    .map(node => ({
      ...node.callFrame,
      original: sourceLocation(node.callFrame),
      selfMs: node.selfUs / 1000,
      inclusiveMs: node.inclusiveUs / 1000,
    }));
  const steps = trace.traceEvents
    .filter(event => /^atlas-zoom-step-\d+$/.test(event.name))
    .sort((a, b) => a.ts - b.ts)
    .map((event, index, markers) => {
      const finish = markers[index + 1]?.ts ?? hi;

      return {
        step: index,
        intervalMs: (finish - event.ts) / 1000,
        mainBusyMs: duration(main, () => true, event.ts, finish),
        renderMs: duration(main, e => e.name === 'FunctionCall', event.ts, finish),
        styleMs: duration(
          main,
          e => /^(UpdateLayoutTree|RecalculateStyles)$/.test(e.name),
          event.ts,
          finish,
        ),
        layoutMs: duration(main, e => e.name === 'Layout', event.ts, finish),
        prepaintMs: duration(main, e => e.name === 'PrePaint', event.ts, finish),
        paintMs: duration(main, e => e.name === 'Paint', event.ts, finish),
        gcMs: duration(main, e => /^(MinorGC|MajorGC|V8.GC)/.test(e.name), event.ts, finish),
      };
    });
  const rasterThreads = [
    ...new Set(
      all.filter(event => /RasterTask/.test(event.name)).map(event => `${event.pid}:${event.tid}`),
    ),
  ]
    .map(thread => ({
      thread,
      taskUnionMs: duration(
        all,
        event => `${event.pid}:${event.tid}` === thread && /RasterTask/.test(event.name),
        lo,
        hi,
      ),
    }))
    .filter(item => item.taskUnionMs);
  const record = {
    id: run.id,
    roots: run.roots,
    profile: run.profile,
    repeat: run.repeat,
    windowMs: (hi - lo) / 1000,
    mainThread: { pid: start.pid, tid: start.tid },
    mainBusyUnionMs: duration(main, () => true, lo, hi),
    perName,
    rasterThreads,
    cpuCoveredMs: selected / 1000,
    negativeCpuDeltas: cpu.timeDeltas.filter(delta => delta < 0).length,
    cpuSamplingNote:
      'Absolute sample timestamps sorted, forward sample intervals clipped to markers; statistical self/inclusive estimates, not native browser phase attribution.',
    scriptStyleLayoutUnionMs: union(
      main
        .filter(event => /^(Layout|UpdateLayoutTree)$/.test(event.name))
        .flatMap(event =>
          main
            .filter(call => call.name === 'FunctionCall')
            .map(call => [
              Math.max(lo, event.ts, call.ts),
              Math.min(hi, event.ts + event.dur, call.ts + call.dur),
            ])
            .filter(([a, b]) => b > a),
        ),
    ),
    otherThreads: trace.traceEvents
      .filter(
        event =>
          event.name === 'thread_name' &&
          /compositor|gpu/i.test(event.args?.name) &&
          event.tid !== start.tid,
      )
      .map(event => ({
        name: event.args.name,
        pid: event.pid,
        tid: event.tid,
        busyUnionMs: duration(all, e => e.pid === event.pid && e.tid === event.tid, lo, hi),
      })),
    frames: [
      ...new Set([
        ...frames.sort((a, b) => b.selfMs - a.selfMs).slice(0, 40),
        ...frames.toSorted((a, b) => b.inclusiveMs - a.inclusiveMs).slice(0, 40),
      ]),
    ],
    steps,
  };
  diagnostics.push(record);
}

const counters = raw.runs
  .filter(run => run.mode === 'instrument' && run.measured)
  .map(run => ({
    id: run.id,
    roots: run.roots,
    profile: run.profile,
    repeat: run.repeat,
    inventory: run.setup.inventory,
    counters: run.result.counters,
    validation: run.finish,
  }));
process.stdout.write(
  `${JSON.stringify(
    {
      summary,
      captures: diagnostics.map(record => ({
        id: record.id,
        windowMs: record.windowMs,
        mainBusyUnionMs: record.mainBusyUnionMs,
        rasterThreads: record.rasterThreads,
        top: record.frames.slice(0, 8),
        perName: record.perName,
      })),
      counters,
    },
    null,
    2,
  )}\n`,
);

if (output) {
  const compact = {
    ...raw,
    runs: raw.runs.map(run =>
      Object.fromEntries(Object.entries(run).filter(([key]) => key !== 'result')),
    ),
  };
  await writeFile(`${output}-manifest.json`, `${JSON.stringify(compact, null, 2)}\n`);
  await writeFile(`${output}-timing.csv`, csv(timing));
  await writeFile(`${output}-timing-summary.csv`, csv(summary));
  await writeFile(
    `${output}-diagnostics.json`,
    `${JSON.stringify({ diagnostics, counters }, null, 2)}\n`,
  );
}
