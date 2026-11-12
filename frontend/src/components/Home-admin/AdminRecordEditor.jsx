import { useId, useState } from "react";
import { authFetch } from "../../utils/authFetch";
import { toRomeInputDateTime } from "../../utils/dateUtils";
import "./AdminRecordEditor.css";
export default function AdminRecordEditor({ record, baseUrl, handleSessionExpired, navigate, onSaved, readOnly = false }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [clockIn, setClockIn] = useState(() => toRomeInputDateTime(record.clockIn));
  const [clockOut, setClockOut] = useState(() => toRomeInputDateTime(record.clockOut));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const res = await authFetch(`${baseUrl}/api/admin/records/${record._id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clockIn, clockOut, reason, expectedClockIn: record.clockIn, expectedClockOut: record.clockOut }),
      }, { handleSessionExpired, navigate });
      if (!res) return;
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Correzione non riuscita");
      setOpen(false); setReason("");
      await onSaved();
    } catch (err) { setError(err.message || "Correzione non riuscita"); }
    finally { setSaving(false); }
  }
  if (readOnly || record.status !== "closed" || !record.clockOut) return null;
  return (
    <div className="admin-record-editor">
      <button type="button" className="homeadmin-btn homeadmin-btn-secondary homeadmin-btn-sm" aria-expanded={open} aria-controls={`${id}-form`} onClick={() => setOpen(value => !value)} disabled={saving}>Correggi {open ? "▲" : "▼"}</button>
      {open && (
        <form id={`${id}-form`} onSubmit={save}>
          <p>Orari Europe/Rome. Le pause registrate devono restare comprese nella sessione.</p>
          <label htmlFor={`${id}-in`}>Entrata corretta</label>
          <input id={`${id}-in`} type="datetime-local" step="1" required value={clockIn} onChange={event => setClockIn(event.target.value)} disabled={saving} />
          <label htmlFor={`${id}-out`}>Uscita corretta</label>
          <input id={`${id}-out`} type="datetime-local" step="1" required value={clockOut} onChange={event => setClockOut(event.target.value)} disabled={saving} />
          <label htmlFor={`${id}-reason`}>Motivazione della correzione</label>
          <textarea id={`${id}-reason`} required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} />
          {error && <p role="alert">{error}</p>}
          <button type="submit" className="homeadmin-btn homeadmin-btn-primary" disabled={saving || !reason.trim()}>{saving ? "Salvataggio..." : "Salva correzione"}</button>
        </form>
      )}
    </div>
  );
}
