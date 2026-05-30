import type { Timestamp } from "firebase/firestore";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDueAt(dueAt: Timestamp) {
  return dateFormatter.format(dueAt.toDate());
}

export function getRemainingLabel(dueAt: Timestamp) {
  const remaining = dueAt.toMillis() - Date.now();
  const days = Math.ceil(remaining / (1000 * 60 * 60 * 24));

  if (days < 0) return "기한 지남";
  if (days === 0) return "오늘 마감";
  return `${days}일 남음`;
}
