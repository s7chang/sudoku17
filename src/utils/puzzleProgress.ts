// 17개 힌트 퍼즐 완료 기록 관리

import { Grid } from './sudoku';
import { gridToString } from './gridUtils';

const PROGRESS_STORAGE_KEY = 'sudoku17_puzzle_progress';

interface PuzzleTimeRecord {
  puzzleString: string;
  puzzleIndex?: number;
  completionTime: number; // 완료 소요 시간 (밀리초)
  completedAt: number; // 완료 시각 (타임스탬프)
}

interface PuzzleProgress {
  completedPuzzleStrings: Set<string>; // 완료한 퍼즐의 문자열 표현
  completedPuzzleIndices: Set<number>; // 완료한 퍼즐의 인덱스 (인덱스 기반 퍼즐만)
  timeRecords: PuzzleTimeRecord[]; // 시간 기록
}

// 완료 기록 로드
function loadPuzzleProgress(): PuzzleProgress {
  try {
    const stored = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!stored) {
      return {
        completedPuzzleStrings: new Set<string>(),
        completedPuzzleIndices: new Set<number>(),
        timeRecords: [],
      };
    }
    
    const parsed = JSON.parse(stored) as {
      completedPuzzleStrings?: string[];
      completedPuzzleIndices?: number[];
      timeRecords?: PuzzleTimeRecord[];
    };
    
    return {
      completedPuzzleStrings: new Set<string>(parsed.completedPuzzleStrings || []),
      completedPuzzleIndices: new Set<number>(parsed.completedPuzzleIndices || []),
      timeRecords: parsed.timeRecords || [],
    };
  } catch {
    return {
      completedPuzzleStrings: new Set<string>(),
      completedPuzzleIndices: new Set<number>(),
      timeRecords: [],
    };
  }
}

// 완료 기록 저장
function savePuzzleProgress(progress: PuzzleProgress): void {
  try {
    const toStore = {
      completedPuzzleStrings: Array.from(progress.completedPuzzleStrings),
      completedPuzzleIndices: Array.from(progress.completedPuzzleIndices),
      timeRecords: progress.timeRecords,
    };
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // 저장 실패 무시
  }
}

// 퍼즐 완료 처리 (그리드와 선택적 인덱스, 소요 시간)
export function markPuzzleAsCompleted(puzzle: Grid, puzzleIndex: number | undefined, completionTime: number): void {
  const progress = loadPuzzleProgress();
  const puzzleString = gridToString(puzzle);
  progress.completedPuzzleStrings.add(puzzleString);
  
  if (puzzleIndex !== undefined && puzzleIndex !== null) {
    progress.completedPuzzleIndices.add(puzzleIndex);
  }
  
  // 시간 기록 추가 (기존 기록이 있으면 업데이트, 없으면 추가)
  const existingRecordIndex = progress.timeRecords.findIndex(
    r => r.puzzleString === puzzleString
  );
  
  const timeRecord: PuzzleTimeRecord = {
    puzzleString,
    puzzleIndex: puzzleIndex !== undefined && puzzleIndex !== null ? puzzleIndex : undefined,
    completionTime,
    completedAt: Date.now(),
  };
  
  if (existingRecordIndex >= 0) {
    // 기존 기록이 있으면 더 빠른 시간으로 업데이트
    if (completionTime < progress.timeRecords[existingRecordIndex].completionTime) {
      progress.timeRecords[existingRecordIndex] = timeRecord;
    }
  } else {
    progress.timeRecords.push(timeRecord);
  }
  
  savePuzzleProgress(progress);
}

// 퍼즐의 완료 시간 가져오기 (밀리초)
export function getPuzzleCompletionTime(puzzle: Grid): number | null {
  const progress = loadPuzzleProgress();
  const puzzleString = gridToString(puzzle);
  const record = progress.timeRecords.find(r => r.puzzleString === puzzleString);
  return record ? record.completionTime : null;
}

// 퍼즐의 완료 시간 가져오기 (인덱스로)
export function getPuzzleCompletionTimeByIndex(puzzleIndex: number): number | null {
  const progress = loadPuzzleProgress();
  const record = progress.timeRecords.find(r => r.puzzleIndex === puzzleIndex);
  return record ? record.completionTime : null;
}

// 퍼즐 완료 여부 확인 (그리드로)
export function isPuzzleCompletedByGrid(puzzle: Grid): boolean {
  const progress = loadPuzzleProgress();
  const puzzleString = gridToString(puzzle);
  return progress.completedPuzzleStrings.has(puzzleString);
}

// 퍼즐 완료 여부 확인 (인덱스로)
export function isPuzzleCompletedByIndex(puzzleIndex: number): boolean {
  const progress = loadPuzzleProgress();
  return progress.completedPuzzleIndices.has(puzzleIndex);
}

// 완료한 퍼즐 개수 (고유 퍼즐 개수)
export function getCompletedPuzzleCount(): number {
  const progress = loadPuzzleProgress();
  return progress.completedPuzzleStrings.size;
}

// 완료한 퍼즐 목록 가져오기 (문자열 배열)
export function getCompletedPuzzleStrings(): string[] {
  const progress = loadPuzzleProgress();
  return Array.from(progress.completedPuzzleStrings);
}

// 통계: 풀은 개수, 가장 빠른/늦은/평균 시간 (밀리초)
export function getPuzzleStats(): {
  completedCount: number;
  fastest: number | null;
  slowest: number | null;
  average: number | null;
} {
  const progress = loadPuzzleProgress();
  const times = progress.timeRecords.map((r) => r.completionTime);
  if (times.length === 0) {
    return { completedCount: 0, fastest: null, slowest: null, average: null };
  }
  const sum = times.reduce((a, b) => a + b, 0);
  return {
    completedCount: times.length,
    fastest: Math.min(...times),
    slowest: Math.max(...times),
    average: Math.round(sum / times.length),
  };
}

// 모든 완료 기록 초기화
export function clearPuzzleProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_STORAGE_KEY);
  } catch {
    // 삭제 실패 무시
  }
}
