import TimeRecordDetails from "../TimeRecordDetails/TimeRecordDetails";
import { formatDuration, formatTimeIT } from "../../utils/dateUtils";

export default function RecordBreakSummary({ record }) {
  const breaks = record.breaks || [];
  if (!breaks.length) return <TimeRecordDetails record={record} />;
  return (
    <>
    <TimeRecordDetails record={record} />
    <details className="admin-break-summary">
      <summary>{breaks.length} {breaks.length === 1 ? "pausa" : "pause"} · {formatDuration(record.breakSec || 0)} concluse</summary>
      <ul>
        {breaks.map((pause, index) => (
          <li key={index}>
            {formatTimeIT(pause.startAt)} – {pause.endAt ? formatTimeIT(pause.endAt) : "In corso"}
          </li>
        ))}
      </ul>
    </details>
    </>
  );
}
