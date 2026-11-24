'use strict';

const process = require('process');

const sizes = [100, 1000, 10000, 50000, 250000];
const repeats = Number(process.env.BENCHMARK_REPEATS || 5);

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function summarize(samples) {
  return {
    minMs: percentile(samples, 0).toFixed(2),
    medianMs: percentile(samples, 50).toFixed(2),
    p95Ms: percentile(samples, 95).toFixed(2),
    maxMs: percentile(samples, 100).toFixed(2)
  };
}

function makeDataset(rows, columns) {
  const result = [];
  for (let i = 0; i < rows; i++) {
    const row = { id: i % Math.max(1, rows / 10), name: `Customer ${i % 1000}` };
    for (let c = 2; c < columns; c++) row[`metric_${c}`] = (i * (c + 1)) % 10000;
    result.push(row);
  }
  return result;
}

function measure(operation) {
  const start = process.hrtime.bigint();
  operation();
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function profile(rows) {
  let missing = 0;
  let sum = 0;
  const first = rows[0] || {};
  const columns = Object.keys(first);
  for (const row of rows) {
    for (const col of columns) {
      if (row[col] == null || row[col] === '') missing++;
      if (typeof row[col] === 'number') sum += row[col];
    }
  }
  return { missing, sum };
}

function clean(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      output.push(row);
    }
  }
  return output;
}

function join(left, right) {
  const index = new Map();
  for (const row of right) {
    if (!index.has(row.id)) index.set(row.id, []);
    index.get(row.id).push(row);
  }
  const output = [];
  for (const row of left) {
    const matches = index.get(row.id) || [];
    for (const match of matches) output.push({ ...row, ...match });
  }
  return output;
}

console.log(`DataSphere benchmark: ${repeats} repeat(s), sizes=${sizes.join(', ')}`);
console.log('shape,rows,cells,operation,minMs,medianMs,p95Ms,maxMs');

for (const size of sizes) {
  for (const shape of [{ name: 'tall', columns: 6 }, { name: 'wide', columns: 30 }]) {
    const rows = makeDataset(size, shape.columns);
    const operations = {
      profile: () => profile(rows),
      clean: () => clean(rows),
      join: () => join(rows, rows.slice(0, Math.ceil(rows.length / 2)))
    };

    for (const [operationName, operation] of Object.entries(operations)) {
      for (let repeat = 0; repeat < repeats + 1; repeat++) {
        operation();
      }
      const samples = [];
      for (let repeat = 0; repeat < repeats; repeat++) samples.push(measure(operation));
      const summary = summarize(samples);
      console.log([
        shape.name,
        size,
        size * shape.columns,
        operationName,
        summary.minMs,
        summary.medianMs,
        summary.p95Ms,
        summary.maxMs
      ].join(','));
    }
  }
}
