import React from 'react';
import './SudokuCell.css';

interface SudokuCellProps {
  value: number;
  candidates: boolean[];
  isInitial: boolean;
  isUserInput: boolean;
  isSelected: boolean;
  selectedCandidateNum: number | null;
  hasSelectedCandidate: boolean;
  showAnswer: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseDown?: () => void;
}

export const SudokuCell: React.FC<SudokuCellProps> = ({
  value,
  candidates,
  isInitial,
  isUserInput,
  isSelected,
  selectedCandidateNum,
  hasSelectedCandidate,
  showAnswer,
  onClick,
  onMouseEnter,
  onMouseDown,
}) => {
  return (
    <div
      className={`sudoku-cell ${isInitial ? 'initial' : ''} ${isSelected ? 'selected' : ''} ${hasSelectedCandidate ? 'has-selected-candidate' : ''}`}
      onClick={isInitial ? undefined : onClick}
      onMouseEnter={isInitial ? undefined : onMouseEnter}
      onMouseDown={isInitial ? undefined : onMouseDown}
      style={isInitial ? { cursor: 'default' } : undefined}
    >
      {value !== 0 ? (
        <div className={`cell-value ${isInitial ? 'initial-value' : isUserInput ? 'user-input' : showAnswer ? 'answer-value' : ''} ${selectedCandidateNum === value ? 'highlighted-number' : ''}`}>
          {value}
        </div>
      ) : (
        <div className="cell-candidates">
          {candidates.map((show, idx) => {
            const num = idx + 1;
            const isHighlighted = selectedCandidateNum === num && show;
            return (
              <span
                key={idx}
                className={`candidate ${show ? 'visible' : ''} ${isHighlighted ? 'highlighted' : ''}`}
              >
                {show ? num : ''}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
