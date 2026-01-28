import { Grid, CandidateGrid } from '../utils/sudoku';

export interface HistoryState {
  grid: Grid;
  candidates: CandidateGrid;
  manuallyRemovedCandidates: Set<string>;
}

export interface GameState {
  initialGrid: Grid; // 처음 주어진 문제
  currentGrid: Grid; // 현재 상태
  candidates: CandidateGrid; // 후보
  manuallyRemovedCandidates: Set<string>; // 수동으로 지운 후보 ("row,col,num")
  history: HistoryState[]; // Undo를 위한 히스토리 (그리드 + 후보 상태)
  historyIndex: number; // 현재 히스토리 인덱스
}

export interface GameAction {
  type: 'SET_VALUE' | 'CLEAR_VALUE' | 'TOGGLE_CANDIDATE' | 'UNDO' | 'REDO' | 'RESET' | 'LOAD_STATE';
  row?: number;
  col?: number;
  value?: number;
  candidateNum?: number;
  state?: GameState;
}
