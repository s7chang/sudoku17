/**
 * Rule-based human Sudoku solver.
 * Techniques applied in order; each has a weight. Difficulty = highest technique + cumulative score.
 */

import {
  Grid,
  CandidateGrid,
  copyGrid,
  createCandidateGrid,
  copyCandidateGrid,
  canPlace,
  isSolved,
} from './sudoku';

export type RuleId =
  | 'naked_single'
  | 'hidden_single_row'
  | 'hidden_single_col'
  | 'hidden_single_box'
  | 'naked_pairs'
  | 'pointing_pairs'
  | 'hidden_pairs';

export interface Rule {
  id: RuleId;
  name: string;
  weight: number;
}

export const RULES: Rule[] = [
  { id: 'naked_single', name: 'Naked Single', weight: 1 },
  { id: 'hidden_single_row', name: 'Hidden Single (row)', weight: 2 },
  { id: 'hidden_single_col', name: 'Hidden Single (col)', weight: 2 },
  { id: 'hidden_single_box', name: 'Hidden Single (box)', weight: 2 },
  { id: 'naked_pairs', name: 'Naked Pairs', weight: 4 },
  { id: 'pointing_pairs', name: 'Pointing Pairs', weight: 5 },
  { id: 'hidden_pairs', name: 'Hidden Pairs', weight: 6 },
];

function buildCandidates(grid: Grid): CandidateGrid {
  const C = createCandidateGrid();
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      for (let n = 1; n <= 9; n++) {
        if (canPlace(grid, r, c, n)) C[r][c][n - 1] = true;
      }
    }
  }
  return C;
}

function countCands(c: boolean[]): number {
  let k = 0;
  for (let i = 0; i < 9; i++) if (c[i]) k++;
  return k;
}

function getCandList(c: boolean[]): number[] {
  const out: number[] = [];
  for (let n = 1; n <= 9; n++) if (c[n - 1]) out.push(n);
  return out;
}

function placeAndUpdate(grid: Grid, C: CandidateGrid, r: number, c: number, n: number): void {
  grid[r][c] = n;
  for (let i = 0; i < 9; i++) {
    C[r][i][n - 1] = false;
    C[i][c][n - 1] = false;
  }
  const br = Math.floor(r / 3) * 3;
  const bc = Math.floor(c / 3) * 3;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      C[br + i][bc + j][n - 1] = false;
    }
  }
  for (let i = 0; i < 9; i++) C[r][c][i] = false;
}

// --- Naked Single ---
function findNakedSingle(grid: Grid, C: CandidateGrid): { r: number; c: number; n: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const list = getCandList(C[r][c]);
      if (list.length === 1) return { r, c, n: list[0] };
    }
  }
  return null;
}

// --- Hidden Single (row) ---
function findHiddenSingleRow(grid: Grid, C: CandidateGrid): { r: number; c: number; n: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let n = 1; n <= 9; n++) {
      let count = 0;
      let cc = -1;
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) continue;
        if (C[r][c][n - 1]) {
          count++;
          cc = c;
        }
      }
      if (count === 1 && cc >= 0) return { r, c: cc, n };
    }
  }
  return null;
}

function findHiddenSingleCol(grid: Grid, C: CandidateGrid): { r: number; c: number; n: number } | null {
  for (let c = 0; c < 9; c++) {
    for (let n = 1; n <= 9; n++) {
      let count = 0;
      let rr = -1;
      for (let r = 0; r < 9; r++) {
        if (grid[r][c] !== 0) continue;
        if (C[r][c][n - 1]) {
          count++;
          rr = r;
        }
      }
      if (count === 1 && rr >= 0) return { r: rr, c, n };
    }
  }
  return null;
}

function findHiddenSingleBox(grid: Grid, C: CandidateGrid): { r: number; c: number; n: number } | null {
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      for (let n = 1; n <= 9; n++) {
        let count = 0;
        let rr = -1;
        let cc = -1;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const r = br * 3 + i;
            const c = bc * 3 + j;
            if (grid[r][c] !== 0) continue;
            if (C[r][c][n - 1]) {
              count++;
              rr = r;
              cc = c;
            }
          }
        }
        if (count === 1 && rr >= 0 && cc >= 0) return { r: rr, c: cc, n };
      }
    }
  }
  return null;
}

// --- Naked Pairs: same unit, two cells with exactly same two candidates; eliminate those from others ---
function applyNakedPairs(C: CandidateGrid): boolean {
  let changed = false;
  const units: { cells: [number, number][] }[] = [];

  for (let i = 0; i < 9; i++) {
    const row: [number, number][] = [];
    const col: [number, number][] = [];
    for (let j = 0; j < 9; j++) {
      row.push([i, j]);
      col.push([j, i]);
    }
    units.push({ cells: row });
    units.push({ cells: col });
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box: [number, number][] = [];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) box.push([br * 3 + i, bc * 3 + j]);
      }
      units.push({ cells: box });
    }
  }

  for (const { cells } of units) {
    const empty = cells.filter(([r, c]) => countCands(C[r][c]) >= 2);
    for (let a = 0; a < empty.length; a++) {
      for (let b = a + 1; b < empty.length; b++) {
        const [ra, ca] = empty[a];
        const [rb, cb] = empty[b];
        const la = getCandList(C[ra][ca]);
        const lb = getCandList(C[rb][cb]);
        if (la.length !== 2 || lb.length !== 2) continue;
        if (la[0] !== lb[0] || la[1] !== lb[1]) continue;
        const [n1, n2] = la;
        for (const [r, c] of cells) {
          if ((r === ra && c === ca) || (r === rb && c === cb)) continue;
          if (C[r][c][n1 - 1]) {
            C[r][c][n1 - 1] = false;
            changed = true;
          }
          if (C[r][c][n2 - 1]) {
            C[r][c][n2 - 1] = false;
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
  }
  return changed;
}

// --- Pointing pairs: in a box, digit only in one row or one col → remove from rest of row/col ---
function applyPointingPairs(C: CandidateGrid): boolean {
  let changed = false;
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      for (let n = 1; n <= 9; n++) {
        const pos: [number, number][] = [];
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const r = br * 3 + i;
            const c = bc * 3 + j;
            if (C[r][c][n - 1]) pos.push([r, c]);
          }
        }
        if (pos.length < 2) continue;
        const rows = new Set(pos.map(([r]) => r));
        const cols = new Set(pos.map(([, c]) => c));
        if (rows.size === 1) {
          const r0 = pos[0][0];
          for (let c = 0; c < 9; c++) {
            if (c >= bc * 3 && c < bc * 3 + 3) continue;
            if (C[r0][c][n - 1]) {
              C[r0][c][n - 1] = false;
              changed = true;
            }
          }
        }
        if (cols.size === 1) {
          const c0 = pos[0][1];
          for (let r = 0; r < 9; r++) {
            if (r >= br * 3 && r < br * 3 + 3) continue;
            if (C[r][c0][n - 1]) {
              C[r][c0][n - 1] = false;
              changed = true;
            }
          }
        }
        if (changed) return true;
      }
    }
  }
  return changed;
}

// --- Hidden Pairs: two digits in a unit share the same two cells; others in those cells can be removed ---
function applyHiddenPairs(C: CandidateGrid): boolean {
  let changed = false;
  const units: { cells: [number, number][] }[] = [];
  for (let i = 0; i < 9; i++) {
    const row: [number, number][] = [];
    const col: [number, number][] = [];
    for (let j = 0; j < 9; j++) {
      row.push([i, j]);
      col.push([j, i]);
    }
    units.push({ cells: row });
    units.push({ cells: col });
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      const box: [number, number][] = [];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) box.push([br * 3 + i, bc * 3 + j]);
      }
      units.push({ cells: box });
    }
  }

  for (const { cells } of units) {
    const empty = cells.filter(([r, c]) => countCands(C[r][c]) >= 2);
    for (let n1 = 1; n1 <= 9; n1++) {
      for (let n2 = n1 + 1; n2 <= 9; n2++) {
        const with1 = empty.filter(([r, c]) => C[r][c][n1 - 1]);
        const with2 = empty.filter(([r, c]) => C[r][c][n2 - 1]);
        if (with1.length !== 2 || with2.length !== 2) continue;
        const key = (r: number, c: number) => `${r},${c}`;
        const set1 = new Set(with1.map(([r, c]) => key(r, c)));
        const set2 = new Set(with2.map(([r, c]) => key(r, c)));
        if (set1.size !== 2 || set2.size !== 2 || !with1.every(([r, c]) => set2.has(key(r, c)))) continue;
        const [[r1, c1], [r2, c2]] = with1;
        const before1 = countCands(C[r1][c1]);
        const before2 = countCands(C[r2][c2]);
        if (before1 <= 2 && before2 <= 2) continue;
        for (let k = 1; k <= 9; k++) {
          if (k === n1 || k === n2) continue;
          if (C[r1][c1][k - 1]) {
            C[r1][c1][k - 1] = false;
            changed = true;
          }
          if (C[r2][c2][k - 1]) {
            C[r2][c2][k - 1] = false;
            changed = true;
          }
        }
        if (changed) return true;
      }
    }
  }
  return changed;
}

export interface SolveResult {
  solved: boolean;
  highestRule: RuleId | null;
  highestRuleIndex: number;
  totalScore: number;
  steps: number;
  ruleCounts: Record<RuleId, number>;
}

const MAX_STEPS = 10000;

export function solveWithRules(puzzle: Grid): SolveResult {
  const grid = copyGrid(puzzle);
  let C = buildCandidates(grid);
  let totalScore = 0;
  let highestRuleIndex = -1;
  const ruleCounts: Record<RuleId, number> = {
    naked_single: 0,
    hidden_single_row: 0,
    hidden_single_col: 0,
    hidden_single_box: 0,
    naked_pairs: 0,
    pointing_pairs: 0,
    hidden_pairs: 0,
  };
  let steps = 0;

  while (!isSolved(grid) && steps < MAX_STEPS) {
    let applied = false;

    const ns = findNakedSingle(grid, C);
    if (ns) {
      placeAndUpdate(grid, C, ns.r, ns.c, ns.n);
      const r = RULES[0];
      totalScore += r.weight;
      highestRuleIndex = Math.max(highestRuleIndex, 0);
      ruleCounts.naked_single++;
      applied = true;
    }

    if (!applied) {
      let hs = findHiddenSingleRow(grid, C);
      let ridx = 1;
      if (hs) {
        ridx = 1;
      } else {
        hs = findHiddenSingleCol(grid, C);
        if (hs) ridx = 2;
        else {
          hs = findHiddenSingleBox(grid, C);
          if (hs) ridx = 3;
        }
      }
      if (hs) {
        placeAndUpdate(grid, C, hs.r, hs.c, hs.n);
        const r = RULES[ridx];
        totalScore += r.weight;
        highestRuleIndex = Math.max(highestRuleIndex, ridx);
        if (ridx === 1) ruleCounts.hidden_single_row++;
        else if (ridx === 2) ruleCounts.hidden_single_col++;
        else ruleCounts.hidden_single_box++;
        applied = true;
      }
    }

    if (!applied) {
      if (applyNakedPairs(C)) {
        totalScore += RULES[4].weight;
        highestRuleIndex = Math.max(highestRuleIndex, 4);
        ruleCounts.naked_pairs++;
        applied = true;
      }
    }
    if (!applied) {
      if (applyPointingPairs(C)) {
        totalScore += RULES[5].weight;
        highestRuleIndex = Math.max(highestRuleIndex, 5);
        ruleCounts.pointing_pairs++;
        applied = true;
      }
    }
    if (!applied) {
      if (applyHiddenPairs(C)) {
        totalScore += RULES[6].weight;
        highestRuleIndex = Math.max(highestRuleIndex, 6);
        ruleCounts.hidden_pairs++;
        applied = true;
      }
    }

    if (!applied) break;
    steps++;
  }

  const solved = isSolved(grid);
  const highestRule: RuleId | null = highestRuleIndex >= 0 ? RULES[highestRuleIndex].id : null;

  return {
    solved,
    highestRule,
    highestRuleIndex,
    totalScore,
    steps,
    ruleCounts,
  };
}
