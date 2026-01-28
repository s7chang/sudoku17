// 스도쿠 유틸리티 함수들

export type Grid = number[][];
export type CandidateGrid = boolean[][][]; // [row][col][num-1]

// 빈 그리드 생성
export function createEmptyGrid(): Grid {
  return Array(9).fill(null).map(() => Array(9).fill(0));
}

// 그리드 복사
export function copyGrid(grid: Grid): Grid {
  return grid.map(row => [...row]);
}

// 후보 그리드 복사
export function copyCandidateGrid(candidates: CandidateGrid): CandidateGrid {
  return candidates.map(row => 
    row.map(col => [...col])
  );
}

// 유효한 숫자인지 확인
export function isValidNumber(num: number): boolean {
  return num >= 1 && num <= 9;
}

// 특정 위치에 숫자를 넣을 수 있는지 확인
export function canPlace(grid: Grid, row: number, col: number, num: number): boolean {
  // 같은 행 확인
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }
  
  // 같은 열 확인
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }
  
  // 같은 3x3 박스 확인
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  
  return true;
}

// 스도쿠가 완전히 풀렸는지 확인
export function isSolved(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) return false;
      if (!canPlace(grid, r, c, grid[r][c])) {
        // 이미 채워진 숫자가 규칙을 위반하는 경우
        const num = grid[r][c];
        grid[r][c] = 0;
        const valid = canPlace(grid, r, c, num);
        grid[r][c] = num;
        if (!valid) return false;
      }
    }
  }
  return true;
}

// 스도쿠 해결 (백트래킹)
export function solveSudoku(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        for (let num = 1; num <= 9; num++) {
          if (canPlace(grid, r, c, num)) {
            grid[r][c] = num;
            if (solveSudoku(grid)) {
              return true;
            }
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

// 해가 유일한지 확인 (최적화 버전)
export function hasUniqueSolution(grid: Grid): boolean {
  let solutionCount = 0;
  
  function countSolutions(g: Grid): void {
    if (solutionCount > 1) return; // 2개 이상 발견하면 즉시 종료
    
    // 가장 제약이 많은 셀부터 찾기 (최적화)
    let bestRow = -1;
    let bestCol = -1;
    let minCandidates = 10;
    
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g[r][c] === 0) {
          let candidates = 0;
          for (let num = 1; num <= 9; num++) {
            if (canPlace(g, r, c, num)) {
              candidates++;
            }
          }
          if (candidates < minCandidates) {
            minCandidates = candidates;
            bestRow = r;
            bestCol = c;
          }
        }
      }
    }
    
    // 빈 셀이 없으면 해를 찾음
    if (bestRow === -1) {
      solutionCount++;
      return;
    }
    
    // 후보가 없으면 해가 없음
    if (minCandidates === 0) {
      return;
    }
    
    // 가장 제약이 많은 셀에 대해 시도
    for (let num = 1; num <= 9; num++) {
      if (canPlace(g, bestRow, bestCol, num)) {
        g[bestRow][bestCol] = num;
        countSolutions(g);
        g[bestRow][bestCol] = 0;
        if (solutionCount > 1) return; // 조기 종료
      }
    }
  }
  
  countSolutions(copyGrid(grid));
  return solutionCount === 1;
}

// 난도 타입
export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert';

// 난도별 힌트 개수 범위
const DIFFICULTY_HINTS: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 35, max: 40 },
  medium: { min: 28, max: 34 },
  hard: { min: 22, max: 27 },
  expert: { min: 17, max: 17 }, // 최고 난도는 정확히 17개
};

// 현재 그리드의 힌트 개수 계산
export function countHints(grid: Grid): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) count++;
    }
  }
  return count;
}

// 특정 힌트 개수로 퍼즐 생성
function generatePuzzleWithHints(targetHints: number, maxAttempts: number = 50): Grid {
  // 17개 힌트는 매우 어려우므로 더 많은 시도 필요
  const attempts = targetHints === 17 ? 200 : maxAttempts;
  
  for (let attempt = 0; attempt < attempts; attempt++) {
    // 완전히 풀린 스도쿠 생성
    const solved = createEmptyGrid();
    solveSudoku(solved);
    
    // 랜덤하게 숫자 제거
    const puzzle = copyGrid(solved);
    const positions: [number, number][] = [];
    
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        positions.push([r, c]);
      }
    }
    
    // 셔플
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    // 목표 힌트 개수만큼 남기고 제거
    const targetRemoved = 81 - targetHints;
    let removed = 0;
    
    // 여러 라운드로 제거 시도 (더 많은 숫자를 제거하기 위해)
    for (let round = 0; round < 3; round++) {
      // 매 라운드마다 위치를 다시 셔플
      for (let i = positions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [positions[i], positions[j]] = [positions[j], positions[i]];
      }
      
      for (const [r, c] of positions) {
        if (removed >= targetRemoved) break;
        if (puzzle[r][c] === 0) continue; // 이미 제거된 셀은 스킵
        
        const num = puzzle[r][c];
        puzzle[r][c] = 0;
        
        // 유일한 해가 있는지 확인
        if (hasUniqueSolution(puzzle)) {
          removed++;
          if (removed >= targetRemoved) break;
        } else {
          // 유일한 해가 아니면 되돌림
          puzzle[r][c] = num;
        }
      }
      
      if (removed >= targetRemoved) break;
    }
    
    // 정확히 목표 힌트 개수인지 확인
    const currentHints = countHints(puzzle);
    if (currentHints === targetHints) {
      return puzzle;
    }
    
    // 17개 힌트의 경우, 정확히 17개가 아니면 계속 시도
    if (targetHints === 17 && currentHints > 17) {
      continue; // 다시 시도
    }
    
    // 다른 난도의 경우, 범위 내에 있으면 허용
    if (targetHints !== 17) {
      // 범위 내에 있으면 반환 (약간의 여유 허용)
      if (currentHints <= targetHints + 2 && currentHints >= targetHints - 2) {
        return puzzle;
      }
    }
  }
  
  // 최대 시도 횟수에 도달했지만 정확한 개수를 만들지 못한 경우
  // 마지막으로 더 공격적으로 시도
  const solved = createEmptyGrid();
  solveSudoku(solved);
  const puzzle = copyGrid(solved);
  const positions: [number, number][] = [];
  
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      positions.push([r, c]);
    }
  }
  
  const targetRemoved = 81 - targetHints;
  let removed = 0;
  
  // 여러 라운드로 더 공격적으로 제거
  for (let round = 0; round < 10; round++) {
    // 매 라운드마다 위치를 다시 셔플
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }
    
    for (const [r, c] of positions) {
      if (removed >= targetRemoved) break;
      if (puzzle[r][c] === 0) continue;
      
      const num = puzzle[r][c];
      puzzle[r][c] = 0;
      
      if (hasUniqueSolution(puzzle)) {
        removed++;
        if (removed >= targetRemoved) break;
      } else {
        puzzle[r][c] = num;
      }
    }
    
    if (removed >= targetRemoved) break;
  }
  
  return puzzle;
}

// 난도별 퍼즐 생성 (캐시 지원)
export function generatePuzzle(
  difficulty: Difficulty = 'expert',
  useCache: boolean = true
): Grid {
  const { min, max } = DIFFICULTY_HINTS[difficulty];
  
  if (difficulty === 'expert') {
    // 최고 난도는 정확히 17개가 될 때까지 반복 시도
    // 하지만 시도 횟수를 줄여서 더 빠르게
    let bestPuzzle: Grid | null = null;
    let bestHints = 81;
    
    // 최대 20번 시도 (캐시를 사용하므로 적은 시도로 충분)
    const maxAttempts = useCache ? 20 : 50;
    
    for (let i = 0; i < maxAttempts; i++) {
      const puzzle = generatePuzzleWithHints(17, 10); // 각 시도마다 10번만 시도
      const hints = countHints(puzzle);
      
      if (hints === 17) {
        return puzzle;
      }
      
      if (hints < bestHints && hints >= 17) {
        bestHints = hints;
        bestPuzzle = puzzle;
      }
    }
    
    if (bestPuzzle && bestHints >= 17) {
      return bestPuzzle;
    }
    
    return generatePuzzleWithHints(17, 10);
  }
  
  // 다른 난도는 범위 내에서 랜덤
  const targetHints = Math.floor(Math.random() * (max - min + 1)) + min;
  return generatePuzzleWithHints(targetHints, 20);
}

// 17개 힌트 문제 생성 (하위 호환성)
export function generate17HintPuzzle(): Grid {
  return generatePuzzle('expert');
}

// 후보 그리드 초기화
export function createCandidateGrid(): CandidateGrid {
  return Array(9).fill(null).map(() => 
    Array(9).fill(null).map(() => Array(9).fill(false))
  );
}

// 특정 위치의 가능한 후보 계산
export function calculateCandidates(grid: Grid, row: number, col: number): boolean[] {
  const candidates = Array(9).fill(false);
  
  if (grid[row][col] !== 0) {
    return candidates; // 이미 숫자가 있으면 후보 없음
  }
  
  for (let num = 1; num <= 9; num++) {
    if (canPlace(grid, row, col, num)) {
      candidates[num - 1] = true;
    }
  }
  
  return candidates;
}

// 모든 후보 자동 계산
export function calculateAllCandidates(
  grid: Grid,
  existingCandidates: CandidateGrid, // 사용하지 않지만 호환성을 위해 유지
  manuallyRemoved: Set<string> // "row,col,num" 형식
): CandidateGrid {
  const newCandidates = createCandidateGrid();
  
  // 모든 셀에 대해 후보를 새로 계산
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) {
        // 현재 그리드 상태를 기반으로 가능한 후보 계산
        const autoCandidates = calculateCandidates(grid, r, c);
        for (let num = 1; num <= 9; num++) {
          const key = `${r},${c},${num}`;
          // 자동 계산된 후보이면서 수동으로 지운 것이 아닌 경우만 표시
          // 수동으로 지운 후보는 자동 계산에서 제외되지만, 
          // 나중에 다시 가능해지면 수동 제거 상태를 확인해야 함
          if (autoCandidates[num - 1]) {
            // 자동으로 가능한 후보인 경우, 수동으로 지운 것이 아니면 표시
            newCandidates[r][c][num - 1] = !manuallyRemoved.has(key);
          } else {
            // 자동으로 불가능한 후보는 항상 false
            newCandidates[r][c][num - 1] = false;
          }
        }
      } else {
        // 숫자가 있는 셀은 후보 없음
        for (let num = 1; num <= 9; num++) {
          newCandidates[r][c][num - 1] = false;
        }
      }
    }
  }
  
  return newCandidates;
}
