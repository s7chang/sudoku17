export function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const m = minutes % 60;
  const s = seconds % 60;
  if (hours > 0) return `${hours}시간 ${m}분 ${s}초`;
  if (minutes > 0) return `${minutes}분 ${s}초`;
  return `${s}초`;
}
