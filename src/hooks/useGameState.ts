import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Grid, 
  CandidateGrid, 
  createEmptyGrid, 
  copyGrid,
  createCandidateGrid,
  calculateAllCandidates,
  copyCandidateGrid,
  applyCandidatesOnSetValue,
  applyCandidatesOnClearValue,
} from '../utils/sudoku';
import { GameState, GameAction, HistoryState } from '../types/game';

const STORAGE_KEY = 'sudoku17_game_state';

function createInitialState(initialGrid?: Grid): GameState {
  const grid = initialGrid || createEmptyGrid();
  const candidates = createCandidateGrid();
  const initialState: HistoryState = {
    grid: copyGrid(grid),
    candidates: copyCandidateGrid(candidates),
    manuallyRemovedCandidates: new Set<string>(),
  };
  return {
    initialGrid: copyGrid(grid),
    currentGrid: copyGrid(grid),
    candidates: candidates,
    manuallyRemovedCandidates: new Set<string>(),
    history: [initialState],
    historyIndex: 0,
  };
}

function loadStateFromStorage(): { state: GameState; puzzleStartTime: number | null } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const parsed = JSON.parse(stored);
    // 히스토리 복원
    const history: HistoryState[] = (parsed.history || []).map((h: any) => ({
      grid: h.grid || h, // 이전 버전 호환성
      candidates: h.candidates || createCandidateGrid(),
      manuallyRemovedCandidates: new Set(h.manuallyRemovedCandidates || []),
    }));
    
    const state: GameState = {
      ...parsed,
      manuallyRemovedCandidates: new Set(parsed.manuallyRemovedCandidates || []),
      history: history.length > 0 ? history : [{
        grid: parsed.currentGrid || parsed.initialGrid,
        candidates: parsed.candidates || createCandidateGrid(),
        manuallyRemovedCandidates: new Set(),
      }],
    };
    // 창을 닫을 때 저장된 정지 시점 경과 시간이 있으면 그 시점부터 다시 흐르게
    const pausedElapsed = parsed.pausedElapsed != null ? parsed.pausedElapsed : null;
    const puzzleStartTime = pausedElapsed != null
      ? Date.now() - pausedElapsed
      : (parsed.puzzleStartTime != null ? parsed.puzzleStartTime : null);
    return { state, puzzleStartTime };
  } catch {
    return null;
  }
}

function saveStateToStorage(state: GameState, puzzleStartTime: number | null, pausedElapsed: number | null = null): void {
  try {
    const toStore = {
      ...state,
      manuallyRemovedCandidates: Array.from(state.manuallyRemovedCandidates),
      history: state.history.map(h => ({
        grid: h.grid,
        candidates: h.candidates,
        manuallyRemovedCandidates: Array.from(h.manuallyRemovedCandidates),
      })),
      puzzleStartTime,
      pausedElapsed: pausedElapsed ?? null,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // 저장 실패 무시
  }
}

export function useGameState(initialGrid?: Grid) {
  const [state, setState] = useState<GameState>(() => {
    const loaded = loadStateFromStorage();
    if (loaded && loaded.state.initialGrid && loaded.state.initialGrid.some(row => row.some(cell => cell !== 0))) {
      return loaded.state;
    }
    return createInitialState(initialGrid);
  });

  const [puzzleStartTime, setPuzzleStartTime] = useState<number | null>(() => {
    const loaded = loadStateFromStorage();
    if (loaded && loaded.state.initialGrid && loaded.state.initialGrid.some(row => row.some(cell => cell !== 0))) {
      return loaded.puzzleStartTime;
    }
    return null;
  });

  const stateRef = useRef(state);
  const puzzleStartTimeRef = useRef(puzzleStartTime);
  stateRef.current = state;
  puzzleStartTimeRef.current = puzzleStartTime;

  // 상태·시간이 변경될 때마다 함께 저장 (pausedElapsed는 null로 저장해 정지 시점 경과는 한 번만 적용)
  useEffect(() => {
    saveStateToStorage(state, puzzleStartTime);
  }, [state, puzzleStartTime]);

  // 창을 닫을 때 정지 시점 경과 시간을 저장 (다시 열면 그 시점부터 이어감)
  const setPausedElapsed = useCallback((elapsed: number) => {
    saveStateToStorage(stateRef.current, puzzleStartTimeRef.current, elapsed);
  }, []);

  const dispatch = useCallback((action: GameAction) => {
    setState(prev => {
      let newState: GameState;

      switch (action.type) {
        case 'SET_VALUE': {
          if (action.row === undefined || action.col === undefined || action.value === undefined) {
            return prev;
          }
          
          const { row, col, value } = action;
          
          // 초기 힌트는 변경 불가
          if (prev.initialGrid[row][col] !== 0) {
            return prev;
          }
          
          const newGrid = copyGrid(prev.currentGrid);
          newGrid[row][col] = value;
          
          // 해당 셀의 수동으로 지운 후보 정보 제거 (숫자가 입력되었으므로)
          const newManuallyRemoved = new Set(prev.manuallyRemovedCandidates);
          for (let num = 1; num <= 9; num++) {
            const key = `${row},${col},${num}`;
            newManuallyRemoved.delete(key);
          }
          
          const newCandidates = applyCandidatesOnSetValue(
            prev.candidates,
            row,
            col,
            value
          );
          
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push({
            grid: copyGrid(newGrid),
            candidates: copyCandidateGrid(newCandidates),
            manuallyRemovedCandidates: new Set(newManuallyRemoved),
          });
          
          newState = {
            ...prev,
            currentGrid: newGrid,
            candidates: newCandidates,
            manuallyRemovedCandidates: newManuallyRemoved,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
          break;
        }
        
        case 'CLEAR_VALUE': {
          if (action.row === undefined || action.col === undefined) {
            return prev;
          }
          
          const { row, col } = action;
          
          // 초기 힌트는 변경 불가
          if (prev.initialGrid[row][col] !== 0) {
            return prev;
          }
          
          const newGrid = copyGrid(prev.currentGrid);
          newGrid[row][col] = 0;
          
          const newCandidates = applyCandidatesOnClearValue(prev.candidates, row, col);
          
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push({
            grid: copyGrid(newGrid),
            candidates: copyCandidateGrid(newCandidates),
            manuallyRemovedCandidates: new Set(prev.manuallyRemovedCandidates),
          });
          
          newState = {
            ...prev,
            currentGrid: newGrid,
            candidates: newCandidates,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
          break;
        }
        
        case 'TOGGLE_CANDIDATE': {
          if (action.row === undefined || action.col === undefined || action.candidateNum === undefined) {
            return prev;
          }
          
          const { row, col, candidateNum } = action;
          
          // 이미 숫자가 있으면 후보 변경 불가
          if (prev.currentGrid[row][col] !== 0) {
            return prev;
          }
          
          const key = `${row},${col},${candidateNum}`;
          const newManuallyRemoved = new Set(prev.manuallyRemovedCandidates);
          
          if (newManuallyRemoved.has(key)) {
            newManuallyRemoved.delete(key);
          } else {
            newManuallyRemoved.add(key);
          }
          
          // 후보 재계산
          const newCandidates = calculateAllCandidates(
            prev.currentGrid,
            prev.candidates,
            newManuallyRemoved
          );
          
          // 히스토리 업데이트 (후보 변경도 히스토리에 포함)
          const newHistory = prev.history.slice(0, prev.historyIndex + 1);
          newHistory.push({
            grid: copyGrid(prev.currentGrid),
            candidates: copyCandidateGrid(newCandidates),
            manuallyRemovedCandidates: new Set(newManuallyRemoved),
          });
          
          newState = {
            ...prev,
            candidates: newCandidates,
            manuallyRemovedCandidates: newManuallyRemoved,
            history: newHistory,
            historyIndex: newHistory.length - 1,
          };
          break;
        }
        
        case 'UNDO': {
          if (prev.historyIndex <= 0) {
            return prev;
          }
          
          const newIndex = prev.historyIndex - 1;
          const historyState = prev.history[newIndex];
          
          newState = {
            ...prev,
            currentGrid: copyGrid(historyState.grid),
            candidates: copyCandidateGrid(historyState.candidates),
            manuallyRemovedCandidates: new Set(historyState.manuallyRemovedCandidates),
            historyIndex: newIndex,
          };
          break;
        }
        
        case 'REDO': {
          if (prev.historyIndex >= prev.history.length - 1) {
            return prev;
          }
          
          const newIndex = prev.historyIndex + 1;
          const historyState = prev.history[newIndex];
          
          newState = {
            ...prev,
            currentGrid: copyGrid(historyState.grid),
            candidates: copyCandidateGrid(historyState.candidates),
            manuallyRemovedCandidates: new Set(historyState.manuallyRemovedCandidates),
            historyIndex: newIndex,
          };
          break;
        }
        
        case 'RESET': {
          newState = createInitialState(prev.initialGrid);
          break;
        }
        
        case 'LOAD_STATE': {
          if (action.state) {
            newState = action.state;
          } else {
            return prev;
          }
          break;
        }
        
        default:
          return prev;
      }
      
      return newState;
    });
  }, []);

  const fillAllCandidates = useCallback(() => {
    setState(prev => {
      const newCandidates = calculateAllCandidates(
        prev.currentGrid,
        prev.candidates,
        prev.manuallyRemovedCandidates
      );
      
      return {
        ...prev,
        candidates: newCandidates,
      };
    });
  }, []);

  const resetGame = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, [dispatch]);

  const restartPuzzle = useCallback(() => {
    // 현재 퍼즐을 초기 상태로 리셋 (히스토리는 유지하지 않음)
    setState(prev => {
      const initialState: HistoryState = {
        grid: copyGrid(prev.initialGrid),
        candidates: createCandidateGrid(),
        manuallyRemovedCandidates: new Set<string>(),
      };
      return {
        ...prev,
        currentGrid: copyGrid(prev.initialGrid),
        candidates: createCandidateGrid(),
        manuallyRemovedCandidates: new Set<string>(),
        history: [initialState],
        historyIndex: 0,
      };
    });
  }, []);

  const loadNewPuzzle = useCallback((puzzle: Grid) => {
    const newState = createInitialState(puzzle);
    dispatch({ type: 'LOAD_STATE', state: newState });
  }, [dispatch]);

  const undo = useCallback(() => {
    dispatch({ type: 'UNDO' });
  }, [dispatch]);

  const redo = useCallback(() => {
    dispatch({ type: 'REDO' });
  }, [dispatch]);

  const setValue = useCallback((row: number, col: number, value: number) => {
    dispatch({ type: 'SET_VALUE', row, col, value });
  }, [dispatch]);

  const clearValue = useCallback((row: number, col: number) => {
    dispatch({ type: 'CLEAR_VALUE', row, col });
  }, [dispatch]);

  const toggleCandidate = useCallback((row: number, col: number, candidateNum: number) => {
    dispatch({ type: 'TOGGLE_CANDIDATE', row, col, candidateNum });
  }, [dispatch]);

  return {
    state,
    puzzleStartTime,
    setPuzzleStartTime,
    setPausedElapsed,
    setValue,
    clearValue,
    toggleCandidate,
    fillAllCandidates,
    undo,
    redo,
    resetGame,
    restartPuzzle,
    loadNewPuzzle,
  };
}
