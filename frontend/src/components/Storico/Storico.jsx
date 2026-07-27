import "./Storico.css";
import { useContext, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import { AuthContext } from "../../context/auth-context";
import { authFetch } from "../../utils/authFetch";
import {
  formatDateIT,
  formatDateTimeIT,
  formatDayLabelIT,
  formatDuration,
  getRomeMonthRange,
  toRomeYMD,
} from "../../utils/dateUtils";

const isCancelledRecord = (record) => {
  return String(record?.status || "").toLowerCase() === "cancelled";
};

const getRecordDurationSec = (record) => {
  if (isCancelledRecord(record)) return 0;
  return Number(record?.durationSec) || 0;
};

const getRecordStatusLabel = (record) => {
  if (isCancelledRecord(record)) return "Annullata";
  if (record?.clockOut) return "Chiusa";
  if (record?.clockIn) return "Aperta";
  return "-";
};

export default function Storico() {
  // Dati utente loggato e funzione gestione sessione dal context globale
  const { user, handleSessionExpired } = useContext(AuthContext);

  // Hook usato per navigare tra le pagine
  const navigate = useNavigate();

  // URL base del backend letto dalle variabili ambiente
  const BASE_URL = import.meta.env.VITE_API_URL;

  // =========================
  // STATI PRINCIPALI
  // =========================

  // Giorno selezionato nel calendario
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Mese attualmente visibile nel calendario
  const [activeMonth, setActiveMonth] = useState(new Date());

  // Tutti i record del mese visualizzato nel calendario
  const [monthRecords, setMonthRecords] = useState([]);

  // Tutte le leave del mese visualizzato nel calendario
  const [monthLeaves, setMonthLeaves] = useState([]);

  // Record del giorno selezionato
  const [dayRecords, setDayRecords] = useState([]);

  // Leave del giorno selezionato
  const [dayLeaves, setDayLeaves] = useState([]);

  // Modalità di visualizzazione:
  // - "day"   => mostro il giorno selezionato
  // - "range" => mostro la ricerca per intervallo
  const [mode, setMode] = useState("day");

  // Date del filtro intervallo
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Record restituiti dalla ricerca per intervallo
  const [rangeRecords, setRangeRecords] = useState([]);

  // Leave restituite dalla ricerca per intervallo
  const [rangeLeaves, setRangeLeaves] = useState([]);

  // Stato di caricamento generale
  const [loading, setLoading] = useState(false);

  // Messaggio mostrato nella UI
  const [uiMsg, setUiMsg] = useState(null);

  // =========================
  // HELPERS
  // =========================

  // Crea una chiave giorno in formato YYYY-MM-DD coerente con Europe/Rome.
  const toDayKeyLocal = (value) => {
    if (!value) return "";
    return toRomeYMD(value);
  };

  // Escapa i valori CSV quando contengono virgolette o virgole
  const csvEscape = (value) => {
    const str = String(value ?? "");
    return `"${str.replace(/"/g, '""')}"`;
  };

  // Testo leggibile per il tipo leave
  const getLeaveTypeLabel = (type) => {
    if (type === "mutua") return "Mutua";
    if (type === "ferie") return "Ferie";
    if (type === "pir") return "PIR";
    return type || "Assenza";
  };

  // Testo leggibile per lo status leave
  const getLeaveStatusLabel = (status) => {
    if (status === "approved") return "approvata";
    if (status === "pending") return "in attesa";
    if (status === "rejected") return "rifiutata";
    if (status === "cancelled") return "annullata";
    return status || "-";
  };

  // =========================
  // DATI DERIVATI
  // =========================

  // Giorni del mese che hanno almeno una timbratura
  const daysWithRecords = useMemo(() => {
    const set = new Set();

    monthRecords.forEach((record) => {
      if (record.clockIn) {
        set.add(toDayKeyLocal(record.clockIn));
      }
    });

    return set;
  }, [monthRecords]);

  // Giorni del mese che hanno almeno una leave
  const daysWithLeaves = useMemo(() => {
    const set = new Set();

    monthLeaves.forEach((leave) => {
      if (leave.date) {
        set.add(toDayKeyLocal(leave.date));
      }
    });

    return set;
  }, [monthLeaves]);

  // In base alla modalità attiva, decido quali record mostrare a schermo
  const recordsToShow = mode === "range" ? rangeRecords : dayRecords;

  // In base alla modalità attiva, decido quali leave mostrare a schermo
  const leavesToShow = mode === "range" ? rangeLeaves : dayLeaves;

  // Totale secondi della vista corrente riferito solo alle timbrature
  const totalSec = useMemo(() => {
    return recordsToShow.reduce((sum, record) => {
      return sum + getRecordDurationSec(record);
    }, 0);
  }, [recordsToShow]);

  // Classe CSS del messaggio utente
  const msgClass =
    uiMsg?.type === "error"
      ? "msg msg-error"
      : uiMsg?.type
      ? "msg msg-ok"
      : "msg";

  // =========================
  // CARICAMENTO DATI DEL MESE VISIBILE
  // =========================

  // Ogni volta che cambia il mese visibile nel calendario,
  // carico dal backend sia i record sia le leave del mese.
  useEffect(() => {
    const loadMonthData = async () => {
      if (!user) return;

      setLoading(true);
      setUiMsg(null);

      try {
        const { from, to } = getRomeMonthRange(activeMonth);

        const [recordsRes, leavesRes] = await Promise.all([
          authFetch(
            `${BASE_URL}/api/records/my?from=${from}&to=${to}`,
            {},
            { handleSessionExpired, navigate }
          ),
          authFetch(
            `${BASE_URL}/api/leaves/my?from=${from}&to=${to}`,
            {},
            { handleSessionExpired, navigate }
          ),
        ]);

        if (!recordsRes || !leavesRes) return;

        const recordsData = await recordsRes.json().catch(() => ({}));
        const leavesData = await leavesRes.json().catch(() => ({}));

        if (!recordsRes.ok) {
          console.error("Errore caricamento records mese:", recordsData);
          setMonthRecords([]);
          setUiMsg({
            type: "error",
            text:
              recordsData?.message ||
              "Errore nel caricamento delle timbrature del mese.",
          });
          return;
        }

        if (!leavesRes.ok) {
          console.error("Errore caricamento leave mese:", leavesData);
          setMonthLeaves([]);
          setUiMsg({
            type: "error",
            text:
              leavesData?.message ||
              "Errore nel caricamento delle assenze del mese.",
          });
          return;
        }

        const records = Array.isArray(recordsData.records)
          ? recordsData.records
          : [];
        const leaves = Array.isArray(leavesData.leaves)
          ? leavesData.leaves
          : [];

        setMonthRecords(records);
        setMonthLeaves(leaves);
      } catch (err) {
        console.error("Errore loadMonthData:", err);
        setMonthRecords([]);
        setMonthLeaves([]);
        setUiMsg({
          type: "error",
          text: "Errore di rete o backend non raggiungibile.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadMonthData();
  }, [activeMonth, user, BASE_URL, handleSessionExpired, navigate]);

  // =========================
  // FILTRO LOCALE DEL GIORNO SELEZIONATO
  // =========================

  // Quando cambia il giorno selezionato oppure cambiano i dati del mese,
  // filtro localmente i record e le leave per il giorno cliccato.
  useEffect(() => {
    const selectedKey = toDayKeyLocal(selectedDate);

    const filteredRecords = monthRecords.filter((record) => {
      return record.clockIn && toDayKeyLocal(record.clockIn) === selectedKey;
    });

    const filteredLeaves = monthLeaves.filter((leave) => {
      return leave.date && toDayKeyLocal(leave.date) === selectedKey;
    });

    setDayRecords(filteredRecords);
    setDayLeaves(filteredLeaves);
  }, [selectedDate, monthRecords, monthLeaves]);

  // =========================
  // AZIONI
  // =========================

  // Ricerca per intervallo date.
  // Chiama il backend sia per i record sia per le leave.
  const handleSearchRange = async () => {
    if (!user) return;

    setUiMsg(null);

    if (!fromDate || !toDate) {
      setUiMsg({
        type: "error",
        text: "Inserisci sia la data iniziale sia la data finale.",
      });
      return;
    }

    if (fromDate > toDate) {
      setUiMsg({
        type: "error",
        text: "La data iniziale non può essere successiva a quella finale.",
      });
      return;
    }

    setLoading(true);

    try {
      const [recordsRes, leavesRes] = await Promise.all([
        authFetch(
          `${BASE_URL}/api/records/my?from=${fromDate}&to=${toDate}`,
          {},
          { handleSessionExpired, navigate }
        ),
        authFetch(
          `${BASE_URL}/api/leaves/my?from=${fromDate}&to=${toDate}`,
          {},
          { handleSessionExpired, navigate }
        ),
      ]);

      if (!recordsRes || !leavesRes) return;

      const recordsData = await recordsRes.json().catch(() => ({}));
      const leavesData = await leavesRes.json().catch(() => ({}));

      if (!recordsRes.ok) {
        console.error("Errore ricerca range records:", recordsData);
        setRangeRecords([]);
        setUiMsg({
          type: "error",
          text:
            recordsData?.message ||
            "Errore nella ricerca timbrature per intervallo.",
        });
        return;
      }

      if (!leavesRes.ok) {
        console.error("Errore ricerca range leaves:", leavesData);
        setRangeLeaves([]);
        setUiMsg({
          type: "error",
          text:
            leavesData?.message ||
            "Errore nella ricerca assenze per intervallo.",
        });
        return;
      }

      const records = Array.isArray(recordsData.records)
        ? recordsData.records
        : [];
      const leaves = Array.isArray(leavesData.leaves)
        ? leavesData.leaves
        : [];

      setRangeRecords(records);
      setRangeLeaves(leaves);
      setMode("range");
    } catch (err) {
      console.error("Errore handleSearchRange:", err);
      setRangeRecords([]);
      setRangeLeaves([]);
      setUiMsg({
        type: "error",
        text: "Errore di rete o backend non raggiungibile.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Torna alla vista giornaliera senza toccare il giorno selezionato
  const handleBackToDay = () => {
    setMode("day");
    setUiMsg(null);
  };

  // Esporta in CSV una lista di record passata come argomento
  const downloadCsv = (filename, records) => {
    if (!records || records.length === 0) {
      setUiMsg({
        type: "error",
        text: "Nessun dato da esportare.",
      });
      return;
    }

    const header = [
      "Entrata",
      "Uscita",
      "Stato",
      "Durata secondi",
      "Durata HH:MM:SS",
      "Motivo annullamento",
    ];

    const rows = records.map((record) => {
      const durationSec = getRecordDurationSec(record);

      return [
        record.clockIn ? formatDateTimeIT(record.clockIn) : "",
        record.clockOut ? formatDateTimeIT(record.clockOut) : "",
        getRecordStatusLabel(record),
        durationSec,
        formatDuration(durationSec),
        record?.cancellation?.cancelReason || "",
      ];
    });

    const csvContent = [
      header.map(csvEscape).join(","),
      ...rows.map((row) => row.map(csvEscape).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = filename;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  // Esporta tutti i record del mese attualmente visibile nel calendario
  const handleExportMonthCsv = () => {
    const { from } = getRomeMonthRange(activeMonth);
    downloadCsv(`storico-mese-${from.slice(0, 7)}.csv`, monthRecords);
  };

  // Esporta i record della vista corrente
  const handleExportCurrentCsv = () => {
    if (mode === "range") {
      downloadCsv(
        `storico-range-${fromDate || "from"}_${toDate || "to"}.csv`,
        rangeRecords
      );
      return;
    }

    const day = toRomeYMD(selectedDate);
    downloadCsv(`storico-giorno-${day}.csv`, dayRecords);
  };

  // Se l'utente non è disponibile, non renderizzo nulla.
  if (!user) return null;

  return (
    <div className="storico-container">
      <div className="storico-box">
        <h2 className="storico-title">Storico timbrature</h2>

        <p>
          Utente: <strong>{user.username}</strong>
        </p>

        {uiMsg?.text && <p className={msgClass}>{uiMsg.text}</p>}

        <div className="storico-calendar-wrap">
          <Calendar
            onChange={(date) => {
              setSelectedDate(date);
              setMode("day");
              setUiMsg(null);
            }}
            value={selectedDate}
            locale="it-IT"
            onActiveStartDateChange={({ activeStartDate }) => {
              if (activeStartDate) setActiveMonth(activeStartDate);
            }}
            tileClassName={({ date, view }) => {
              if (view !== "month") return null;

              const dayKey = toDayKeyLocal(date);
              const hasRecord = daysWithRecords.has(dayKey);
              const hasLeave = daysWithLeaves.has(dayKey);

              if (hasRecord && hasLeave) return "has-record has-leave";
              if (hasRecord) return "has-record";
              if (hasLeave) return "has-leave";

              return null;
            }}
          />
        </div>

        <div className="storico-rangebar">
          <div>
            <label htmlFor="fromDate">Dal:</label>
            <input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="toDate">Al:</label>
            <input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            onClick={handleSearchRange}
            className="btn-primary"
            disabled={loading}
          >
            Cerca
          </button>

          <button
            onClick={handleExportMonthCsv}
            className="btn-secondary"
            disabled={loading || monthRecords.length === 0}
          >
            CSV mese
          </button>

          <button
            onClick={handleExportCurrentCsv}
            className="btn-secondary"
            disabled={loading || recordsToShow.length === 0}
          >
            CSV corrente
          </button>

          <button
            onClick={handleBackToDay}
            className="btn-danger"
            disabled={loading || mode === "day"}
          >
            Torna al giorno
          </button>

          <button
            onClick={() => navigate("/home-user")}
            className="btn-danger"
            disabled={loading}
          >
            Torna alla Home
          </button>
        </div>

        {loading && <p>Caricamento...</p>}

        <div className="storico-results">
          <h3>
            {mode === "range"
              ? `Intervallo: ${fromDate || "-"} → ${toDate || "-"}`
              : `Giorno selezionato: ${formatDayLabelIT(selectedDate)}`}
          </h3>

          <p>
            Totale vista corrente: <strong>{formatDuration(totalSec)}</strong>
          </p>

          {recordsToShow.length === 0 && leavesToShow.length === 0 ? (
            <p>Nessuna timbratura o assenza trovata.</p>
          ) : (
            <div className="storico-records-list">
              {leavesToShow.map((leave) => (
                <div key={leave._id} className="storico-record-card">
                  <p>
                    Assenza:{" "}
                    <strong>{getLeaveTypeLabel(leave.type)}</strong>
                  </p>

                  <p>
                    Stato:{" "}
                    <strong>{getLeaveStatusLabel(leave.status)}</strong>
                  </p>

                  <p>
                    Data: <strong>{formatDateIT(leave.date)}</strong>
                  </p>

                  {leave.note && (
                    <p>
                      Nota: <strong>{leave.note}</strong>
                    </p>
                  )}
                </div>
              ))}

              {recordsToShow.map((record) => {
                const isCancelled = isCancelledRecord(record);
                const durationSec = getRecordDurationSec(record);

                return (
                  <div
                    key={record._id}
                    className={`storico-record-card ${
                      isCancelled ? "storico-record-cancelled" : ""
                    }`}
                  >
                    <p>
                      Stato: <strong>{getRecordStatusLabel(record)}</strong>
                    </p>

                    <p>
                      Entrata: <strong>{formatDateTimeIT(record.clockIn)}</strong>
                    </p>

                    <p>
                      Uscita:{" "}
                      <strong>
                        {record.clockOut ? formatDateTimeIT(record.clockOut) : "-"}
                      </strong>
                    </p>

                    <p>
                      Durata: <strong>{formatDuration(durationSec)}</strong>
                    </p>

                    {isCancelled && (
                      <p>
                        Nota:{" "}
                        <strong>
                          Timbratura annullata dall’amministratore
                          {record?.cancellation?.cancelReason
                            ? `: ${record.cancellation.cancelReason}`
                            : "."}
                        </strong>
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
