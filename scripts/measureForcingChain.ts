/**
 * Forcing Chain max_chain_depth 측정 (전체 17-clue 퍼즐).
 * "10단계 추론": max_chain_depth >= 10 → 소설적 묘사에 부합.
 *
 * Usage: npx tsx scripts/measureForcingChain.ts [--limit N]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { stringToGrid } from '../src/utils/gridUtils';
import { forcingChainSolve } from '../src/utils/forcingChain';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLE_FILE = path.join(ROOT, 'puzzles2_17_clue');

const limitIdx = process.argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 && process.argv[limitIdx + 1] ? parseInt(process.argv[limitIdx + 1], 10) : 0;

function loadPuzzles(): string[] {
  const raw = fs.readFileSync(PUZZLE_FILE, 'utf-8');
  const out = raw
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\./g, '0').slice(0, 81))
    .filter((p) => {
      if (p.length !== 81) return false;
      return p.replace(/0/g, '').length === 17;
    });
  return LIMIT > 0 ? out.slice(0, LIMIT) : out;
}

function main() {
  const lines = loadPuzzles();
  console.log(`Loaded ${lines.length} puzzles${LIMIT > 0 ? ` (--limit ${LIMIT})` : ''}.\n`);
  console.log('Forcing Chain: propagation (naked/hidden single only) + assumption branching.');
  console.log('max_chain_depth = 최대 가정 중첩 깊이. if >= 10 → "10단계 추론" / 소설적 묘사에 부합.\n');

  const depthCount: Record<number, number> = {};
  let solved = 0;
  let tenStep = 0;
  const depths: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const grid = stringToGrid(lines[i]);
    const r = forcingChainSolve(grid);

    if (r.solved) solved++;
    const d = r.max_chain_depth;
    depthCount[d] = (depthCount[d] ?? 0) + 1;
    depths.push(d);
    if (r.ten_step_reasoning) tenStep++;

    if ((i + 1) % 2000 === 0) {
      console.log(`  ... ${i + 1} / ${lines.length}`);
    }
  }

  console.log('\n--- Forcing Chain max_chain_depth (이 점수만 따로) ---\n');
  console.log(`Total:     ${lines.length}`);
  console.log(`Solved:    ${solved}`);
  console.log(`Unsolved:  ${lines.length - solved}`);
  console.log(`\n10단계 추론 (max_chain_depth >= 10): ${tenStep}개\n`);

  const maxD = Math.max(...depths);
  console.log('Distribution (max_chain_depth):');
  for (let d = 0; d <= Math.min(maxD, 15); d++) {
    const n = depthCount[d] ?? 0;
    const bar = '█'.repeat(Math.min(60, Math.floor((n / lines.length) * 120)));
    console.log(`  depth ${String(d).padStart(2)}: ${String(n).padStart(5)}  ${bar}`);
  }
  if (maxD > 15) {
    const n = depths.filter((x) => x > 15).length;
    console.log(`  > 15 : ${String(n).padStart(5)}`);
  }

  const avg = depths.reduce((a, b) => a + b, 0) / depths.length;
  console.log(`\nmax_chain_depth — avg: ${avg.toFixed(2)}  min: ${Math.min(...depths)}  max: ${maxD}`);

  const outPath = path.join(ROOT, 'forcing-chain-results.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        total: lines.length,
        solved,
        unsolved: lines.length - solved,
        ten_step_reasoning_count: tenStep,
        by_depth: depthCount,
        avg_depth: avg,
        min_depth: Math.min(...depths),
        max_depth: maxD,
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`\nWrote ${outPath}`);
}

main();
