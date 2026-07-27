import "./Home-user.css";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/auth-context";
import { authFetch } from "../../utils/authFetch";
import {
  formatDateIT,
  formatDateTimeIT,
  formatTimeIT,
  toRomeYMD,
} from "../../utils/dateUtils";

const LEAVE_TYPE_OPTIONS = [
  {
    value: "mutua",
    label: "Mutua",
    helperText: "La mutua viene registrata direttamente come approvata.",
  },
  {
    value: "ferie",
    label: "Ferie",
    helperText: "La richiesta ferie resta in attesa di approvazione admin.",
  },
  {
    value: "pir",
    label: "PIR",
    helperText: "La richiesta PIR resta in attesa di approvazione admin.",
  },
];

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getLeaveTypeLabel(leave) {
  const type = String(leave?.type || "").toLowerCase();

  if (type === "mutua") return "Mutua";
  if (type === "ferie") return "Ferie";
  if (type === "pir") return "PIR";

  return "Assenza";
}

function getLeaveStatusLabel(leave) {
  const status = String(leave?.status || "").toLowerCase();

  if (status === "approved") return "Approvata";
  if (status === "pending") return "In attesa";
  if (status === "rejected") return "Rifiutata";
  if (status === "cancelled") return "Annullata";

  return "Sconosciuta";
}

function getLeaveStatusClass(leave) {
  const status = String(leave?.status || "").toLowerCase();

  if (status === "approved") return "leave-status-approved";
  if (status === "pending") return "leave-status-pending";
  if (status === "rejected") return "leave-status-rejected";
  if (status === "cancelled") return "leave-status-cancelled";

  return "leave-status-neutral";
}

function getLeaveNotificationText(leave) {
  const typeLabel = getLeaveTypeLabel(leave).toLowerCase();
  const status = String(leave?.status || "").toLowerCase();

  const formatLeaveDate = (value) => {
    if (!value) return null;

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return null;

    return formatDateIT(date);
  };

  const requestDateLabel = formatLeaveDate(leave?.createdAt);
  const startDateLabel = formatLeaveDate(leave?.startDate || leave?.date);
  const endDateLabel = formatLeaveDate(leave?.endDate);

  const requestDateText = requestDateLabel ? ` del ${requestDateLabel}` : "";

  const requestedPeriodText =
    startDateLabel && endDateLabel && startDateLabel !== endDateLabel
      ? `per il periodo dal ${startDateLabel} al ${endDateLabel}`
      : startDateLabel
        ? `per il giorno ${startDateLabel}`
        : "per il giorno richiesto";

  if (status === "approved") {
    return `Richiesta ${typeLabel}${requestDateText} approvata ${requestedPeriodText}.`;
  }

  if (status === "rejected") {
    return `Richiesta ${typeLabel}${requestDateText} rifiutata ${requestedPeriodText}.`;
  }

  if (status === "pending") {
    return `Richiesta ${typeLabel}${requestDateText} in attesa di approvazione ${requestedPeriodText}.`;
  }

  return `Richiesta ${typeLabel}${requestDateText} ${requestedPeriodText}.`;
}
export default function Home_user() {
  const { logout, user, handleSessionExpired } = useContext(AuthContext);
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_API_URL;
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const logoutTimerRef = useRef(null);

  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [entrata, setEntrata] = useState(null);
  const [uscita, setUscita] = useState(null);

  const [loadingStatus, setLoadingStatus] = useState(true);
  const [isStamping, setIsStamping] = useState(false);
  const [stampingAction, setStampingAction] = useState("");
  const [uiMsg, setUiMsg] = useState(null);

  const [todayLeave, setTodayLeave] = useState(null);
  const [loadingLeaveStatus, setLoadingLeaveStatus] = useState(true);

  const [userLeaves, setUserLeaves] = useState([]);
  const [loadingUserLeaves, setLoadingUserLeaves] = useState(true);

  const [leaveType, setLeaveType] = useState("mutua");
  const [leaveStartDate, setLeaveStartDate] = useState(() =>
    toRomeYMD(new Date())
  );
  const [leaveEndDate, setLeaveEndDate] = useState(() => toRomeYMD(new Date()));
  const [leaveNote, setLeaveNote] = useState("");
  const [leaveRequestLoading, setLeaveRequestLoading] = useState(false);
  const feedbackMessageRef = useRef(null);

  const [openRecord, setOpenRecord] = useState(null);
  const [isOpenRecordFromPreviousDay, setIsOpenRecordFromPreviousDay] =
    useState(false);
  const [canRequestManualClosure, setCanRequestManualClosure] = useState(false);
  const [loadingOpenRecord, setLoadingOpenRecord] = useState(true);

  const [showManualClosureForm, setShowManualClosureForm] = useState(false);
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [manualNote, setManualNote] = useState("");

  const [leaveMinAdvanceDays, setLeaveMinAdvanceDays] = useState(null);

  const hasTodayApprovedLeave = useMemo(() => {
    return String(todayLeave?.status || "").toLowerCase() === "approved";
  }, [todayLeave]);

  const todayLeaveLabel = useMemo(() => {
    if (!todayLeave) return "";

    return `${getLeaveTypeLabel(todayLeave)} ${getLeaveStatusLabel(
      todayLeave
    ).toLowerCase()}`;
  }, [todayLeave]);

  const canClockOut = !!entrata && !uscita;
  const hasCompleteSession = !!entrata && !!uscita;

  const hasBlockingAnomaly = useMemo(() => {
    if (!openRecord) return false;

    return (
      (openRecord.status === "open" && isOpenRecordFromPreviousDay) ||
      (openRecord.status === "pending_manual_closure" &&
        !isOpenRecordFromPreviousDay) ||
      openRecord.status === "manual_closure_rejected"
    );
  }, [openRecord, isOpenRecordFromPreviousDay]);

  const isStampBlocked = hasBlockingAnomaly || hasTodayApprovedLeave;


  const primaryButtonLabel = useMemo(() => {
    if (loadingStatus || loadingOpenRecord || loadingLeaveStatus) {
      return "Caricamento...";
    }

    if (stampingAction === "clockOut") return "Registro uscita...";
    if (stampingAction === "clockIn") return "Registro entrata...";
    if (isStamping) return "Operazione in corso...";
    if (hasTodayApprovedLeave) return "Assenza registrata";
    if (hasBlockingAnomaly) return "Timbratura bloccata";
    if (canClockOut) return "Bollatura Uscita";
    if (hasCompleteSession) return "Nuova Bollatura Entrata";

    return "Bollatura Entrata";
  }, [
    loadingStatus,
    loadingOpenRecord,
    loadingLeaveStatus,
    stampingAction,
    isStamping,
    hasTodayApprovedLeave,
    hasBlockingAnomaly,
    canClockOut,
    hasCompleteSession,
  ]);

  const primaryAction = useMemo(() => {
    if (loadingStatus || loadingOpenRecord || loadingLeaveStatus || isStamping) {
      return "loading";
    }

    if (hasTodayApprovedLeave) return "leave";
    if (hasBlockingAnomaly) return "manual-fix";
    if (canClockOut) return "clock-out";
    if (hasCompleteSession) return "new-clock-in";

    return "clock-in";
  }, [
    loadingStatus,
    loadingOpenRecord,
    loadingLeaveStatus,
    isStamping,
    hasTodayApprovedLeave,
    hasBlockingAnomaly,
    canClockOut,
    hasCompleteSession,
  ]);

  const userContextualHint = useMemo(() => {
    if (loadingStatus || loadingOpenRecord || loadingLeaveStatus) {
      return "Stiamo aggiornando lo stato della giornata: attendi il caricamento prima di effettuare nuove azioni.";
    }

    if (hasTodayApprovedLeave) {
      return "Oggi risulti assente: non è necessario effettuare timbrature.";
    }

    if (hasBlockingAnomaly) {
      return "Hai una timbratura da sistemare: invia una richiesta di chiusura manuale per sbloccare le prossime timbrature.";
    }

    if (canClockOut) {
      return "Ricordati di registrare l’uscita quando termini la giornata lavorativa.";
    }

    if (hasCompleteSession) {
      return "Hai già completato una sessione oggi: apri una nuova entrata solo se necessario.";
    }

    return "Registra l’entrata quando inizi la giornata lavorativa.";
  }, [
    loadingStatus,
    loadingOpenRecord,
    loadingLeaveStatus,
    hasTodayApprovedLeave,
    hasBlockingAnomaly,
    canClockOut,
    hasCompleteSession,
  ]);

  const msgClass = useMemo(() => {
    if (!uiMsg?.type) return "msg";
    if (uiMsg.type === "error") return "msg msg-error";
    if (uiMsg.type === "warning") return "msg msg-warning";
    return "msg msg-ok";
  }, [uiMsg]);

  const selectedLeaveOption = useMemo(() => {
    return LEAVE_TYPE_OPTIONS.find((option) => option.value === leaveType);
  }, [leaveType]);

  const leaveContextualHint = useMemo(() => {
    if (leaveType === "mutua") {
      return "La mutua viene registrata direttamente per la giornata di oggi.";
    }

    if (leaveType === "ferie") {
      return "Le ferie richiedono approvazione admin e possono coprire anche più giorni.";
    }

    if (leaveType === "pir") {
      return "Il PIR richiede approvazione admin e viene gestito come richiesta giornaliera.";
    }

    return selectedLeaveOption?.description || "Seleziona il tipo di assenza da richiedere.";
  }, [leaveType, selectedLeaveOption]);

  const latestUserLeaves = useMemo(() => {
    const sortedLeaves = [...(Array.isArray(userLeaves) ? userLeaves : [])].sort(
      (a, b) => {
        const dateA = new Date(a?.date || a?.createdAt || 0).getTime();
        const dateB = new Date(b?.date || b?.createdAt || 0).getTime();
        return dateB - dateA;
      }
    );

    const pendingLeaves = sortedLeaves.filter(
      (leave) => String(leave?.status || "").toLowerCase() === "pending"
    );

    const recentNonPendingLeaves = sortedLeaves
      .filter((leave) => String(leave?.status || "").toLowerCase() !== "pending")
      .slice(0, 5);

    return [...pendingLeaves, ...recentNonPendingLeaves];
  }, [userLeaves]);

  const anomalyLabel = useMemo(() => {
    if (!openRecord) return "";

    if (openRecord.status === "pending_manual_closure") {
      return "Hai una richiesta di chiusura manuale in attesa di approvazione admin.";
    }

    if (openRecord.status === "manual_closure_rejected") {
      return "La tua richiesta di chiusura manuale è stata rifiutata. Devi inviarne una nuova.";
    }

    if (openRecord.status === "open" && isOpenRecordFromPreviousDay) {
      return "Hai una timbratura aperta di un giorno precedente da completare manualmente.";
    }

    return "";
  }, [openRecord, isOpenRecordFromPreviousDay]);

  const daySummary = useMemo(() => {
    if (loadingStatus || loadingOpenRecord || loadingLeaveStatus) {
      return {
        title: "Caricamento stato giornata",
        description: "Sto recuperando timbrature, assenze e anomalie.",
        detail: "Attendi qualche secondo...",
        tone: "neutral",
      };
    }

    if (hasTodayApprovedLeave) {
      return {
        title: "Assenza approvata per oggi",
        description: `${getLeaveTypeLabel(todayLeave)} approvata: le timbrature sono disabilitate.`,
        detail: todayLeave?.note ? `Nota: ${todayLeave.note}` : "Non devi effettuare timbrature per questa giornata.",
        tone: "warning",
      };
    }

    if (hasBlockingAnomaly) {
      return {
        title: "Timbratura da sistemare",
        description: anomalyLabel || "Hai una timbratura anomala da completare.",
        detail: canRequestManualClosure
          ? "Puoi inviare una richiesta di chiusura manuale."
          : "Attendi la gestione della richiesta o contatta un admin.",
        tone: "warning",
      };
    }

    if (canClockOut) {
      return {
        title: "Sei attualmente in servizio",
        description: "Entrata registrata, uscita non ancora effettuata.",
        detail: entrata ? `Entrata: ${formatTimeIT(entrata)}` : "",
        tone: "success",
      };
    }

    if (hasCompleteSession) {
      return {
        title: "Giornata completata",
        description: "Hai già registrato entrata e uscita per oggi.",
        detail:
          entrata && uscita
            ? `Entrata ${formatTimeIT(entrata)} · Uscita ${formatTimeIT(uscita)}`
            : "",
        tone: "success",
      };
    }

    return {
      title: "Pronto per iniziare",
      description: "Non risultano timbrature registrate per oggi.",
      detail: "Puoi registrare l'entrata quando sei in ufficio.",
      tone: "neutral",
    };
  }, [
    loadingStatus,
    loadingOpenRecord,
    loadingLeaveStatus,
    hasTodayApprovedLeave,
    todayLeave,
    hasBlockingAnomaly,
    anomalyLabel,
    canRequestManualClosure,
    canClockOut,
    hasCompleteSession,
    entrata,
    uscita,
  ]);

  const resetStampState = useCallback(() => {
    setEntrata(null);
    setUscita(null);
  }, []);

  const resetTodayLeaveState = useCallback(() => {
    setTodayLeave(null);
  }, []);

  const resetOpenRecordState = useCallback(() => {
    setOpenRecord(null);
    setIsOpenRecordFromPreviousDay(false);
    setCanRequestManualClosure(false);
  }, []);

  function handleLeaveTypeChange(nextType) {
    setLeaveType(nextType);

    if (nextType === "mutua") {
      const today = toRomeYMD(new Date());
      setLeaveStartDate(today);
      setLeaveEndDate(today);
    }
  }

  function getLeaveRequestSuccessMessage(type, backendMessage) {
    if (backendMessage) return backendMessage;

    if (type === "mutua") {
      return "Mutua registrata con successo.";
    }

    if (type === "ferie") {
      return "Richiesta ferie inviata con successo. Ora è in attesa di approvazione admin.";
    }

    if (type === "pir") {
      return "Richiesta PIR inviata con successo. Ora è in attesa di approvazione admin.";
    }

    return "Richiesta assenza inviata con successo.";
  }

  function prepareManualClosureForm() {
    const now = new Date();

    setManualDate(toRomeYMD(now));

    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    setManualTime(`${hh}:${mm}`);

    setManualNote("");
  }

  const applyTodayRecords = useCallback(
    (records) => {
      const safeRecords = Array.isArray(records) ? records : [];

      const activeRecords = safeRecords.filter(
        (record) => String(record?.status || "").toLowerCase() !== "cancelled"
      );

      const openTodayRecord = activeRecords.find((r) => r.clockIn && !r.clockOut);
      if (openTodayRecord) {
        setEntrata(new Date(openTodayRecord.clockIn));
        setUscita(null);
        return;
      }

      const lastCompleteRecord = activeRecords.find(
        (r) => r.clockIn && r.clockOut
      );
      if (lastCompleteRecord) {
        setEntrata(new Date(lastCompleteRecord.clockIn));
        setUscita(new Date(lastCompleteRecord.clockOut));
        return;
      }

      resetStampState();
    },
    [resetStampState]
  );
  const applyTodayLeaveData = useCallback((leaves) => {
    const safeLeaves = Array.isArray(leaves) ? leaves : [];
    setTodayLeave(safeLeaves[0] || null);
  }, []);

  const applyOpenRecordData = useCallback((data) => {
    setOpenRecord(data?.record || null);
    setIsOpenRecordFromPreviousDay(Boolean(data?.isFromPreviousDay));
    setCanRequestManualClosure(Boolean(data?.canRequestManualClosure));
  }, []);

  const loadTodayStatus = useCallback(async () => {
    if (!user) return;

    setLoadingStatus(true);

    try {
      const todayLocal = toRomeYMD(new Date());

      const res = await authFetch(
        `${BASE_URL}/api/records/my?date=${todayLocal}`,
        {},
        { handleSessionExpired, navigate }
      );

      if (!res) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Errore recupero timbrature:", data);
        resetStampState();
        setUiMsg({
          type: "error",
          text: data?.message || "Errore nel recupero delle timbrature di oggi.",
        });
        return;
      }

      applyTodayRecords(data.records);
    } catch (err) {
      console.error("Errore loadTodayStatus:", err);
      resetStampState();
      setUiMsg({
        type: "error",
        text: "Errore di rete o backend non raggiungibile.",
      });
    } finally {
      setLoadingStatus(false);
    }
  }, [
    BASE_URL,
    applyTodayRecords,
    handleSessionExpired,
    navigate,
    resetStampState,
    user,
  ]);

  const loadAppSettings = useCallback(async () => {
    if (!user) return;

    try {
      const res = await authFetch(
        `${BASE_URL}/api/settings`,
        {},
        { handleSessionExpired, navigate }
      );

      if (!res) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Errore recupero impostazioni app:", data);
        setLeaveMinAdvanceDays(null);
        return;
      }

      const value = data?.settings?.leaveMinAdvanceDays;

      setLeaveMinAdvanceDays(Number.isInteger(value) ? value : null);
    } catch (err) {
      console.error("Errore loadAppSettings:", err);
      setLeaveMinAdvanceDays(null);
    }
  }, [BASE_URL, handleSessionExpired, navigate, user]);

  const loadTodayLeaveStatus = useCallback(async () => {
    if (!user) return;

    setLoadingLeaveStatus(true);

    try {
      const todayLocal = toRomeYMD(new Date());

      const res = await authFetch(
        `${BASE_URL}/api/leaves/my?date=${todayLocal}`,
        {},
        { handleSessionExpired, navigate }
      );

      if (!res) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Errore recupero leave:", data);
        resetTodayLeaveState();
        setUiMsg({
          type: "error",
          text: data?.message || "Errore nel recupero delle assenze di oggi.",
        });
        return;
      }

      applyTodayLeaveData(data.leaves);
    } catch (err) {
      console.error("Errore loadTodayLeaveStatus:", err);
      resetTodayLeaveState();
      setUiMsg({
        type: "error",
        text: "Errore di rete o backend non raggiungibile.",
      });
    } finally {
      setLoadingLeaveStatus(false);
    }
  }, [
    BASE_URL,
    applyTodayLeaveData,
    handleSessionExpired,
    navigate,
    resetTodayLeaveState,
    user,
  ]);

  const loadUserLeaves = useCallback(async () => {
    if (!user) return;

    setLoadingUserLeaves(true);

    try {
      const today = new Date();
      const from = toRomeYMD(addDays(today, -90));
      const to = toRomeYMD(addDays(today, 180));

      const res = await authFetch(
        `${BASE_URL}/api/leaves/my?from=${from}&to=${to}`,
        {},
        { handleSessionExpired, navigate }
      );

      if (!res) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Errore recupero lista assenze:", data);
        setUserLeaves([]);
        return;
      }

      setUserLeaves(Array.isArray(data.leaves) ? data.leaves : []);
    } catch (err) {
      console.error("Errore loadUserLeaves:", err);
      setUserLeaves([]);
    } finally {
      setLoadingUserLeaves(false);
    }
  }, [BASE_URL, handleSessionExpired, navigate, user]);

  const loadOpenRecordStatus = useCallback(async () => {
    if (!user) return;

    setLoadingOpenRecord(true);

    try {
      const res = await authFetch(
        `${BASE_URL}/api/records/my-open`,
        {},
        { handleSessionExpired, navigate }
      );

      if (!res) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("Errore recupero record aperto:", data);
        resetOpenRecordState();
        setUiMsg({
          type: "error",
          text: data?.message || "Errore nel recupero dello stato anomalo.",
        });
        return;
      }

      applyOpenRecordData(data);
    } catch (err) {
      console.error("Errore loadOpenRecordStatus:", err);
      resetOpenRecordState();
      setUiMsg({
        type: "error",
        text: "Errore di rete o backend non raggiungibile.",
      });
    } finally {
      setLoadingOpenRecord(false);
    }
  }, [
    BASE_URL,
    applyOpenRecordData,
    handleSessionExpired,
    navigate,
    resetOpenRecordState,
    user,
  ]);

  async function reloadAllStatuses() {
    await Promise.all([
      loadTodayStatus(),
      loadTodayLeaveStatus(),
      loadUserLeaves(),
      loadOpenRecordStatus(),
    ]);
  }

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    loadTodayStatus();
    loadTodayLeaveStatus();
    loadUserLeaves();
    loadOpenRecordStatus();
    loadAppSettings();
  }, [
    user,
    loadTodayStatus,
    loadTodayLeaveStatus,
    loadUserLeaves,
    loadOpenRecordStatus,
    loadAppSettings,
  ]);

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, []);

  function handleLogout() {
    logout();
    setShowLogoutMessage(true);

    logoutTimerRef.current = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 2000);
  }

  function requestCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject({ code: "GEOLOCATION_UNSUPPORTED" });
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
  }

  function getGeolocationErrorMessage(error) {
    if (error?.code === "GEOLOCATION_UNSUPPORTED") {
      return "Il tuo browser non supporta la geolocalizzazione.";
    }

    if (error?.code === 1) {
      return "Permesso posizione negato: non posso registrare l'entrata senza verificare che tu sia in ufficio.";
    }

    if (error?.code === 2) {
      return "Posizione non disponibile: controlla GPS, connessione o permessi del dispositivo.";
    }

    if (error?.code === 3) {
      return "Tempo scaduto durante il recupero della posizione. Riprova tra qualche secondo.";
    }

    return "Impossibile recuperare la posizione. Riprova.";
  }

  function getClockInErrorMessage(data) {
    const code = data?.code;

    const errorMessages = {
      INVALID_LOCATION:
        "Posizione non valida: non posso registrare l'entrata.",
      LOCATION_CONFIG_ERROR:
        "Configurazione geolocalizzazione non valida: contatta l'amministratore.",
      LOCATION_OUT_OF_RANGE:
        "Non puoi registrare l'entrata: sei fuori dall'area autorizzata.",
    };

    return errorMessages[code] || data?.message || "Clock-in fallito.";
  }

  function getClockOutErrorMessage(data) {
    const code = data?.code;

    const errorMessages = {
      INVALID_LOCATION:
        "Posizione non valida: non posso registrare l'uscita.",
      LOCATION_CONFIG_ERROR:
        "Configurazione geolocalizzazione non valida: contatta l'amministratore.",
      LOCATION_OUT_OF_RANGE:
        "Non puoi registrare l'uscita: sei fuori dall'area autorizzata.",
    };

    return errorMessages[code] || data?.message || "Clock-out fallito.";
  }

  async function handleClockIn() {
    setUiMsg({
      type: "warning",
      text: "Per registrare l'entrata è necessario verificare che tu sia in ufficio.",
    });

    setStampingAction("clockIn");

    let position;

    try {
      position = await requestCurrentPosition();
    } catch (err) {
      console.error("Errore geolocalizzazione:", err);

      setUiMsg({
        type: "error",
        text: getGeolocationErrorMessage(err),
      });

      return;
    }

    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };

    const res = await authFetch(
      `${BASE_URL}/api/records/clock-in`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
        }),
      },
      { handleSessionExpired, navigate }
    );

    if (!res) return;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setUiMsg({
        type: "error",
        text: getClockInErrorMessage(data),
      });

      await reloadAllStatuses();
      return;
    }

    const clockInTime =
      data?.record?.clockIn || data?.clockIn || new Date().toISOString();

    setEntrata(new Date(clockInTime));
    setUscita(null);

    setUiMsg({
      type: "ok",
      text: "Entrata registrata con successo.",
    });

    await reloadAllStatuses();
  }

  async function handleClockOut() {
    setUiMsg({
      type: "warning",
      text: "Per registrare l'uscita è necessario verificare che tu sia in ufficio.",
    });

    setStampingAction("clockOut");

    let position;

    try {
      position = await requestCurrentPosition();
    } catch (err) {
      console.error("Errore geolocalizzazione:", err);

      setUiMsg({
        type: "error",
        text: getGeolocationErrorMessage(err),
      });

      return;
    }

    const location = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };

    const res = await authFetch(
      `${BASE_URL}/api/records/clock-out`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          location,
        }),
      },
      { handleSessionExpired, navigate }
    );

    if (!res) return;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setUiMsg({
        type: "error",
        text: getClockOutErrorMessage(data),
      });

      await reloadAllStatuses();
      return;
    }

    const clockOutTime =
      data?.record?.clockOut || data?.clockOut || new Date().toISOString();

    setUscita(new Date(clockOutTime));

    setUiMsg({
      type: "ok",
      text: "Uscita registrata con successo.",
    });

    await reloadAllStatuses();
  }

  function scrollToFeedbackMessage() {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        feedbackMessageRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    });
  }

  function setLeaveRequestFeedback(message) {
    setUiMsg(message);
    scrollToFeedbackMessage();
  }

  async function handleLeaveRequestSubmit() {
    if (leaveRequestLoading || isStamping) return;

    const isFerieRange = leaveType === "ferie";

    if (!leaveType || !leaveStartDate || (isFerieRange && !leaveEndDate)) {
      setLeaveRequestFeedback({
        type: "warning",
        text: isFerieRange
          ? "Seleziona tipo assenza, data inizio e data fine."
          : "Seleziona tipo assenza e data.",
      });
      return;
    }

    if (isFerieRange && leaveEndDate < leaveStartDate) {
      setLeaveRequestFeedback({
        type: "warning",
        text: "La data fine ferie non può essere precedente alla data inizio.",
      });
      return;
    }

    if (
      (leaveType === "ferie" || leaveType === "pir") &&
      Number.isInteger(leaveMinAdvanceDays)
    ) {
      const minAllowedDate = toRomeYMD(addDays(new Date(), leaveMinAdvanceDays));

      if (leaveStartDate < minAllowedDate) {
        setLeaveRequestFeedback({
          type: "warning",
          text:
            leaveMinAdvanceDays === 1
              ? "Questa richiesta non rispetta il preavviso minimo di 1 giorno."
              : `Questa richiesta non rispetta il preavviso minimo di ${leaveMinAdvanceDays} giorni.`,
        });
        return;
      }
    }

    setLeaveRequestLoading(true);
    setUiMsg(null);

    try {
      const res = await authFetch(
        `${BASE_URL}/api/leaves/${leaveType}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            leaveType === "ferie"
              ? {
                startDate: leaveStartDate,
                endDate: leaveEndDate,
                note: leaveNote.trim(),
              }
              : {
                date: leaveType === "mutua" ? toRomeYMD(new Date()) : leaveStartDate,
                note: leaveNote.trim(),
              }
          ),
        },
        { handleSessionExpired, navigate }
      );

      if (!res) return;

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setLeaveRequestFeedback({
          type: "error",
          text: data?.message || "Invio richiesta assenza fallito.",
        });

        await reloadAllStatuses();
        return;
      }

      setLeaveRequestFeedback({
        type: "ok",
        text: getLeaveRequestSuccessMessage(leaveType, data?.message),
      });

      setLeaveNote("");

      if (leaveType === "mutua") {
        const today = toRomeYMD(new Date());
        setLeaveStartDate(today);
        setLeaveEndDate(today);
      }

      await reloadAllStatuses();
    } catch (err) {
      console.error("Errore handleLeaveRequestSubmit:", err);
      setUiMsg({
        type: "error",
        text: "Errore di rete o backend non raggiungibile.",
      });
    } finally {
      setLeaveRequestLoading(false);
    }
  }

  async function handleManualClosureRequest() {
    if (!openRecord?._id) {
      setUiMsg({
        type: "error",
        text: "Nessuna timbratura aperta da completare manualmente.",
      });
      return;
    }

    if (!manualDate || !manualTime) {
      setUiMsg({
        type: "warning",
        text: "Compila data e ora di uscita prima di inviare la richiesta.",
      });
      return;
    }

    const res = await authFetch(
      `${BASE_URL}/api/records/request-manual-clock-out`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recordId: openRecord._id,
          date: manualDate,
          time: manualTime,
          note: manualNote,
        }),
      },
      { handleSessionExpired, navigate }
    );

    if (!res) return;

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setUiMsg({
        type: "error",
        text: data?.message || "Invio richiesta fallito.",
      });

      await reloadAllStatuses();
      return;
    }

    setUiMsg({
      type: "ok",
      text:
        data?.message || "Richiesta di chiusura manuale inviata con successo.",
    });

    setShowManualClosureForm(false);
    await reloadAllStatuses();
  }

  function toggleManualClosureForm() {
    const nextValue = !showManualClosureForm;
    setShowManualClosureForm(nextValue);

    if (nextValue) {
      prepareManualClosureForm();
    }
  }

  async function handleStamp() {
    if (
      !user ||
      loadingStatus ||
      loadingOpenRecord ||
      loadingLeaveStatus ||
      isStamping
    ) {
      return;
    }

    setUiMsg(null);
    setIsStamping(true);
    setStampingAction(canClockOut ? "clockOut" : "clockIn");

    try {
      if (hasTodayApprovedLeave) {
        setUiMsg({
          type: "warning",
          text: "Hai un'assenza approvata per oggi: non puoi effettuare timbrature.",
        });
        return;
      }

      if (hasBlockingAnomaly) {
        setUiMsg({
          type: "warning",
          text: "Hai una timbratura anomala da sistemare prima di poter fare una nuova bollatura.",
        });
        return;
      }

      if (canClockOut) {
        await handleClockOut();
        return;
      }

      if (hasCompleteSession) {
        const confirmNewEntry = window.confirm(
          "Hai già una sessione completata oggi. Vuoi registrare una nuova entrata adesso?"
        );

        if (!confirmNewEntry) return;
      }

      await handleClockIn();
    } catch (err) {
      console.error("Errore handleStamp:", err);
      setUiMsg({
        type: "error",
        text: "Errore di rete o backend non raggiungibile.",
      });
    } finally {
      setIsStamping(false);
      setStampingAction("");
    }
  }

  if (!user) return null;

  return (
    <div className="home-user-container">
      <div className="home-user-box">
        <div className="home-user-header">
          <h2 className="home-user-title">Benvenuto {user.username}!</h2>

          {isDemoMode && (
            <p className="home-user-demo-intro">
              Stai provando la dashboard utente: da qui un dipendente può timbrare
              entrata/uscita, richiedere assenze e controllare lo stato della giornata.
            </p>
          )}
        </div>

        <div className="home-user-clock">
          <h3>Orologio</h3>
          <p>{formatDateTimeIT(currentTime)}</p>
        </div>

        <div className={`home-user-day-summary home-user-day-summary--${daySummary.tone}`}>
          <div>
            <span className="home-user-day-summary-label">Riepilogo giornata</span>
            <h3>{daySummary.title}</h3>
            <p>{daySummary.description}</p>
            {daySummary.detail && <small>{daySummary.detail}</small>}
          </div>
        </div>

        <div
          className={`home-user-primary-action home-user-primary-action--${primaryAction}`}
        >
          <button
            onClick={handleStamp}
            className="btn-primary home-user-stamp-button"
            disabled={
              loadingStatus ||
              loadingOpenRecord ||
              loadingLeaveStatus ||
              isStamping ||
              leaveRequestLoading ||
              isStampBlocked
            }
            title={
              hasTodayApprovedLeave
                ? "Hai un'assenza approvata per oggi"
                : hasBlockingAnomaly
                  ? "Devi prima sistemare la timbratura anomala"
                  : isStamping
                    ? "Sto registrando la timbratura..."
                    : ""
            }
          >
            {primaryButtonLabel}
          </button>
        </div>

        <p className="home-user-contextual-hint">{userContextualHint}</p>

        {isDemoMode && (
          <section className="home-user-demo-guide">
            <span className="home-user-demo-guide-kicker">
              Da provare nella demo
            </span>
            <p>
              Timbra entrata/uscita, controlla il riepilogo giornata e invia una
              richiesta ferie, PIR o mutua.
            </p>
          </section>
        )}

        <div ref={feedbackMessageRef} aria-hidden="true" />

        {uiMsg?.text && <p className={msgClass}>{uiMsg.text}</p>}

        {isDemoMode && (
          <div className="home-user-demo-info-card">
            <h3>📍 Geolocalizzazione disponibile</h3>
            <p>
              Nella versione reale la bollatura d&apos;entrata può essere limitata
              all&apos;area dell&apos;ufficio.
            </p>
            <p>
              In questa demo il controllo distanza è disattivato per permettere il test
              da qualsiasi posizione.
            </p>
          </div>
        )}
        <div className="home-user-status-card">
          <h3>Richiedi assenza</h3>

          <p className="home-user-muted-text">
            Puoi registrare una mutua oppure inviare una richiesta ferie/PIR
            all&apos;admin
            {leaveMinAdvanceDays !== null && (
              <>
                {" "}con almeno <strong>{leaveMinAdvanceDays}</strong>{" "}
                {leaveMinAdvanceDays === 1 ? "giorno" : "giorni"} di anticipo
              </>
            )}
            .
          </p>

          <p className="home-user-contextual-hint home-user-contextual-hint--leave">
            {leaveContextualHint}
          </p>


          <div className="home-user-manual-form">
            <div className="home-user-form-row">
              <label htmlFor="leave-type">Tipo assenza</label>
              <select
                id="leave-type"
                value={leaveType}
                onChange={(e) => handleLeaveTypeChange(e.target.value)}
                disabled={leaveRequestLoading || isStamping}
              >
                {LEAVE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              {selectedLeaveOption?.helperText && (
                <p className="home-user-helper-text">
                  {selectedLeaveOption.helperText}
                </p>
              )}
            </div>

            <div className="home-user-form-row">
              <label htmlFor="leave-start-date">
                {leaveType === "ferie" ? "Data inizio ferie" : "Data assenza"}
              </label>
              <input
                id="leave-start-date"
                type="date"
                value={leaveStartDate}
                onChange={(e) => {
                  const nextDate = e.target.value;
                  setLeaveStartDate(nextDate);

                  if (leaveType === "ferie" && leaveEndDate < nextDate) {
                    setLeaveEndDate(nextDate);
                  }
                }}
                disabled={leaveRequestLoading || isStamping || leaveType === "mutua"}
              />

              {leaveType === "mutua" && (
                <p className="home-user-helper-text">
                  La mutua può essere registrata solo per la giornata di oggi.
                </p>
              )}
            </div>

            {leaveType === "ferie" && (
              <div className="home-user-form-row">
                <label htmlFor="leave-end-date">Data fine ferie</label>
                <input
                  id="leave-end-date"
                  type="date"
                  value={leaveEndDate}
                  min={leaveStartDate}
                  onChange={(e) => setLeaveEndDate(e.target.value)}
                  disabled={leaveRequestLoading || isStamping}
                />

                <p className="home-user-helper-text">
                  Puoi selezionare un singolo giorno oppure un periodo di più giorni.
                </p>
              </div>
            )}

            <div className="home-user-form-row">
              <label htmlFor="leave-note">Nota (facoltativa)</label>
              <textarea
                id="leave-note"
                value={leaveNote}
                onChange={(e) => setLeaveNote(e.target.value)}
                placeholder={
                  leaveType === "mutua"
                    ? "Esempio: febbre"
                    : "Esempio: richiesta per motivi personali"
                }
                rows={3}
                disabled={leaveRequestLoading || isStamping}
              />
            </div>

            <div className="home-user-manual-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={handleLeaveRequestSubmit}
                disabled={
                  leaveRequestLoading ||
                  isStamping ||
                  !leaveStartDate ||
                  (leaveType === "ferie" && !leaveEndDate)
                }
              >
                {leaveRequestLoading ? "Invio in corso..." : "Invia richiesta"}
              </button>
            </div>
          </div>
        </div>

        <div className="home-user-status-card">
          <h3>Le tue richieste assenze</h3>

          {loadingUserLeaves ? (
            <p className="home-user-loading">Carico richieste assenze...</p>
          ) : latestUserLeaves.length === 0 ? (
            <p className="home-user-muted-text">
              Non hai ancora richieste assenze nel periodo recente.
            </p>
          ) : (
            <>
              <p className="home-user-muted-text">
                Mostriamo le richieste in attesa e le richieste più recenti.
              </p>

              <div className="home-user-leave-list">
                {latestUserLeaves.map((leave) => (
                  <div key={leave._id} className="home-user-leave-item">
                    <div className="home-user-leave-main">
                      <strong>{getLeaveNotificationText(leave)}</strong>

                      {leave.type === "pir" && leave.hours != null && (
                        <span className="home-user-leave-note">
                          Ore PIR: {leave.hours}
                        </span>
                      )}

                      {leave.note && (
                        <span className="home-user-leave-note">
                          Nota richiesta: {leave.note}
                        </span>
                      )}

                      {leave.reviewNote && (
                        <span className="home-user-leave-note">
                          Nota admin: {leave.reviewNote}
                        </span>
                      )}
                    </div>

                    <span
                      className={`home-user-leave-status ${getLeaveStatusClass(
                        leave
                      )}`}
                    >
                      {getLeaveStatusLabel(leave)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {!loadingLeaveStatus && todayLeave && (
          <div
            className={
              hasTodayApprovedLeave
                ? "home-user-warning-card"
                : "home-user-status-card"
            }
          >
            <h3>Assenza di oggi</h3>

            <p className="home-user-warning-text">
              Per oggi risulta: <strong>{todayLeaveLabel}</strong>.
            </p>

            {hasTodayApprovedLeave && (
              <p className="home-user-warning-text">
                Le normali timbrature sono disabilitate perché questa assenza è
                approvata.
              </p>
            )}

            <p className="home-user-warning-detail">
              Data: <strong>{formatDateIT(new Date(todayLeave.date))}</strong>
            </p>

            {todayLeave.note && (
              <p className="home-user-warning-detail">
                Nota: <strong>{todayLeave.note}</strong>
              </p>
            )}
          </div>
        )}

        {!loadingOpenRecord && openRecord && hasBlockingAnomaly && (
          <div className="home-user-warning-card">
            <h3>Attenzione</h3>

            <p className="home-user-warning-text">{anomalyLabel}</p>

            {openRecord.clockIn && (
              <p className="home-user-warning-detail">
                Entrata aperta:{" "}
                <strong>{formatDateTimeIT(new Date(openRecord.clockIn))}</strong>
              </p>
            )}

            {openRecord?.manualClosureRequest?.proposedClockOut && (
              <p className="home-user-warning-detail">
                Uscita proposta:{" "}
                <strong>
                  {formatDateTimeIT(
                    new Date(openRecord.manualClosureRequest.proposedClockOut)
                  )}
                </strong>
              </p>
            )}

            {openRecord?.manualClosureRequest?.reviewNote && (
              <p className="home-user-warning-detail">
                Nota admin:{" "}
                <strong>{openRecord.manualClosureRequest.reviewNote}</strong>
              </p>
            )}

            {canRequestManualClosure && (
              <div className="home-user-manual-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={toggleManualClosureForm}
                  disabled={isStamping || hasTodayApprovedLeave}
                >
                  {showManualClosureForm
                    ? "Chiudi modulo richiesta"
                    : "Completa uscita manualmente"}
                </button>
              </div>
            )}

            {showManualClosureForm && canRequestManualClosure && (
              <div className="home-user-manual-form">
                <div className="home-user-form-row">
                  <label htmlFor="manual-date">Data uscita</label>
                  <input
                    id="manual-date"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    disabled={isStamping}
                  />
                </div>

                <div className="home-user-form-row">
                  <label htmlFor="manual-time">Ora uscita</label>
                  <input
                    id="manual-time"
                    type="time"
                    value={manualTime}
                    onChange={(e) => setManualTime(e.target.value)}
                    disabled={isStamping}
                  />
                </div>

                <div className="home-user-form-row">
                  <label htmlFor="manual-note">Nota (facoltativa)</label>
                  <textarea
                    id="manual-note"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                    placeholder="Esempio: ho dimenticato di timbrare l'uscita ieri sera"
                    rows={3}
                    disabled={isStamping}
                  />
                </div>

                <div className="home-user-manual-actions">
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={async () => {
                      if (isStamping) return;

                      setIsStamping(true);
                      setStampingAction("manualClosure");
                      setUiMsg(null);

                      try {
                        await handleManualClosureRequest();
                      } catch (err) {
                        console.error(
                          "Errore handleManualClosureRequest:",
                          err
                        );
                        setUiMsg({
                          type: "error",
                          text: "Errore di rete o backend non raggiungibile.",
                        });
                      } finally {
                        setIsStamping(false);
                        setStampingAction("");
                      }
                    }}
                    disabled={isStamping}
                  >
                    {stampingAction === "manualClosure" ? "Invio richiesta..." : "Invia richiesta"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="home-user-actions">
          <button
            onClick={() => navigate("/storico")}
            className="btn-secondary"
            disabled={isStamping || leaveRequestLoading}
          >
            Vai allo Storico
          </button>

          <button
            onClick={handleLogout}
            className="btn-logout"
            disabled={isStamping || leaveRequestLoading}
          >
            Logout ⮕
          </button>
        </div>

        {showLogoutMessage && <p className="logout-msg">Logout effettuato!</p>}
      </div >
    </div >
  );
}

