// 퍼즐 캐시 관리

import { Grid, Difficulty } from './sudoku';
import { getKnown17CluePuzzles } from './knownPuzzles';

const CACHE_KEY_PREFIX = 'sudoku17_puzzle_cache_';
const MAX_CACHE_SIZE = 50; // 난도별 최대 캐시 크기

// 초기 캐시에 알려진 17개 힌트 퍼즐들 추가
export function initializeCache(): void {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}expert`;
    const existing = localStorage.getItem(cacheKey);
    
    // 이미 캐시가 있으면 초기화하지 않음
    if (existing) {
      const puzzles: Grid[] = JSON.parse(existing);
      if (puzzles.length > 0) return;
    }
    
    // 알려진 17개 힌트 퍼즐들을 캐시에 추가
    const knownPuzzles = getKnown17CluePuzzles();
    if (knownPuzzles.length > 0) {
      localStorage.setItem(cacheKey, JSON.stringify(knownPuzzles));
      console.log(`${knownPuzzles.length}개의 알려진 17개 힌트 퍼즐을 캐시에 추가했습니다.`);
    }
  } catch (error) {
    console.error('캐시 초기화 오류:', error);
  }
}

// 캐시에서 퍼즐 가져오기
export function getCachedPuzzle(difficulty: Difficulty): Grid | null {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${difficulty}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const puzzles: Grid[] = JSON.parse(cached);
    if (puzzles.length === 0) return null;
    
    // 랜덤하게 하나 선택
    const randomIndex = Math.floor(Math.random() * puzzles.length);
    return puzzles[randomIndex];
  } catch {
    return null;
  }
}

// 캐시에 퍼즐 저장
export function cachePuzzle(difficulty: Difficulty, puzzle: Grid): void {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${difficulty}`;
    const cached = localStorage.getItem(cacheKey);
    let puzzles: Grid[] = cached ? JSON.parse(cached) : [];
    
    // 중복 확인
    const puzzleStr = JSON.stringify(puzzle);
    const isDuplicate = puzzles.some(p => JSON.stringify(p) === puzzleStr);
    if (isDuplicate) return;
    
    puzzles.push(puzzle);
    
    // 최대 크기 제한
    if (puzzles.length > MAX_CACHE_SIZE) {
      puzzles = puzzles.slice(-MAX_CACHE_SIZE);
    }
    
    localStorage.setItem(cacheKey, JSON.stringify(puzzles));
  } catch {
    // 저장 실패 무시
  }
}

// 캐시 초기화
export function clearCache(difficulty?: Difficulty): void {
  if (difficulty) {
    const cacheKey = `${CACHE_KEY_PREFIX}${difficulty}`;
    localStorage.removeItem(cacheKey);
  } else {
    // 모든 캐시 삭제
    Object.values(['easy', 'medium', 'hard', 'expert'] as Difficulty[]).forEach(diff => {
      const cacheKey = `${CACHE_KEY_PREFIX}${diff}`;
      localStorage.removeItem(cacheKey);
    });
  }
}

// 캐시된 퍼즐 개수 확인
export function getCacheSize(difficulty: Difficulty): number {
  try {
    const cacheKey = `${CACHE_KEY_PREFIX}${difficulty}`;
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return 0;
    const puzzles: Grid[] = JSON.parse(cached);
    return puzzles.length;
  } catch {
    return 0;
  }
}
