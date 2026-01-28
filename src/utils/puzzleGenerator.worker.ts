// Web Worker에서 퍼즐 생성

import { Grid, Difficulty, generatePuzzle, countHints } from './sudoku';

self.onmessage = function(e: MessageEvent<{ difficulty: Difficulty }>) {
  const { difficulty } = e.data;
  
  try {
    // 퍼즐 생성
    const puzzle = generatePuzzle(difficulty);
    const hintCount = countHints(puzzle);
    
    self.postMessage({
      success: true,
      puzzle,
      hintCount,
      difficulty,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
