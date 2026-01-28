// 알려진 17개 힌트 스도쿠 퍼즐들
// 문자열 형식: 0은 빈 칸, 1-9는 숫자

import { Grid } from './sudoku';

// 퍼즐 원본 파일 (프로젝트 루트 puzzles2_17_clue)
// 출처: Gordon Royle, Dobrichev 컬렉션, EnjoySudoku 포럼
// 원본에 이미 동형 제거된 고유 퍼즐만 포함됨
import puzzlesRaw from '../../puzzles2_17_clue?raw';

// 문자열을 그리드로 변환
function stringToGrid(str: string): Grid {
  const grid: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
  for (let i = 0; i < 81; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const char = str[i];
    if (char && char !== '0' && char !== '.' && char !== '_') {
      const num = parseInt(char, 10);
      if (num >= 1 && num <= 9) {
        grid[row][col] = num;
      }
    }
  }
  return grid;
}

// 그리드를 문자열로 변환
function gridToString(grid: Grid): string {
  let str = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      str += grid[r][c] || '0';
    }
  }
  return str;
}

// 원본 파일 파싱: # 주석·빈 줄 제외, 81자·17힌트만
function parsePuzzleFile(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.replace(/\./g, '0').slice(0, 81))
    .filter((p) => {
      if (p.length !== 81) return false;
      const digitCount = p.split('').filter((c) => c >= '1' && c <= '9').length;
      return digitCount === 17;
    });
}

const ALL_17_CLUE_PUZZLES = parsePuzzleFile(puzzlesRaw);

export const PUZZLE_STATS = {
  totalFound: ALL_17_CLUE_PUZZLES.length,
};

export function logPuzzleStats(): void {
  console.log(`[17-Clue Puzzles] 총 ${PUZZLE_STATS.totalFound}개`);
}

export function getKnown17CluePuzzles(): Grid[] {
  return ALL_17_CLUE_PUZZLES.map(stringToGrid);
}

export function getRandomKnown17CluePuzzle(): Grid | null {
  if (ALL_17_CLUE_PUZZLES.length === 0) return null;
  const randomIndex = Math.floor(Math.random() * ALL_17_CLUE_PUZZLES.length);
  return stringToGrid(ALL_17_CLUE_PUZZLES[randomIndex]);
}

export function getKnown17CluePuzzleByIndex(index: number): Grid | null {
  if (ALL_17_CLUE_PUZZLES.length === 0) return null;
  if (index < 0 || index >= ALL_17_CLUE_PUZZLES.length) return null;
  return stringToGrid(ALL_17_CLUE_PUZZLES[index]);
}

export function getTotal17CluePuzzleCount(): number {
  return ALL_17_CLUE_PUZZLES.length;
}

export function findPuzzleIndexByGrid(grid: Grid): number {
  const gridStr = gridToString(grid);
  for (let i = 0; i < ALL_17_CLUE_PUZZLES.length; i++) {
    if (ALL_17_CLUE_PUZZLES[i] === gridStr) {
      return i;
    }
  }
  return -1;
}
