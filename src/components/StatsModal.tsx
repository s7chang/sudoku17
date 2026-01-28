import { getPuzzleStats, clearPuzzleProgress } from '../utils/puzzleProgress';
import { getTotal17CluePuzzleCount } from '../utils/knownPuzzles';
import { formatTime } from '../utils/formatTime';
import './StatsModal.css';

interface StatsModalProps {
  onClose: () => void;
}

export function StatsModal({ onClose }: StatsModalProps) {
  const total = getTotal17CluePuzzleCount();
  const stats = getPuzzleStats();

  const handleReset = () => {
    if (!window.confirm('정말 기록을 모두 초기화하시겠습니까?')) return;
    clearPuzzleProgress();
    onClose();
  };

  return (
    <div className="stats-modal-overlay" onClick={onClose}>
      <div className="stats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stats-modal-header">
          <h2>통계</h2>
          <button type="button" className="stats-modal-close" onClick={onClose} aria-label="닫기">
            ×
          </button>
        </div>
        <div className="stats-modal-body">
          <div className="stats-row">
            <span className="stats-label">푼 퍼즐</span>
            <span className="stats-value">
              {stats.completedCount} / {total}개
            </span>
          </div>
          {stats.completedCount > 0 ? (
            <>
              <div className="stats-row">
                <span className="stats-label">가장 빨리 푼 기록</span>
                <span className="stats-value stats-fastest">
                  {formatTime(stats.fastest!)}
                </span>
              </div>
              <div className="stats-row">
                <span className="stats-label">가장 늦게 푼 기록</span>
                <span className="stats-value stats-slowest">
                  {formatTime(stats.slowest!)}
                </span>
              </div>
              <div className="stats-row">
                <span className="stats-label">평균 시간</span>
                <span className="stats-value">{formatTime(stats.average!)}</span>
              </div>
            </>
          ) : (
            <p className="stats-empty">아직 푼 퍼즐이 없습니다.</p>
          )}
        </div>
        <div className="stats-modal-footer">
          <button type="button" className="stats-reset-button" onClick={handleReset}>
            기록 초기화
          </button>
        </div>
      </div>
    </div>
  );
}
