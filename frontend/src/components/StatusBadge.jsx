const STATUS_LABELS = {
  approved: "Menunggu Deploy",
  in_progress: "Sedang Berjalan",
  completed: "Success",
  completed_with_notes: "Success With Notes",
  rolled_back: "Rollback",
  // step-level statuses
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
  skipped: "Skipped",
};

export default function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  return <span className={`status-${status}`}>{label}</span>;
}
