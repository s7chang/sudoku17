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
