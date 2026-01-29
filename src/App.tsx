import { useState, useCallback, useEffect, useRef } from 'react';
import { SudokuGrid } from './components/SudokuGrid';
import { NumberPad } from './components/NumberPad';
import { useGameState } from './hooks/useGameState';
import { generatePuzzle, isSolved, Difficulty, Grid, countHints, solveSudoku, copyGrid } from './utils/sudoku';
import { getCachedPuzzle, cachePuzzle, initializeCache, clearCache } from './utils/puzzleCache';
import { getRandomKnown17CluePuzzle, getKnown17CluePuzzleByIndex, getTotal17CluePuzzleCount, findPuzzleIndexByGrid, PUZZLE_STATS } from './utils/knownPuzzles';
import { markPuzzleAsCompleted, isPuzzleCompletedByGrid, isPuzzleCompletedByIndex, getCompletedPuzzleCount, getPuzzleCompletionTime, getPuzzleCompletionTimeByIndex } from './utils/puzzleProgress';
import { formatTime } from './utils/formatTime';
import { StatsModal } from './components/StatsModal';
import './App.css';

function App() {
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [candidateMode, setCandidateMode] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null); // 숫자 모드와 후보 모드 공통 선택 번호
  const [showSolution, setShowSolution] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false); // 해답 보기 상태
  const [solvedGrid, setSolvedGrid] = useState<Grid | null>(null); // 해답 그리드
  const [isInitialized, setIsInitialized] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>('expert');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState<number | null>(null); // 현재 퍼즐 인덱스 (Expert 난도일 때만)
  const [selectedPuzzleNumber, setSelectedPuzzleNumber] = useState<string>(''); // 선택한 퍼즐 번호 입력
  const [, setCompletedPuzzles] = useState<Set<number>>(new Set()); // 완료한 퍼즐 목록 (상태 업데이트용)
  const [now, setNow] = useState(() => Date.now()); // 경과 타이머 갱신용
  const [showStats, setShowStats] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const pausedElapsedRef = useRef<number | null>(null);

  const {
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
    restartPuzzle,
    loadNewPuzzle,
  } = useGameState();

  // Worker 정리
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // 경과 타이머 1초마다 갱신
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // puzzleStartTime이 설정될 때 now도 동기화
  useEffect(() => {
    if (puzzleStartTime !== null) {
      setNow(Date.now());
    }
  }, [puzzleStartTime]);

  // 탭/창이 숨겨지면 타이머 정지(경과 시간 저장), 다시 보이면 그 시점부터 이어가기
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        if (puzzleStartTime !== null) {
          const elapsed = Date.now() - puzzleStartTime;
          pausedElapsedRef.current = elapsed;
          setPausedElapsed(elapsed); // 창을 닫아도 다시 열면 이 경과 시간부터 복원
        }
      } else {
        if (pausedElapsedRef.current !== null && puzzleStartTime !== null) {
          setPuzzleStartTime(Date.now() - pausedElapsedRef.current);
          pausedElapsedRef.current = null;
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [puzzleStartTime, setPuzzleStartTime, setPausedElapsed]);

  // 캐시 초기화 (알려진 17개 힌트 퍼즐들 추가)
  useEffect(() => {
    try {
      initializeCache();
      // 통계 출력
      console.log(`[17-Clue Puzzles] 총 ${PUZZLE_STATS.totalFound}개`);
      // 완료한 퍼즐 목록은 필요시 로드 (현재는 사용하지 않음)
    } catch (error) {
      console.error('캐시 초기화 오류:', error);
    }
  }, []);

  // 초기 게임 로드 (저장된 게임이 없으면 새 퍼즐 생성)
  useEffect(() => {
    if (!isInitialized) {
      // 저장된 게임이 있는지 확인 (initialGrid가 비어있지 않으면 저장된 게임)
      const hasSavedGame = state.initialGrid.some(row => row.some(cell => cell !== 0));
      if (!hasSavedGame) {
        loadPuzzleWithCache(difficulty);
      } else {
        // 저장된 게임은 useGameState에서 시간까지 함께 로드됨
        if (difficulty === 'expert') {
          const puzzleIndex = findPuzzleIndexByGrid(state.initialGrid);
          if (puzzleIndex >= 0) {
            setCurrentPuzzleIndex(puzzleIndex);
          }
        }
      }
      setIsInitialized(true);
    }
  }, [isInitialized, state.initialGrid, difficulty]);

  // 특정 인덱스의 퍼즐 로드 (Expert 난도 전용)
  const loadPuzzleByIndex = useCallback((index: number) => {
    if (difficulty !== 'expert') return;
    
    const puzzle = getKnown17CluePuzzleByIndex(index);
    if (puzzle) {
      setSelectedNumber(null);
      setSelectedCell(null);
      setIsGenerating(true);
      const hintCount = countHints(puzzle);
      console.log(`퍼즐 #${index + 1} 로드: ${hintCount}개 힌트`);
      loadNewPuzzle(puzzle);
      setCurrentPuzzleIndex(index);
      setPuzzleStartTime(Date.now());
      cachePuzzle(difficulty, puzzle);
      setIsGenerating(false);
    } else {
      alert(`퍼즐 #${index + 1}을 찾을 수 없습니다. (1-${getTotal17CluePuzzleCount()} 범위)`);
    }
  }, [difficulty, loadNewPuzzle]);

  // 캐시를 사용하여 퍼즐 로드
  const loadPuzzleWithCache = useCallback((targetDifficulty: Difficulty) => {
    setSelectedNumber(null);
    setSelectedCell(null);
    setIsGenerating(true);
    
    // 최고 난도(17개 힌트)인 경우, 알려진 퍼즐에서 먼저 시도
    if (targetDifficulty === 'expert') {
      const knownPuzzle = getRandomKnown17CluePuzzle();
      if (knownPuzzle) {
        const hintCount = countHints(knownPuzzle);
        // 퍼즐 인덱스 찾기
        const puzzleIndex = findPuzzleIndexByGrid(knownPuzzle);
        setCurrentPuzzleIndex(puzzleIndex >= 0 ? puzzleIndex : null);
        setPuzzleStartTime(Date.now());
        console.log(`알려진 17개 힌트 퍼즐 로드: ${hintCount}개 힌트${puzzleIndex >= 0 ? ` (#${puzzleIndex + 1})` : ''}`);
        loadNewPuzzle(knownPuzzle);
        cachePuzzle(targetDifficulty, knownPuzzle);
        setIsGenerating(false);
        return;
      }
    }
    
    // 먼저 캐시에서 확인
    const cached = getCachedPuzzle(targetDifficulty);
    if (cached) {
      const hintCount = countHints(cached);
      console.log(`캐시에서 ${targetDifficulty} 난도 퍼즐 로드: ${hintCount}개 힌트`);
              setPuzzleStartTime(Date.now());
      loadNewPuzzle(cached);
      setIsGenerating(false);
      return;
    }
    
    // 캐시에 없으면 생성 (비동기)
    const generateAsync = () => {
      try {
        const puzzle = generatePuzzle(targetDifficulty, true);
        const hintCount = countHints(puzzle);
        
        // 캐시에 저장
        cachePuzzle(targetDifficulty, puzzle);
        
        console.log(`${targetDifficulty} 난도 퍼즐 생성 완료: ${hintCount}개 힌트`);
        setPuzzleStartTime(Date.now());
        loadNewPuzzle(puzzle);
        setIsGenerating(false);
      } catch (error) {
        console.error('퍼즐 생성 오류:', error);
        setIsGenerating(false);
      }
    };
    
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(generateAsync, { timeout: 1000 });
    } else {
      setTimeout(generateAsync, 0);
    }
  }, [loadNewPuzzle]);

  // 새 게임 생성 (항상 랜덤)
  const generateNewGame = useCallback(() => {
    setSelectedNumber(null);
    setSelectedCell(null);
    setSelectedPuzzleNumber('');
    setIsGenerating(true);
    
    // Expert 난도인 경우, 알려진 퍼즐에서 랜덤 선택
    if (difficulty === 'expert') {
      const knownPuzzle = getRandomKnown17CluePuzzle();
      if (knownPuzzle) {
        const hintCount = countHints(knownPuzzle);
        // 퍼즐 인덱스 찾기
        const puzzleIndex = findPuzzleIndexByGrid(knownPuzzle);
        setCurrentPuzzleIndex(puzzleIndex >= 0 ? puzzleIndex : null);
        setPuzzleStartTime(Date.now());
        console.log(`새 게임 - 알려진 17개 힌트 퍼즐 로드: ${hintCount}개 힌트${puzzleIndex >= 0 ? ` (#${puzzleIndex + 1})` : ''}`);
        loadNewPuzzle(knownPuzzle);
        setIsGenerating(false);
        return;
      }
    }
    
    // 다른 난도이거나 Expert에서 알려진 퍼즐이 없는 경우, 새로 생성
    const generateAsync = () => {
      try {
        const puzzle = generatePuzzle(difficulty, true);
        const hintCount = countHints(puzzle);
        setCurrentPuzzleIndex(null);
        setPuzzleStartTime(Date.now());
        console.log(`새 게임 - ${difficulty} 난도 퍼즐 생성 완료: ${hintCount}개 힌트`);
        loadNewPuzzle(puzzle);
        cachePuzzle(difficulty, puzzle);
        setIsGenerating(false);
      } catch (error) {
        console.error('퍼즐 생성 오류:', error);
        setIsGenerating(false);
      }
    };
    
    if (typeof window.requestIdleCallback === 'function') {
      requestIdleCallback(generateAsync, { timeout: 1000 });
    } else {
      setTimeout(generateAsync, 0);
    }
  }, [difficulty, loadNewPuzzle]);

  // 셀 클릭 처리
  const handleCellClick = useCallback((row: number, col: number) => {
    // 초기 힌트 칸은 선택 불가
    if (state.initialGrid[row][col] !== 0) {
      return;
    }
    
    if (candidateMode) {
      // 후보 모드에서는 선택된 번호로 후보 토글
      if (selectedNumber !== null) {
        toggleCandidate(row, col, selectedNumber);
      }
      return;
    }
    
    // 숫자 모드에서는 선택된 번호가 있으면 입력
    if (selectedNumber !== null) {
      const [r, c] = [row, col];
      if (state.currentGrid[r][c] === selectedNumber) {
        clearValue(r, c);
      } else {
        setValue(r, c, selectedNumber);
      }
    } else {
      // 번호가 선택되지 않았으면 셀만 선택
      setSelectedCell([row, col]);
    }
  }, [candidateMode, selectedNumber, setValue, clearValue, toggleCandidate, state]);

  // 숫자 버튼 클릭 (번호 선택 - 숫자 모드와 후보 모드 공통)
  const handleNumberClick = useCallback((num: number) => {
    // 같은 번호를 다시 누르면 선택 해제
    setSelectedNumber(selectedNumber === num ? null : num);
    setSelectedCell(null); // 셀 선택 해제
  }, [selectedNumber]);

  // 지우기
  const handleClear = useCallback(() => {
    if (selectedCell) {
      const [row, col] = selectedCell;
      clearValue(row, col);
    }
    // 선택된 번호 해제
    setSelectedNumber(null);
  }, [selectedCell, clearValue]);

  // 해답 보기
  const handleShowAnswer = useCallback(() => {
    if (showAnswer) {
      // 해답 숨기기
      setShowAnswer(false);
      setSolvedGrid(null);
    } else {
      // 해답 계산 및 표시
      const gridToSolve = copyGrid(state.currentGrid);
      if (solveSudoku(gridToSolve)) {
        setSolvedGrid(gridToSolve);
        setShowAnswer(true);
      } else {
        alert('해답을 찾을 수 없습니다.');
      }
    }
  }, [showAnswer, state.currentGrid]);

  // 풀이 확인 및 완료 기록
  useEffect(() => {
    if (isGenerating) return;
    if (isSolved(state.currentGrid)) {
      setShowSolution(true);
      
      if (difficulty === 'expert' && puzzleStartTime !== null) {
        const isCompleted = isPuzzleCompletedByGrid(state.initialGrid);
        const completionTime = Date.now() - puzzleStartTime;
        let beatRecord = false;

        if (!isCompleted) {
          markPuzzleAsCompleted(state.initialGrid, currentPuzzleIndex ?? undefined, completionTime);
          setCompletedPuzzles(prev => {
            const newSet = new Set(prev);
            if (currentPuzzleIndex !== null) newSet.add(currentPuzzleIndex);
            return newSet;
          });
        } else {
          const existingTime = getPuzzleCompletionTime(state.initialGrid);
          if (existingTime !== null && completionTime < existingTime) {
            beatRecord = true;
            markPuzzleAsCompleted(state.initialGrid, currentPuzzleIndex ?? undefined, completionTime);
          }
        }

        // 완료 시 캐시 비우기 및 타이머 초기화
        clearCache(difficulty);
        setPuzzleStartTime(null);

        const timeStr = formatTime(completionTime);
        setTimeout(() => {
          alert(`축하합니다! 스도쿠를 완성했습니다!\n소요 시간: ${timeStr}${beatRecord ? '\n기록 갱신!' : ''}`);
        }, 100);
      } else if (puzzleStartTime !== null) {
        const completionTime = Date.now() - puzzleStartTime;
        clearCache(difficulty);
        setPuzzleStartTime(null);
        const timeStr = formatTime(completionTime);
        setTimeout(() => alert(`축하합니다! 스도쿠를 완성했습니다!\n소요 시간: ${timeStr}`), 100);
      }
    } else {
      setShowSolution(false);
    }
  }, [state.currentGrid, state.initialGrid, difficulty, currentPuzzleIndex, puzzleStartTime, isGenerating]);

  return (
    <div className="app">
      <aside className="app-sidebar">
        <h1 className="sidebar-title">Sudoku 17</h1>

        <div className="sidebar-section">
          <div className="difficulty-selector">
            <label htmlFor="difficulty">난도</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => {
                const newDifficulty = e.target.value as Difficulty;
                setDifficulty(newDifficulty);
                setCurrentPuzzleIndex(null);
                setSelectedPuzzleNumber('');
                loadPuzzleWithCache(newDifficulty);
              }}
              disabled={isGenerating}
              className="difficulty-select"
            >
              <option value="easy">쉬움 (35-40개 힌트)</option>
              <option value="medium">보통 (28-34개 힌트)</option>
              <option value="hard">어려움 (22-27개 힌트)</option>
              <option value="expert">최고 난도 (17개 힌트)</option>
            </select>
          </div>
        </div>

        {!isGenerating && puzzleStartTime != null && !isSolved(state.currentGrid) && (
          <div className="sidebar-section">
            <div className="timer-display" role="timer" aria-live="polite">
              경과: {formatTime(Math.max(0, now - puzzleStartTime))}
            </div>
          </div>
        )}

        {difficulty === 'expert' && (
          <div className="sidebar-section puzzle-selector">
            <div className="current-puzzle-info">
              {(() => {
                let puzzleIndex = currentPuzzleIndex;
                if (puzzleIndex === null && state.initialGrid.some(row => row.some(cell => cell !== 0))) {
                  puzzleIndex = findPuzzleIndexByGrid(state.initialGrid);
                  if (puzzleIndex >= 0) setCurrentPuzzleIndex(puzzleIndex);
                }
                const isCompleted = puzzleIndex !== null && puzzleIndex >= 0
                  ? isPuzzleCompletedByIndex(puzzleIndex)
                  : isPuzzleCompletedByGrid(state.initialGrid);
                const completionTime = puzzleIndex !== null && puzzleIndex >= 0
                  ? getPuzzleCompletionTimeByIndex(puzzleIndex)
                  : getPuzzleCompletionTime(state.initialGrid);
                return (
                  <>
                    {puzzleIndex !== null && puzzleIndex >= 0 && (
                      <span className={`current-puzzle-number ${isCompleted ? 'completed' : ''}`}>
                        현재: #{puzzleIndex + 1}
                        {isCompleted && (
                          <span className="completed-mark">
                            {' '}(풀어봄{completionTime !== null ? ` - ${formatTime(completionTime)}` : ''})
                          </span>
                        )}
                      </span>
                    )}
                    <span className="puzzle-progress">
                      완료: {getCompletedPuzzleCount()}/{getTotal17CluePuzzleCount()}
                    </span>
                  </>
                );
              })()}
            </div>
            <div className="puzzle-number-selector">
              <label htmlFor="puzzle-number">번호로 이동</label>
              <input
                id="puzzle-number"
                type="number"
                min="1"
                max={getTotal17CluePuzzleCount()}
                value={selectedPuzzleNumber}
                onChange={(e) => setSelectedPuzzleNumber(e.target.value)}
                placeholder="번호"
                className="puzzle-number-input"
                disabled={isGenerating}
              />
              <button
                className="action-button"
                onClick={() => {
                  const num = parseInt(selectedPuzzleNumber, 10);
                  if (num >= 1 && num <= getTotal17CluePuzzleCount()) {
                    loadPuzzleByIndex(num - 1);
                    setSelectedPuzzleNumber('');
                  } else {
                    alert(`1-${getTotal17CluePuzzleCount()} 범위의 번호를 입력하세요.`);
                  }
                }}
                disabled={isGenerating || !selectedPuzzleNumber}
              >
                이동
              </button>
            </div>
          </div>
        )}

        <div className="sidebar-section">
          <span className="hint-count">
            힌트: {state.initialGrid.reduce((sum, row) =>
              sum + row.filter(cell => cell !== 0).length, 0
            )}개
          </span>
        </div>

        <div className="sidebar-section sidebar-actions">
          <button className="action-button" onClick={undo} disabled={state.historyIndex <= 0}>
            Undo
          </button>
          <button className="action-button" onClick={redo} disabled={state.historyIndex >= state.history.length - 1}>
            Redo
          </button>
          <button
            className="action-button"
            onClick={() => {
              restartPuzzle();
              setPuzzleStartTime(Date.now());
            }}
          >
            다시 풀기
          </button>
          <button className={`action-button ${showAnswer ? 'active' : ''}`} onClick={handleShowAnswer}>
            {showAnswer ? '해답 숨기기' : '해답 보기'}
          </button>
          <button className="action-button" onClick={generateNewGame} disabled={isGenerating}>
            {isGenerating ? '생성 중...' : '새 게임'}
          </button>
          <button className="action-button" onClick={() => setShowStats(true)}>
            통계
          </button>
        </div>
      </aside>

      <main className="app-main">
        {showStats && <StatsModal onClose={() => setShowStats(false)} />}

        <div className="game-container">
          {isGenerating ? (
            <div className="generating-message">
              퍼즐을 생성하는 중입니다...
            </div>
          ) : (
            <>
              <SudokuGrid
                initialGrid={state.initialGrid}
                currentGrid={showAnswer && solvedGrid ? solvedGrid : state.currentGrid}
                candidates={state.candidates}
                candidateMode={candidateMode}
                selectedCandidateNum={selectedNumber}
                selectedCell={selectedCell}
                showAnswer={showAnswer}
                onCellClick={handleCellClick}
                onCellToggleCandidate={toggleCandidate}
              />
              <NumberPad
                onNumberClick={handleNumberClick}
                onClear={handleClear}
                selectedNumber={selectedNumber}
                candidateMode={candidateMode}
                onToggleMode={() => setCandidateMode(!candidateMode)}
                onFillAllCandidates={fillAllCandidates}
                disabledNumbers={(() => {
                  const g = state.currentGrid;
                  const counts = [0, 0, 0, 0, 0, 0, 0, 0, 0];
                  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
                    const v = g[r][c]; if (v >= 1 && v <= 9) counts[v - 1]++;
                  }
                  const s = new Set<number>();
                  for (let n = 1; n <= 9; n++) if (counts[n - 1] === 9) s.add(n);
                  return s;
                })()}
              />
            </>
          )}
        </div>

        {showSolution && (
          <div className="solution-message">완성되었습니다!</div>
        )}
      </main>

      <aside className="app-right-panel">
        <h3 className="right-panel-title">게임 방법</h3>
        <ul className="right-panel-list">
          <li>숫자 모드: 1~9 버튼 누른 뒤 셀 클릭으로 입력 (또는 셀 클릭 후 숫자 버튼)</li>
          <li>후보 모드: [후보]로 전환한 뒤 숫자 버튼 누르고, 셀 클릭·드래그로 해당 후보 표시/해제</li>
          <li>[전부] 버튼으로 빈 칸에 후보 일괄 채우기</li>
          <li>[지우기]로 선택한 셀 비우기</li>
          <li>Undo·Redo 버튼으로 되돌리기</li>
        </ul>
      </aside>
    </div>
  );
}

export default App;
