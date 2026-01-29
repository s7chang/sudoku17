/**
 * Forcing Chain solver: propagation (naked/hidden single only) + assumption branching.
 * Tracks max_chain_depth = maximum assumption nesting depth.
 * "10단계 추론": max_chain_depth >= 10 → 소설적 묘사에 부합.
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

function findHiddenSingle(grid: Grid, C: CandidateGrid): { r: number; c: number; n: number } | null {
  for (let r = 0; r < 9; r++) {
    for (let n = 1; n <= 9; n++) {
      let cnt = 0;
      let cc = -1;
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== 0) continue;
        if (C[r][c][n - 1]) {
          cnt++;
          cc = c;
        }
      }
      if (cnt === 1 && cc >= 0) return { r, c: cc, n };
    }
  }
  for (let c = 0; c < 9; c++) {
    for (let n = 1; n <= 9; n++) {
      let cnt = 0;
      let rr = -1;
      for (let r = 0; r < 9; r++) {
        if (grid[r][c] !== 0) continue;
        if (C[r][c][n - 1]) {
          cnt++;
          rr = r;
        }
      }
      if (cnt === 1 && rr >= 0) return { r: rr, c, n };
    }
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      for (let n = 1; n <= 9; n++) {
        let cnt = 0;
        let rr = -1;
        let cc = -1;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const r = br * 3 + i;
            const c = bc * 3 + j;
            if (grid[r][c] !== 0) continue;
            if (C[r][c][n - 1]) {
              cnt++;
              rr = r;
              cc = c;
            }
          }
        }
        if (cnt === 1 && rr >= 0 && cc >= 0) return { r: rr, c: cc, n };
      }
    }
  }
  return null;
}

function hasContradiction(grid: Grid, C: CandidateGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      if (countCands(C[r][c]) === 0) return true;
    }
  }
  return false;
}

type PropResult = 'solved' | 'contradiction' | 'stuck';

function propagate(grid: Grid, C: CandidateGrid): PropResult {
  for (;;) {
    if (hasContradiction(grid, C)) return 'contradiction';
    if (isSolved(grid)) return 'solved';

    const ns = findNakedSingle(grid, C);
    if (ns) {
      placeAndUpdate(grid, C, ns.r, ns.c, ns.n);
      continue;
    }
    const hs = findHiddenSingle(grid, C);
    if (hs) {
      placeAndUpdate(grid, C, hs.r, hs.c, hs.n);
      continue;
    }
    return 'stuck';
  }
}

function pickCell(grid: Grid, C: CandidateGrid): { r: number; c: number; list: number[] } | null {
  let best: { r: number; c: number; list: number[] } | null = null;
  let minSize = 10;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const list = getCandList(C[r][c]);
      if (list.length >= 2 && list.length < minSize) {
        minSize = list.length;
        best = { r, c, list };
      }
    }
  }
  return best;
}

export interface ForcingChainResult {
  solved: boolean;
  max_chain_depth: number;
  /** max_chain_depth >= 10 → "10단계 추론" / 소설적 묘사에 부합 */
  ten_step_reasoning: boolean;
}

const MAX_DEPTH = 20;
const MAX_NODES = 2_000_000;

function solve(
  grid: Grid,
  C: CandidateGrid,
  depth: number,
  maxDepth: { value: number },
  nodeCount: { value: number }
): boolean {
  const res = propagate(grid, C);
  if (res === 'contradiction') return false;
  if (res === 'solved') return true;

  const cell = pickCell(grid, C);
  if (!cell || depth >= MAX_DEPTH) return false;

  for (const n of cell.list) {
    nodeCount.value++;
    if (nodeCount.value > MAX_NODES) return false;

    const g2 = copyGrid(grid);
    const C2 = copyCandidateGrid(C);
    placeAndUpdate(g2, C2, cell.r, cell.c, n);
    const nextDepth = depth + 1;
    if (nextDepth > maxDepth.value) maxDepth.value = nextDepth;

    if (solve(g2, C2, nextDepth, maxDepth, nodeCount)) return true;
  }
  return false;
}

/**
 * Solve via Forcing Chain (propagation + assumption branching).
 * Returns max_chain_depth = 최대 가정 중첩 깊이.
 */
export function forcingChainSolve(puzzle: Grid): ForcingChainResult {
  const grid = copyGrid(puzzle);
  const C = buildCandidates(grid);
  const maxDepth = { value: 0 };
  const nodeCount = { value: 0 };

  const solved = solve(grid, C, 0, maxDepth, nodeCount);

  return {
    solved,
    max_chain_depth: maxDepth.value,
    ten_step_reasoning: maxDepth.value >= 10,
  };
}
