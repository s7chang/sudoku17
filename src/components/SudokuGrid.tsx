import React, { useState, useCallback, useRef } from 'react';
import { SudokuCell } from './SudokuCell';
import { Grid, CandidateGrid, canPlace } from '../utils/sudoku';
import './SudokuGrid.css';

interface SudokuGridProps {
  initialGrid: Grid;
  currentGrid: Grid;
  candidates: CandidateGrid;
  candidateMode: boolean;
  selectedCandidateNum: number | null; // 선택된 번호 (후보 모드 또는 숫자 모드)
  selectedCell: [number, number] | null; // 선택된 셀 (부모에서 제어, 새 게임 시 초기화)
  showAnswer?: boolean; // 해답 보기 모드
  onCellClick: (row: number, col: number) => void;
  onCellToggleCandidate: (row: number, col: number, candidateNum: number) => void;
}

export const SudokuGrid: React.FC<SudokuGridProps> = ({
  initialGrid,
  currentGrid,
  candidates,
  candidateMode,
  selectedCandidateNum,
  selectedCell,
  showAnswer = false,
  onCellClick,
  onCellToggleCandidate,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<[number, number] | null>(null);

  const handleCellClick = useCallback((row: number, col: number) => {
    // 초기 힌트 칸은 제외
    if (initialGrid[row][col] !== 0) {
      return;
    }
    
    if (candidateMode) {
      // 후보 모드에서는 클릭만으로는 후보 변경하지 않음 (드래그로 처리)
      return;
    }
    onCellClick(row, col);
  }, [candidateMode, initialGrid, onCellClick]);

  const handleCellMouseDown = useCallback((row: number, col: number) => {
    // 초기 힌트 칸은 제외
    if (initialGrid[row][col] !== 0) {
      return;
    }
    
    if (candidateMode && selectedCandidateNum !== null) {
      setIsDragging(true);
      dragStartRef.current = [row, col];
      // 초기 셀의 선택된 후보 토글
      if (currentGrid[row][col] === 0) {
        onCellToggleCandidate(row, col, selectedCandidateNum);
      }
    }
  }, [candidateMode, selectedCandidateNum, initialGrid, currentGrid, onCellToggleCandidate]);

  const handleCellMouseEnter = useCallback((row: number, col: number) => {
    // 드래그 중일 때만 반응
    if (candidateMode && isDragging && dragStartRef.current && selectedCandidateNum !== null) {
      // 초기 힌트 칸은 제외
      if (initialGrid[row][col] === 0 && currentGrid[row][col] === 0) {
        onCellToggleCandidate(row, col, selectedCandidateNum);
      }
    }
  }, [candidateMode, isDragging, selectedCandidateNum, initialGrid, currentGrid, onCellToggleCandidate]);

  // 마우스 업 시 드래그 종료
  React.useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleMouseUp);
      return () => window.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  return (
    <div className="sudoku-grid">
      {Array.from({ length: 9 }, (_, row) => (
        <div key={row} className="sudoku-row">
          {Array.from({ length: 9 }, (_, col) => {
            const isInitial = initialGrid[row][col] !== 0;
            const value = currentGrid[row][col];
            const cellCandidates = candidates[row][col];
            const isSelected = selectedCell?.[0] === row && selectedCell?.[1] === col;
            // 선택된 번호의 후보가 있는지 확인
            const hasSelectedCandidate = selectedCandidateNum !== null && 
              cellCandidates[selectedCandidateNum - 1] && 
              value === 0;
            // 사용자가 입력한 숫자인지 확인 (초기 힌트가 아니고, 해답 보기 모드가 아닐 때)
            const isUserInput = !isInitial && !showAnswer && value !== 0;

            return (
              <SudokuCell
                key={`${row}-${col}`}
                value={value}
                candidates={cellCandidates}
                isInitial={isInitial}
                isUserInput={isUserInput}
                isSelected={isSelected}
                selectedCandidateNum={selectedCandidateNum}
                hasSelectedCandidate={hasSelectedCandidate}
                showAnswer={showAnswer}
                onClick={() => handleCellClick(row, col)}
                onMouseEnter={() => handleCellMouseEnter(row, col)}
                onMouseDown={() => handleCellMouseDown(row, col)}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
};

