import CollapsibleSection from "../CollapsibleSection/CollapsibleSection";
import { useCallback, useEffect, useRef, useState } from "react";
import { authFetch } from "../../utils/authFetch";
import { formatTimeIT, formatDateIT, toRomeYMD } from "../../utils/dateUtils";
import "./AdminDailyAttendance.css";

const categories = [
  { key: "entered", name: "Entrati" },
  { key: "missing", name: "Non entrati" },
  { key: "absent", name: "Assenti" },
];
const leaveNames = { mutua: "Mutua", ferie: "Ferie", pir: "PIR giornaliero" };

export default function AdminDailyAttendance({ baseUrl, handleSessionExpired, navigate }) {
  const [date, setDate] = useState(() => toRomeYMD(new Date()));
  const requestId = useRef(0);
  const [selected, setSelected] = useState("missing");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const currentId = ++requestId.current;
    setLoading(true);
    setData(null);
    setError("");
    try {
      const response = await authFetch(`${baseUrl}/api/admin/daily-attendance?date=${encodeURIComponent(date)}`, {}, { handleSessionExpired, navigate });
      if (!response || currentId !== requestId.current) return;
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Impossibile caricare le presenze.");
      if (currentId === requestId.current) setData(result);
    } catch (err) {
      if (currentId === requestId.current) setError(err.message || "Impossibile caricare le presenze.");
    } finally {
      if (currentId === requestId.current) setLoading(false);
    }
  }, [baseUrl, date, handleSessionExpired, navigate]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 60_000);
    const pending = requestId;
    return () => { clearInterval(timer); pending.current++; };
  }, [refresh]);

  const count = data?.counts?.missing;
  const items = Array.isArray(data?.[selected]) ? data[selected] : [];
  const labelFor = (person) => person.fullName?.trim() || person.username;

  return (
    <CollapsibleSection title="Presenze giornaliere" sectionId="daily-attendance" className="homeadmin-card homeadmin-daily-card" badge={
      <span className={`homeadmin-daily-header-count${data?.isToday && data?.checkReached && count > 0 ? " is-missing" : ""}`} aria-live="polite" title={data ? `${count} non entrati` : "Dati in caricamento"}>{data ? `${count} non entrati` : "…"}</span>
    }>
      <p className="homeadmin-muted-text">Controllo entrate ore 09:00 · {formatDateIT(data?.date || date)}</p>
        <label htmlFor="attendance-date">Data delle presenze (Europe/Rome)</label>
        <input id="attendance-date" type="date" required value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} />
        {data?.isToday && !data?.checkReached && <p className="homeadmin-muted-text">Prima delle 09:00: situazione provvisoria, non ancora un ritardo.</p>}
        {data?.isToday && data?.checkReached && <p className="homeadmin-muted-text">Situazione attuale dopo le 09:00; non equivale all'elenco storico dei ritardi.</p>}
        {data && !data.isToday && <p className="homeadmin-muted-text">Situazione della data selezionata; non equivale a un elenco dei ritardi.</p>}
        <button type="button" className="homeadmin-btn homeadmin-btn-secondary" onClick={refresh} disabled={loading}>
          {loading ? "Aggiornamento..." : "Aggiorna presenze"}
        </button>
        {error && <p className="homeadmin-alert error" role="alert">{error}</p>}
        {data && (
          <>
            <div className="homeadmin-daily-grid">
              {categories.map(({ key, name }) => (
                <div className={`homeadmin-daily-tile homeadmin-daily-tile--${key}`} key={key}>
                  <strong>{data.counts[key]}</strong>
                  <span>{name}</span>
                  <button type="button" className="homeadmin-btn homeadmin-btn-secondary homeadmin-btn-sm"
                    aria-pressed={selected === key} onClick={() => setSelected((current) => current === key ? "" : key)}>
                    {selected === key ? "Nascondi" : "Visualizza"}
                  </button>
                </div>
              ))}
            </div>
            {selected && (
              <div className="homeadmin-daily-list" aria-live="polite">
                <h3>{categories.find((category) => category.key === selected)?.name}</h3>
                {items.length === 0 ? <p className="homeadmin-muted-text">Nessun dipendente in questa categoria.</p> : (
                  <ul>{items.map((person) => (
                    <li key={person.userId}>
                      <span>{labelFor(person)}</span>
                      <small>{selected === "entered" ? formatTimeIT(person.firstClockIn) : selected === "absent" ? leaveNames[person.type] || "Assenza" : "Nessuna entrata"}</small>
                    </li>
                  ))}</ul>
                )}
              </div>
            )}
          </>
        )}
    </CollapsibleSection>
  );
}