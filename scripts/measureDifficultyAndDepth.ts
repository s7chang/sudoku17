/**
 * 49,158개 퍼즐에 대해 난도(rule-based) + 뎁스(max_chain_depth) 측정.
 * 난도 최고 / 뎁스 최고 / 종합 최고 퍼즐 번호(1-based) 출력.
 *
 * Usage: npx tsx scripts/measureDifficultyAndDepth.ts [--limit N]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { stringToGrid } from '../src/utils/gridUtils';
import { solveWithRules, RULES } from '../src/utils/humanSolver';
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
  const total = lines.length;
  console.log(`Loaded ${total} puzzles${LIMIT > 0 ? ` (--limit ${LIMIT})` : ''}.\n`);
  console.log('Measuring: rule-based difficulty (totalScore) + Forcing Chain max_chain_depth.\n');

  type Row = { num: number; score: number; depth: number; highestRule: string | null };
  const rows: Row[] = [];
  let bestByScore = { num: 0, score: -1, depth: -1 };
  let bestByDepth = { num: 0, score: -1, depth: -1 };
  /** 종합: (depth, score) 내림차순, 첫 번째 */
  let bestOverall = { num: 0, score: -1, depth: -1 };

  for (let i = 0; i < total; i++) {
    const grid = stringToGrid(lines[i]);
    const dr = solveWithRules(grid);
    const fr = forcingChainSolve(grid);

    const num = i + 1;
    const score = dr.solved ? dr.totalScore : -1;
    const depth = fr.max_chain_depth;
    const highestRule = dr.highestRule ?? null;

    rows.push({ num, score, depth, highestRule });

    if (dr.solved && score > bestByScore.score) {
      bestByScore = { num, score, depth };
    }
    if (depth > bestByDepth.depth) {
      bestByDepth = { num, score: score >= 0 ? score : -1, depth };
    }
    const better = (a: { depth: number; score: number }, b: { depth: number; score: number }) =>
      a.depth !== b.depth ? a.depth > b.depth : a.score > b.score;
    if (dr.solved && better({ depth, score }, { depth: bestOverall.depth, score: bestOverall.score })) {
      bestOverall = { num, score, depth };
    }

    if ((i + 1) % 5000 === 0) {
      console.log(`  ... ${i + 1} / ${total}`);
    }
  }

  console.log('\n--- 난도 & 뎁스 측정 결과 ---\n');
  console.log(`총 퍼즐: ${total}개\n`);

  console.log('▶ 난도(총점) 최고:');
  console.log(`  번호 ${bestByScore.num}  (총점 ${bestByScore.score}, 뎁스 ${bestByScore.depth})\n`);

  console.log('▶ 뎁스(max_chain_depth) 최고:');
  console.log(`  번호 ${bestByDepth.num}  (뎁스 ${bestByDepth.depth}, 총점 ${bestByDepth.score})\n`);

  console.log('▶ 종합 최고 (뎁스 우선, 동점이면 난도 우선):');
  console.log(`  번호 ${bestOverall.num}  (뎁스 ${bestOverall.depth}, 총점 ${bestOverall.score})\n`);

  const outPath = path.join(ROOT, 'difficulty-and-depth-results.json');
  const payload = {
    total,
    hardestByScore: bestByScore,
    hardestByDepth: bestByDepth,
    hardestOverall: bestOverall,
    perPuzzle: rows.map((r) => ({ n: r.num, s: r.score, d: r.depth, h: r.highestRule })),
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`Wrote ${outPath}`);
}

main();
