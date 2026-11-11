import { formatDateTimeIT } from "../../utils/dateUtils";
import "./TimeRecordDetails.css";
export default function TimeRecordDetails({ record }) {
  const history = record.adminEditHistory || [];
  return (
    <div className="time-record-details">
      {record.clockInMode === "offsite" && <p>Entrata fuori sede: <strong>{record.clockInOffsiteReason || "Motivazione non disponibile"}</strong></p>}
      {record.clockOutMode === "offsite" && <p>Uscita fuori sede: <strong>{record.clockOutOffsiteReason || "Motivazione non disponibile"}</strong></p>}
      {history.length > 0 && (
        <details>
          <summary>Correzioni Admin ({history.length})</summary>
          <ol>{history.map((edit, index) => (
            <li key={index}>
              <strong>{formatDateTimeIT(edit.editedAt)} · {edit.editedBy?.username || "Admin"}</strong>
              <p>Prima: {formatDateTimeIT(edit.previousClockIn)} → {formatDateTimeIT(edit.previousClockOut)}</p>
              <p>Dopo: {formatDateTimeIT(edit.newClockIn)} → {formatDateTimeIT(edit.newClockOut)}</p>
              <p>Motivazione: {edit.reason}</p>
            </li>
          ))}</ol>
        </details>
      )}
    </div>
  );
}
