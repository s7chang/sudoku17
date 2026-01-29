/**
 * Run rule-based human solver on all 17-clue puzzles and report difficulty stats.
 * Usage: npx tsx scripts/measureDifficulty.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { stringToGrid } from '../src/utils/gridUtils';
import { solveWithRules, RULES, type RuleId } from '../src/utils/humanSolver';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUZZLE_FILE = path.join(ROOT, 'puzzles2_17_clue');

function loadPuzzles(): string[] {
  const raw = fs.readFileSync(PUZZLE_FILE, 'utf-8');
  return raw
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\./g, '0').slice(0, 81))
    .filter((p) => {
      if (p.length !== 81) return false;
      const digits = p.replace(/0/g, '').length;
      return digits === 17;
    });
}

function main() {
  const lines = loadPuzzles();
  console.log(`Loaded ${lines.length} puzzles from ${PUZZLE_FILE}\n`);

  const results: { solved: boolean; highestRule: RuleId | null; highestRuleIndex: number; totalScore: number; steps: number }[] = [];
  const byRule: Record<string, number> = {};
  const scoreMin: number[] = [];
  const scoreMax: number[] = [];
  const scoreSum: number[] = [];
  const scoreCount: number[] = [];

  for (let i = 0; i <= RULES.length; i++) {
    byRule[i === RULES.length ? 'unsolved' : RULES[i].id] = 0;
    scoreMin[i] = Infinity;
    scoreMax[i] = -Infinity;
    scoreSum[i] = 0;
    scoreCount[i] = 0;
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const grid = stringToGrid(lines[idx]);
    const r = solveWithRules(grid);
    results.push({
      solved: r.solved,
      highestRule: r.highestRule,
      highestRuleIndex: r.highestRuleIndex,
      totalScore: r.totalScore,
      steps: r.steps,
    });

    const slot = r.solved ? r.highestRuleIndex : RULES.length;
    const key = r.solved ? RULES[r.highestRuleIndex!].id : 'unsolved';
    byRule[key] = (byRule[key] ?? 0) + 1;

    if (r.solved) {
      const i = r.highestRuleIndex!;
      scoreMin[i] = Math.min(scoreMin[i], r.totalScore);
      scoreMax[i] = Math.max(scoreMax[i], r.totalScore);
      scoreSum[i] += r.totalScore;
      scoreCount[i]++;
    }

    if ((idx + 1) % 5000 === 0) {
      console.log(`  ... ${idx + 1} / ${lines.length}`);
    }
  }

  const solved = results.filter((r) => r.solved).length;
  const unsolved = results.length - solved;

  console.log('\n--- Rule-based difficulty (human techniques) ---\n');
  console.log(`Total puzzles: ${results.length}`);
  console.log(`Solved:       ${solved}`);
  console.log(`Unsolved:     ${unsolved} (logic limit reached)\n`);

  console.log('By highest technique used:');
  for (let i = 0; i < RULES.length; i++) {
    const n = byRule[RULES[i].id] ?? 0;
    const avg = scoreCount[i] ? (scoreSum[i] / scoreCount[i]).toFixed(1) : '-';
    const mi = scoreMin[i] === Infinity ? '-' : scoreMin[i];
    const ma = scoreMax[i] === -Infinity ? '-' : scoreMax[i];
    console.log(`  ${RULES[i].name.padEnd(24)} weight=${RULES[i].weight}  count=${String(n).padStart(5)}  score avg=${avg}  min=${mi}  max=${ma}`);
  }
  console.log(`  ${'unsolved'.padEnd(24)}            count=${String(byRule.unsolved ?? 0).padStart(5)}\n`);

  const globalScores = results.filter((r) => r.solved).map((r) => r.totalScore);
  const avgScore = globalScores.length ? globalScores.reduce((a, b) => a + b, 0) / globalScores.length : 0;
  const minScore = globalScores.length ? Math.min(...globalScores) : 0;
  const maxScore = globalScores.length ? Math.max(...globalScores) : 0;

  console.log('Overall (solved only):');
  console.log(`  Total score — avg: ${avgScore.toFixed(2)}  min: ${minScore}  max: ${maxScore}`);
  const stepAvg = results.filter((r) => r.solved).reduce((s, r) => s + r.steps, 0) / (solved || 1);
  console.log(`  Steps       — avg: ${stepAvg.toFixed(1)}\n`);

  console.log('Difficulty = highest technique used + cumulative score (rule weights).');
  console.log('Rules applied in order: Naked Single → Hidden Single (row/col/box) → Naked Pairs → Pointing Pairs → Hidden Pairs.\n');

  const outPath = path.join(ROOT, 'difficulty-results.json');
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        total: results.length,
        solved,
        unsolved,
        byHighestRule: byRule,
        overallScore: { avg: avgScore, min: minScore, max: maxScore },
        perRuleScore: RULES.map((rule, i) => ({
          id: rule.id,
          weight: rule.weight,
          count: scoreCount[i],
          avg: scoreCount[i] ? scoreSum[i] / scoreCount[i] : null,
          min: scoreMin[i] === Infinity ? null : scoreMin[i],
          max: scoreMax[i] === -Infinity ? null : scoreMax[i],
        })),
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`Wrote ${outPath}`);
}

main();
