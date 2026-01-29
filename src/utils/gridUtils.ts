// 그리드 유틸리티 함수들

import { Grid } from './sudoku';

// 그리드를 문자열로 변환 (퍼즐 식별용)
export function gridToString(grid: Grid): string {
  let str = '';
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      str += grid[r][c] || '0';
    }
  }
  return str;
}

// 문자열을 그리드로 변환 (0 또는 . = 빈 칸)
export function stringToGrid(str: string): Grid {
  const s = str.replace(/\./g, '0').slice(0, 81);
  const grid: Grid = Array(9).fill(null).map(() => Array(9).fill(0));
  for (let i = 0; i < 81 && i < s.length; i++) {
    const row = Math.floor(i / 9);
    const col = i % 9;
    const ch = s[i];
    if (ch && ch !== '0' && ch !== '_') {
      const n = parseInt(ch, 10);
      if (n >= 1 && n <= 9) grid[row][col] = n;
    }
  }
  return grid;
}
