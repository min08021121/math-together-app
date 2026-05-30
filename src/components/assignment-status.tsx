import type { AssignmentStatus } from "@/types";

export function AssignmentStatusBadge({
  status,
}: {
  status: AssignmentStatus;
}) {
  const completed = status === "completed";

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-bold ${
        completed
          ? "bg-emerald-50 text-emerald-700"
          : "bg-amber-50 text-amber-700"
      }`}
    >
      {completed ? "완료" : "진행 중"}
    </span>
  );
}
