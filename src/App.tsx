import { useState, useCallback, useEffect, useRef } from 'react';
import { SudokuGrid } from './components/SudokuGrid';
import { NumberPad } from './components/NumberPad';
import { useGameState } from './hooks/useGameState';
import { generatePuzzle, isSolved, Difficulty, Grid, countHints, solveSudoku, copyGrid } from './utils/sudoku';
import { getCachedPuzzle, cachePuzzle, initializeCache } from './utils/puzzleCache';
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
  const [puzzleStartTime, setPuzzleStartTime] = useState<number | null>(null); // 퍼즐 시작 시간
  const [now, setNow] = useState(() => Date.now()); // 경과 타이머 갱신용
  const [showStats, setShowStats] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  
  const {
    state,
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
        setPuzzleStartTime(Date.now()); // 재개 시 타이머 시작
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
      setIsGenerating(true);
      const hintCount = countHints(puzzle);
      console.log(`퍼즐 #${index + 1} 로드: ${hintCount}개 힌트`);
      loadNewPuzzle(puzzle);
      setCurrentPuzzleIndex(index);
      setPuzzleStartTime(Date.now()); // 시작 시간 기록
      cachePuzzle(difficulty, puzzle);
      setIsGenerating(false);
    } else {
      alert(`퍼즐 #${index + 1}을 찾을 수 없습니다. (1-${getTotal17CluePuzzleCount()} 범위)`);
    }
  }, [difficulty, loadNewPuzzle]);

  // 캐시를 사용하여 퍼즐 로드
  const loadPuzzleWithCache = useCallback((targetDifficulty: Difficulty) => {
    setIsGenerating(true);
    
    // 최고 난도(17개 힌트)인 경우, 알려진 퍼즐에서 먼저 시도
    if (targetDifficulty === 'expert') {
      const knownPuzzle = getRandomKnown17CluePuzzle();
      if (knownPuzzle) {
        const hintCount = countHints(knownPuzzle);
        // 퍼즐 인덱스 찾기
        const puzzleIndex = findPuzzleIndexByGrid(knownPuzzle);
        setCurrentPuzzleIndex(puzzleIndex >= 0 ? puzzleIndex : null);
        setPuzzleStartTime(Date.now()); // 시작 시간 기록
        console.log(`알려진 17개 힌트 퍼즐 로드: ${hintCount}개 힌트${puzzleIndex >= 0 ? ` (#${puzzleIndex + 1})` : ''}`);
        loadNewPuzzle(knownPuzzle);
        cachePuzzle(targetDifficulty, knownPuzzle); // 캐시에도 저장
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
        setPuzzleStartTime(Date.now()); // 시작 시간 기록
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
        setPuzzleStartTime(Date.now()); // 시작 시간 기록
        console.log(`새 게임 - ${difficulty} 난도 퍼즐 생성 완료: ${hintCount}개 힌트`);
        loadNewPuzzle(puzzle);
        cachePuzzle(difficulty, puzzle); // 캐시에도 저장
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

        const timeStr = formatTime(completionTime);
        setTimeout(() => {
          alert(`축하합니다! 스도쿠를 완성했습니다!\n소요 시간: ${timeStr}${beatRecord ? '\n기록 갱신!' : ''}`);
        }, 100);
      } else if (puzzleStartTime !== null) {
        const timeStr = formatTime(Date.now() - puzzleStartTime);
        setTimeout(() => alert(`축하합니다! 스도쿠를 완성했습니다!\n소요 시간: ${timeStr}`), 100);
      } else {
        setTimeout(() => alert('축하합니다! 스도쿠를 완성했습니다!'), 100);
      }
    } else {
      setShowSolution(false);
    }
  }, [state.currentGrid, state.initialGrid, difficulty, currentPuzzleIndex, puzzleStartTime]);

  return (
    <div className="app">
      <div className="app-header">
        <h1>Sudoku 17</h1>
        <div className="controls">
          <div className="difficulty-selector">
            <label htmlFor="difficulty">난도:</label>
            <select
              id="difficulty"
              value={difficulty}
              onChange={(e) => {
                setDifficulty(e.target.value as Difficulty);
                setCurrentPuzzleIndex(null); // 난도 변경 시 인덱스 초기화
                setSelectedPuzzleNumber('');
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
          {difficulty === 'expert' && (
            <div className="puzzle-selector">
              <div className="current-puzzle-info">
                {(() => {
                  let puzzleIndex = currentPuzzleIndex;
                  if (puzzleIndex === null && state.initialGrid.some(row => row.some(cell => cell !== 0))) {
                    puzzleIndex = findPuzzleIndexByGrid(state.initialGrid);
                    if (puzzleIndex >= 0) {
                      setCurrentPuzzleIndex(puzzleIndex);
                    }
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
                <label htmlFor="puzzle-number">다른 번호로 이동:</label>
                <input
                  id="puzzle-number"
                  type="number"
                  min="1"
                  max={getTotal17CluePuzzleCount()}
                  value={selectedPuzzleNumber}
                  onChange={(e) => setSelectedPuzzleNumber(e.target.value)}
                  placeholder="번호 입력"
                  className="puzzle-number-input"
                  disabled={isGenerating}
                />
                <button
                  className="action-button"
                  onClick={() => {
                    const num = parseInt(selectedPuzzleNumber, 10);
                    if (num >= 1 && num <= getTotal17CluePuzzleCount()) {
                      loadPuzzleByIndex(num - 1); // 0-based index
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
          <button className="action-button" onClick={fillAllCandidates}>
            후보 전부 기입
          </button>
          <button className="action-button" onClick={undo} disabled={state.historyIndex <= 0}>
            Undo
          </button>
          <button 
            className="action-button" 
            onClick={redo} 
            disabled={state.historyIndex >= state.history.length - 1}
          >
            Redo
          </button>
          <button 
            className="action-button" 
            onClick={() => {
              restartPuzzle();
              setPuzzleStartTime(Date.now()); // 다시 풀기 시 시작 시간 리셋
            }}
          >
            다시 풀기
          </button>
          <button 
            className={`action-button ${showAnswer ? 'active' : ''}`}
            onClick={handleShowAnswer}
          >
            {showAnswer ? '해답 숨기기' : '해답 보기'}
          </button>
          <button 
            className="action-button" 
            onClick={generateNewGame}
            disabled={isGenerating}
          >
            {isGenerating ? '생성 중...' : '새 게임'}
          </button>
          <button 
            className="action-button" 
            onClick={() => setShowStats(true)}
          >
            통계
          </button>
        </div>
      </div>

      {showStats && <StatsModal onClose={() => setShowStats(false)} />}

      <div className="game-container">
        {isGenerating ? (
          <div className="generating-message">
            퍼즐을 생성하는 중입니다... (최고 난도는 시간이 걸릴 수 있습니다)
          </div>
        ) : (
          <>
            <div className="game-meta">
              <span className="hint-count">
                힌트: {state.initialGrid.reduce((sum, row) => 
                  sum + row.filter(cell => cell !== 0).length, 0
                )}개
              </span>
              {puzzleStartTime != null && !isSolved(state.currentGrid) && (
                <span className="elapsed-timer">
                  경과: {formatTime(now - puzzleStartTime)}
                </span>
              )}
            </div>
        <SudokuGrid
          initialGrid={state.initialGrid}
          currentGrid={showAnswer && solvedGrid ? solvedGrid : state.currentGrid}
          candidates={state.candidates}
          candidateMode={candidateMode}
          selectedCandidateNum={selectedNumber}
          showAnswer={showAnswer}
          onCellClick={handleCellClick}
          onCellToggleCandidate={toggleCandidate}
        />
          </>
        )}
        
        <NumberPad
          onNumberClick={handleNumberClick}
          onClear={handleClear}
          selectedNumber={selectedNumber}
          candidateMode={candidateMode}
          onToggleMode={() => setCandidateMode(!candidateMode)}
        />
        
        {selectedNumber ? (
          <div className="candidate-mode-hint">
            {candidateMode ? `후보 ${selectedNumber}` : `숫자 ${selectedNumber}`} 선택됨 - 
            {candidateMode ? ' 드래그하여 표시/해제' : ' 셀을 클릭하여 입력'}
          </div>
        ) : null}
      </div>

      {showSolution && (
        <div className="solution-message">
          완성되었습니다!
        </div>
      )}

      <div className="instructions">
        <h3>사용 방법:</h3>
        <ul>
          <li>셀을 클릭한 후 숫자 패드로 숫자를 입력하세요</li>
          <li>후보 모드에서 후보 버튼을 누른 후 클릭&드래그로 후보를 표시/해제할 수 있습니다</li>
          <li>후보 전부 기입 버튼으로 모든 가능한 후보를 자동으로 채울 수 있습니다</li>
          <li>Undo/Redo로 이전 상태로 돌아갈 수 있습니다</li>
        </ul>
      </div>
    </div>
  );
}

export default App;
