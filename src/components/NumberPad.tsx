import React from 'react';
import './NumberPad.css';

interface NumberPadProps {
  onNumberClick: (num: number) => void;
  onClear: () => void;
  selectedNumber: number | null;
  candidateMode: boolean;
  onToggleMode: () => void;
  onFillAllCandidates?: () => void;
  disabledNumbers?: Set<number>;
}

export const NumberPad: React.FC<NumberPadProps> = ({ 
  onNumberClick, 
  onClear, 
  selectedNumber,
  candidateMode,
  onToggleMode,
  onFillAllCandidates,
  disabledNumbers = new Set(),
}) => {
  return (
    <div className="number-pad">
      <div className="number-pad-row">
        <button
          className={`mode-toggle-button ${candidateMode ? 'active' : ''}`}
          onClick={onToggleMode}
          title={candidateMode ? '후보 모드' : '숫자 모드'}
        >
          {candidateMode ? '후보' : '숫자'}
        </button>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <button
            key={num}
            className={`number-button ${selectedNumber === num ? 'selected' : ''} ${disabledNumbers.has(num) ? 'disabled' : ''}`}
            onClick={() => !disabledNumbers.has(num) && onNumberClick(num)}
            disabled={disabledNumbers.has(num)}
          >
            {num}
          </button>
        ))}
        {onFillAllCandidates && (
          <button
            type="button"
            className="number-button fill-all-button"
            onClick={onFillAllCandidates}
            title="후보 전부 기입"
          >
            전부
          </button>
        )}
      </div>
      <div className="number-pad-row">
        <button className="number-button clear-button" onClick={onClear}>
          지우기
        </button>
      </div>
    </div>
  );
};
