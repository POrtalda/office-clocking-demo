import "./Home-admin.css";
import {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import Calendar from "react-calendar";
import { AuthContext } from "../../context/auth-context";
import {
  formatDateIT,
  formatDateTimeIT,
  formatDuration,
  formatTimeIT,
  toRomeYMD,
} from "../../utils/dateUtils";
import { authFetch } from "../../utils/authFetch";
import AdminUsersSection from "./AdminUsersSection";

const STORAGE_KEYS = {
  summaryUsername: "homeadmin_summary_username",
  summaryFromDate: "homeadmin_summary_from_date",
  summaryToDate: "homeadmin_summary_to_date",
  multiFromDate: "homeadmin_multi_from_date",
  multiToDate: "homeadmin_multi_to_date",
  dayUsername: "homeadmin_day_username",
  selectedDate: "homeadmin_selected_date",
  approvedLeavesFromDate: "homeadmin_approved_leaves_from_date",
  approvedLeavesToDate: "homeadmin_approved_leaves_to_date",
  approvedLeavesUsername: "homeadmin_approved_leaves_username",
  approvedLeavesType: "homeadmin_approved_leaves_type",
};

const ADMIN_UI_LABELS = {
  roles: {
    admin: "Admin",
    user: "Utente",
  },
  userStatus: {
    active: "Attivo",
    inactive: "Disattivato",
  },
  recordStatus: {
    cancelled: "Annullata",
    closed: "Chiuso",
    open: "Aperto",
    pendingManualClosure: "Richiesta in attesa",
    manualClosureRejected: "Richiesta rifiutata",
    unknown: "Sconosciuto",
  },
  leaveStatus: {
    approved: "Approvata",
    pending: "Richiesta in attesa",
    rejected: "Rifiutata",
    cancelled: "Annullata",
    unknown: "Sconosciuta",
  },
  leaveTypes: {
    mutua: "Mutua",
    ferie: "Ferie",
    pir: "PIR",
    fallback: "Assenza",
  },
  fields: {
    from: "Dal",
    to: "Al",
    user: "Utente",
    role: "Ruolo",
    status: "Stato",
    timeRecords: "Timbrature",
    workedHours: "Ore lavorate",
  },
};

function getStoredString(key, fallback = "") {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function getStoredDate(key) {
  try {
    const value = localStorage.getItem(key);
    if (!value) return new Date();

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  } catch {
    return new Date();
  }
}

function useAutoClearFeedback(value, clearValue, delay) {
  useEffect(() => {
    if (!value) return;

    const timer = setTimeout(() => {
      clearValue("");
    }, delay);

    return () => clearTimeout(timer);
  }, [value, clearValue, delay]);
}

function getMonthRangeFromDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  return {
    from: toRomeYMD(firstDay),
    to: toRomeYMD(lastDay),
  };
}

export default function Home_admin() {
  const { logout, user, handleSessionExpired } = useContext(AuthContext);
  const navigate = useNavigate();
  const BASE_URL = import.meta.env.VITE_API_URL;
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
  const logoutTimerRef = useRef(null);
  const singleSummarySectionRef = useRef(null);
  const highlightTimerRef = useRef(null);

  // =========================
  // STATI GENERALI
  // =========================
  const [showLogoutMessage, setShowLogoutMessage] = useState(false);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [highlightSingleSummary, setHighlightSingleSummary] = useState(false);

  // =========================
  // STATI GESTIONE UTENTI
  // =========================
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");

  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState("");
  const [createUserMsg, setCreateUserMsg] = useState("");

  const [userActionLoadingId, setUserActionLoadingId] = useState("");
  const [userActionError, setUserActionError] = useState("");
  const [userActionMsg, setUserActionMsg] = useState("");

  const [deleteUserLoadingId, setDeleteUserLoadingId] = useState("");

  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [passwordActionLoadingId, setPasswordActionLoadingId] = useState("");
  const [passwordActionError, setPasswordActionError] = useState("");
  const [passwordActionMsg, setPasswordActionMsg] = useState("");

  // =========================
  // STATI RIEPILOGO SINGOLO UTENTE
  // =========================
  const [selectedUsername, setSelectedUsername] = useState(() =>
    getStoredString(STORAGE_KEYS.summaryUsername, "")
  );
  const [fromDate, setFromDate] = useState(() =>
    getStoredString(STORAGE_KEYS.summaryFromDate, "")
  );
  const [toDate, setToDate] = useState(() =>
    getStoredString(STORAGE_KEYS.summaryToDate, "")
  );
  const [summaryData, setSummaryData] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [summaryHasSearched, setSummaryHasSearched] = useState(false);

  // =========================
  // STATI RIEPILOGO MULTIUTENTE
  // =========================
  const [multiFromDate, setMultiFromDate] = useState(() =>
    getStoredString(STORAGE_KEYS.multiFromDate, "")
  );
  const [multiToDate, setMultiToDate] = useState(() =>
    getStoredString(STORAGE_KEYS.multiToDate, "")
  );
  const [multiSummaryRows, setMultiSummaryRows] = useState([]);
  const [multiSummaryLoading, setMultiSummaryLoading] = useState(false);
  const [multiSummaryError, setMultiSummaryError] = useState("");
  const [multiSummaryHasSearched, setMultiSummaryHasSearched] = useState(false);
  const [expandedMultiUserIds, setExpandedMultiUserIds] = useState(
    () => new Set()
  );

  // =========================
  // STATI DETTAGLIO GIORNALIERO
  // =========================
  const [selectedDate, setSelectedDate] = useState(() =>
    getStoredDate(STORAGE_KEYS.selectedDate)
  );
  const [dayUsername, setDayUsername] = useState(() =>
    getStoredString(STORAGE_KEYS.dayUsername, "")
  );
  const [dayRecords, setDayRecords] = useState([]);
  const [dayLeaves, setDayLeaves] = useState([]);
  const [dayTotalSec, setDayTotalSec] = useState(0);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState("");
  const [dayHasSearched, setDayHasSearched] = useState(false);

  // Leave del mese per evidenziare il calendario admin
  const [monthLeaves, setMonthLeaves] = useState([]);
  const [monthLeavesLoading, setMonthLeavesLoading] = useState(false);
  const [activeMonth, setActiveMonth] = useState(() =>
    getStoredDate(STORAGE_KEYS.selectedDate)
  );

  // =========================
  // STATI RICHIESTE CHIUSURA MANUALE
  // =========================
  const [manualRequests, setManualRequests] = useState([]);
  const [manualRequestsLoading, setManualRequestsLoading] = useState(false);
  const [manualRequestsError, setManualRequestsError] = useState("");
  const [manualRequestsMsg, setManualRequestsMsg] = useState("");
  const [manualActionLoadingId, setManualActionLoadingId] = useState("");
  const [manualActionType, setManualActionType] = useState("");

  // =========================
  // STATI RICHIESTE ASSENZE
  // =========================
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [leaveRequestsLoading, setLeaveRequestsLoading] = useState(false);
  const [leaveRequestsError, setLeaveRequestsError] = useState("");
  const [leaveRequestsMsg, setLeaveRequestsMsg] = useState("");
  const [leaveActionLoadingId, setLeaveActionLoadingId] = useState("");
  const [leaveActionType, setLeaveActionType] = useState("");

  // =========================
  // STATI RIEPILOGO FERIE/PIR APPROVATI
  // =========================
  const [approvedLeaves, setApprovedLeaves] = useState([]);
  const [approvedLeavesLoading, setApprovedLeavesLoading] = useState(false);
  const [approvedLeavesError, setApprovedLeavesError] = useState("");
  const [approvedLeavesHasSearched, setApprovedLeavesHasSearched] =
    useState(false);
  const [approvedLeavesFromDate, setApprovedLeavesFromDate] = useState(() =>
    getStoredString(STORAGE_KEYS.approvedLeavesFromDate, "")
  );
  const [approvedLeavesToDate, setApprovedLeavesToDate] = useState(() =>
    getStoredString(STORAGE_KEYS.approvedLeavesToDate, "")
  );
  const [approvedLeavesUsername, setApprovedLeavesUsername] = useState(() =>
    getStoredString(STORAGE_KEYS.approvedLeavesUsername, "")
  );
  const [approvedLeavesType, setApprovedLeavesType] = useState(() =>
    getStoredString(STORAGE_KEYS.approvedLeavesType, "")
  );

  // =========================
  // STATI IMPOSTAZIONI
  // =========================
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsMsg, setSettingsMsg] = useState("");
  const [leaveMinAdvanceDays, setLeaveMinAdvanceDays] = useState(2);
  const [leaveNotificationEmails, setLeaveNotificationEmails] = useState("");

  // =========================
  // HELPERS GENERALI
  // =========================
  const safeReadJson = useCallback(async (res) => {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }, []);

  const authGet = useCallback(async (url, fallbackErrorMessage) => {
    const res = await authFetch(url, {}, { handleSessionExpired, navigate });
    if (!res) return null;

    const data = await safeReadJson(res);

    if (!res.ok) {
      throw new Error(data.message || fallbackErrorMessage);
    }

    return data;
  }, [handleSessionExpired, navigate, safeReadJson]);

  async function authPost(url, body, fallbackErrorMessage) {
    const res = await authFetch(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      },
      { handleSessionExpired, navigate }
    );

    if (!res) return null;

    const data = await safeReadJson(res);

    if (!res.ok) {
      throw new Error(data.message || fallbackErrorMessage);
    }

    return data;
  }

  async function authPatch(url, body, fallbackErrorMessage) {
    const res = await authFetch(
      url,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body ?? {}),
      },
      { handleSessionExpired, navigate }
    );

    if (!res) return null;

    const data = await safeReadJson(res);

    if (!res.ok) {
      throw new Error(data.message || fallbackErrorMessage);
    }

    return data;
  }


  function formatEmailsForTextarea(emails) {
    if (!Array.isArray(emails)) {
      return "";
    }

    return emails.join("\n");
  }

  function parseEmailsFromTextarea(value) {
    return value
      .split(/[\n,;]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  const fetchAppSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError("");

    try {
      const data = await authGet(
        `${BASE_URL}/api/admin/settings`,
        "Errore durante il caricamento delle impostazioni."
      );

      if (!data) return;

      setLeaveMinAdvanceDays(data.settings?.leaveMinAdvanceDays ?? 2);
      setLeaveNotificationEmails(
        formatEmailsForTextarea(data.settings?.leaveNotificationEmails)
      );
    } catch (err) {
      setSettingsError(err.message || "Errore durante il caricamento delle impostazioni.");
    } finally {
      setSettingsLoading(false);
    }
  }, [BASE_URL, authGet]);

  async function handleSaveAppSettings(event) {
    event.preventDefault();

    const parsedDays = Number(leaveMinAdvanceDays);

    const parsedEmails = parseEmailsFromTextarea(leaveNotificationEmails);

    if (!Number.isInteger(parsedDays) || parsedDays < 0 || parsedDays > 365) {
      setSettingsError("Inserisci un numero intero tra 0 e 365.");
      setSettingsMsg("");
      return;
    }

    setSettingsSaving(true);
    setSettingsError("");
    setSettingsMsg("");

    try {
      const data = await authPatch(
        `${BASE_URL}/api/admin/settings`,
        {
          leaveMinAdvanceDays: parsedDays,
          leaveNotificationEmails: parsedEmails,
        },
        "Errore durante il salvataggio delle impostazioni."
      );

      if (!data) return;

      setLeaveMinAdvanceDays(data.settings?.leaveMinAdvanceDays ?? parsedDays);
      setLeaveNotificationEmails(
        formatEmailsForTextarea(data.settings?.leaveNotificationEmails ?? parsedEmails)
      );
      setSettingsMsg(data.message || "Impostazioni aggiornate correttamente.");
    } catch (err) {
      setSettingsError(err.message || "Errore durante il salvataggio delle impostazioni.");
    } finally {
      setSettingsSaving(false);
    }
  }

  async function authDelete(url, fallbackErrorMessage) {
    const res = await authFetch(
      url,
      {
        method: "DELETE",
      },
      { handleSessionExpired, navigate }
    );

    if (!res) return null;

    const data = await safeReadJson(res);

    if (!res.ok) {
      throw new Error(data.message || fallbackErrorMessage);
    }

    return data;
  }

  function csvEscape(value) {
    const safe = String(value ?? "");
    if (/[;"\n\r]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  }

  function isInvalidRange(from, to) {
    return !from || !to || from > to;
  }

  function getRecordStatusLabel(record) {
    const status = String(
      record?.effectiveStatus || record?.status || ""
    ).toLowerCase();

    if (status === "cancelled") return ADMIN_UI_LABELS.recordStatus.cancelled;
    if (status === "closed") return ADMIN_UI_LABELS.recordStatus.closed;
    if (status === "open") return ADMIN_UI_LABELS.recordStatus.open;
    if (status === "pending_manual_closure") {
      return ADMIN_UI_LABELS.recordStatus.pendingManualClosure;
    }
    if (status === "manual_closure_rejected") {
      return ADMIN_UI_LABELS.recordStatus.manualClosureRejected;
    }

    if (record?.clockOut) return ADMIN_UI_LABELS.recordStatus.closed;
    if (!record?.clockOut) return ADMIN_UI_LABELS.recordStatus.open;

    return ADMIN_UI_LABELS.recordStatus.unknown;
  }

  function canCancelTimeRecord(record) {
    const status = String(
      record?.effectiveStatus || record?.status || ""
    ).toLowerCase();

    return Boolean(record?._id) && status !== "cancelled";
  }

  function getRecordStatusBadgeClass(record) {
    const status = String(
      record?.effectiveStatus || record?.status || ""
    ).toLowerCase();

    if (status === "cancelled") return "danger";
    if (status === "closed") return "success";
    if (status === "open") return "info";
    if (status === "pending_manual_closure") return "warning";
    if (status === "manual_closure_rejected") return "danger";

    if (record?.clockOut) return "success";
    if (!record?.clockOut) return "info";

    return "neutral";
  }

  function getUserStatusLabel(adminUser) {
    return adminUser?.isActive
      ? ADMIN_UI_LABELS.userStatus.active
      : ADMIN_UI_LABELS.userStatus.inactive;
  }

  function getUserStatusBadgeClass(adminUser) {
    return adminUser?.isActive ? "success" : "danger";
  }

  function getLeaveTypeLabel(leave) {
    const type = String(leave?.type || "").toLowerCase();

    if (type === "mutua") return ADMIN_UI_LABELS.leaveTypes.mutua;
    if (type === "ferie") return ADMIN_UI_LABELS.leaveTypes.ferie;
    if (type === "pir") return ADMIN_UI_LABELS.leaveTypes.pir;

    return String(
      leave?.typeLabel || leave?.type || ADMIN_UI_LABELS.leaveTypes.fallback
    );
  }

  function getLeaveStatusLabel(leave) {
    const status = String(leave?.status || "").toLowerCase();

    if (status === "approved") return ADMIN_UI_LABELS.leaveStatus.approved;
    if (status === "pending") return ADMIN_UI_LABELS.leaveStatus.pending;
    if (status === "rejected") return ADMIN_UI_LABELS.leaveStatus.rejected;
    if (status === "cancelled") return ADMIN_UI_LABELS.leaveStatus.cancelled;

    return String(
      leave?.statusLabel || leave?.status || ADMIN_UI_LABELS.leaveStatus.unknown
    );
  }

  function getRoleLabel(role) {
    const normalizedRole = String(role || "").toLowerCase();
    return ADMIN_UI_LABELS.roles[normalizedRole] || String(role || "-");
  }

  function getLeaveStatusBadgeClass(leave) {
    const status = String(leave?.status || "").toLowerCase();

    if (status === "approved") return "success";
    if (status === "pending") return "warning";
    if (status === "rejected") return "danger";
    if (status === "cancelled") return "neutral";

    return "neutral";
  }

  function getLeavePeriodLabel(leave) {
    const startDate = leave?.startDate || leave?.date;
    const endDate = leave?.endDate || leave?.date;

    if (!startDate) return "-";

    const startLabel = formatDateIT(startDate);
    const endLabel = endDate ? formatDateIT(endDate) : "";

    if (
      leave?.type === "pir" &&
      leave?.hours != null &&
      leave?.startTime &&
      leave?.endTime
    ) {
      const hoursLabel = `${leave.hours} ${leave.hours === 1 ? "ora" : "ore"}`;

      return `${startLabel} · ${leave.startTime}–${leave.endTime} · ${hoursLabel}`;
    }

    if (!endLabel || startLabel === endLabel) {
      return startLabel;
    }

    return `${startLabel} - ${endLabel}`;
  }

  function resetCreateUserForm() {
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
    setNewFullName("");
    setNewEmail("");
  }

  function resetSummaryFilters() {
    setSelectedUsername("");
    setFromDate("");
    setToDate("");
    setSummaryData(null);
    setSummaryError("");
    setSummaryHasSearched(false);
    setHighlightSingleSummary(false);
  }

  function resetMultiSummaryFilters() {
    setMultiFromDate("");
    setMultiToDate("");
    setMultiSummaryRows([]);
    setMultiSummaryError("");
    setMultiSummaryHasSearched(false);
  }

  function resetDayFilters() {
    setSelectedDate(new Date());
    setActiveMonth(new Date());
    setDayUsername("");
    setDayRecords([]);
    setDayLeaves([]);
    setDayTotalSec(0);
    setDayError("");
    setDayHasSearched(false);
    setMonthLeaves([]);
  }

  function resetApprovedLeavesFilters() {
    setApprovedLeavesFromDate("");
    setApprovedLeavesToDate("");
    setApprovedLeavesUsername("");
    setApprovedLeavesType("");
    setApprovedLeaves([]);
    setApprovedLeavesError("");
    setApprovedLeavesHasSearched(false);
  }

  function triggerSingleSummaryHighlight() {
    setHighlightSingleSummary(true);

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }

    highlightTimerRef.current = setTimeout(() => {
      setHighlightSingleSummary(false);
    }, 1800);
  }

  function renderEmptyState(message) {
    return <p className="homeadmin-muted-text">{message}</p>;
  }

  async function refreshAnalyticsAfterAdminAction() {
    if (dayUsername) {
      await fetchDayRecords();
      await fetchMonthLeaves(dayUsername, activeMonth);
    }

    if (
      selectedUsername &&
      fromDate &&
      toDate &&
      !isInvalidRange(fromDate, toDate)
    ) {
      await fetchSummaryForUserAndRange(selectedUsername, fromDate, toDate);
    }

    if (
      multiFromDate &&
      multiToDate &&
      !isInvalidRange(multiFromDate, multiToDate)
    ) {
      await fetchMultiSummary();
    }
  }

  useEffect(() => {
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);


  useEffect(() => {
    fetchAppSettings();
  }, [fetchAppSettings]);

  // =========================
  // PERSISTENZA FILTRI
  // =========================
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.summaryUsername, selectedUsername);
  }, [selectedUsername]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.summaryFromDate, fromDate);
  }, [fromDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.summaryToDate, toDate);
  }, [toDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.multiFromDate, multiFromDate);
  }, [multiFromDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.multiToDate, multiToDate);
  }, [multiToDate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.dayUsername, dayUsername);
  }, [dayUsername]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.selectedDate,
      selectedDate instanceof Date
        ? selectedDate.toISOString()
        : new Date().toISOString()
    );
  }, [selectedDate]);

  useAutoClearFeedback(createUserMsg, setCreateUserMsg, 3500);
  useAutoClearFeedback(userActionMsg, setUserActionMsg, 3500);
  useAutoClearFeedback(passwordActionMsg, setPasswordActionMsg, 3500);
  useAutoClearFeedback(manualRequestsMsg, setManualRequestsMsg, 3500);
  useAutoClearFeedback(leaveRequestsMsg, setLeaveRequestsMsg, 3500);

  useAutoClearFeedback(createUserError, setCreateUserError, 6000);
  useAutoClearFeedback(userActionError, setUserActionError, 6000);
  useAutoClearFeedback(passwordActionError, setPasswordActionError, 6000);
  useAutoClearFeedback(manualRequestsError, setManualRequestsError, 6000);
  useAutoClearFeedback(leaveRequestsError, setLeaveRequestsError, 6000);
  useAutoClearFeedback(summaryError, setSummaryError, 6000);
  useAutoClearFeedback(multiSummaryError, setMultiSummaryError, 6000);
  useAutoClearFeedback(dayError, setDayError, 6000);
  useAutoClearFeedback(approvedLeavesError, setApprovedLeavesError, 6000);

  // =========================
  // CARICAMENTO UTENTI
  // =========================
  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      setUsersError("");

      const data = await authGet(
        `${BASE_URL}/api/admin/users`,
        "Impossibile caricare gli utenti."
      );

      if (!data) return;

      const allUsers = data.users || [];
      setUsers(allUsers);

      const normalUsersOnly = allUsers.filter(
        (u) => String(u.role).toLowerCase() === "user"
      );

      const validUsernames = new Set(normalUsersOnly.map((u) => u.username));

      if (normalUsersOnly.length > 0) {
        setSelectedUsername((prev) =>
          prev && validUsernames.has(prev) ? prev : normalUsersOnly[0].username
        );

        setDayUsername((prev) =>
          prev && validUsernames.has(prev) ? prev : normalUsersOnly[0].username
        );
      } else {
        setSelectedUsername("");
        setDayUsername("");
      }
    } catch (err) {
      setUsersError(err.message || "Impossibile caricare gli utenti.");
    } finally {
      setUsersLoading(false);
    }
  }, [BASE_URL, authGet]);

  // =========================
  // AZIONI GESTIONE UTENTI
  // =========================
  async function handleCreateUser() {
    try {
      setCreateUserLoading(true);
      setCreateUserError("");
      setCreateUserMsg("");
      setUserActionError("");
      setUserActionMsg("");
      setPasswordActionError("");
      setPasswordActionMsg("");

      if (!newUsername.trim() || !newPassword.trim()) {
        setCreateUserError("Inserisci username e password.");
        return;
      }

      await authPost(
        `${BASE_URL}/api/admin/users`,
        {
          username: newUsername.trim(),
          password: newPassword,
          role: newRole,
          fullName: newFullName.trim(),
          email: newEmail.trim(),
        },
        "Impossibile creare l'utente."
      );

      setCreateUserMsg("Utente creato con successo.");
      resetCreateUserForm();
      await fetchUsers();
    } catch (err) {
      setCreateUserError(err.message || "Impossibile creare l'utente.");
    } finally {
      setCreateUserLoading(false);
    }
  }

  async function handleToggleUserStatus(adminUser) {
    try {
      setUserActionLoadingId(adminUser._id);
      setUserActionError("");
      setUserActionMsg("");
      setCreateUserError("");
      setCreateUserMsg("");
      setPasswordActionError("");
      setPasswordActionMsg("");

      await authPatch(
        `${BASE_URL}/api/admin/users/${adminUser._id}/status`,
        { isActive: !adminUser.isActive },
        "Impossibile aggiornare lo stato dell'utente."
      );

      setUserActionMsg(
        adminUser.isActive
          ? `Utente ${adminUser.username} disattivato con successo.`
          : `Utente ${adminUser.username} attivato con successo.`
      );

      await fetchUsers();
    } catch (err) {
      setUserActionError(
        err.message || "Impossibile aggiornare lo stato dell'utente."
      );
    } finally {
      setUserActionLoadingId("");
    }
  }

  async function handleToggleUserGeolocation(adminUser) {
    try {
      setUserActionLoadingId(adminUser._id);
      setUserActionError("");
      setUserActionMsg("");

      await authPatch(
        `${BASE_URL}/api/admin/users/${adminUser._id}/geolocation`,
        { geolocationEnabled: adminUser.geolocationEnabled === false },
        "Impossibile aggiornare la geolocalizzazione dell'utente."
      );

      setUserActionMsg(
        adminUser.geolocationEnabled === false
          ? `Geolocalizzazione attivata per ${adminUser.username}.`
          : `Geolocalizzazione disattivata per ${adminUser.username}.`
      );

      await fetchUsers();
    } catch (err) {
      setUserActionError(
        err.message || "Impossibile aggiornare la geolocalizzazione dell'utente."
      );
    } finally {
      setUserActionLoadingId("");
    }
  }

  async function handleDeleteUser(adminUser) {
    try {
      setDeleteUserLoadingId(adminUser._id);
      setUserActionError("");
      setUserActionMsg("");
      setCreateUserError("");
      setCreateUserMsg("");
      setPasswordActionError("");
      setPasswordActionMsg("");

      const data = await authDelete(
        `${BASE_URL}/api/admin/users/${adminUser._id}`,
        "Impossibile eliminare l'utente."
      );

      setUserActionMsg(
        data?.message || `Utente ${adminUser.username} eliminato con successo.`
      );

      setPasswordDrafts((prev) => {
        const updated = { ...prev };
        delete updated[adminUser._id];
        return updated;
      });

      await fetchUsers();
    } catch (err) {
      setUserActionError(err.message || "Impossibile eliminare l'utente.");
    } finally {
      setDeleteUserLoadingId("");
    }
  }

  async function handleChangeUserPassword(adminUser) {
    try {
      const newDraftPassword = String(passwordDrafts[adminUser._id] || "");

      setPasswordActionLoadingId(adminUser._id);
      setPasswordActionError("");
      setPasswordActionMsg("");
      setCreateUserError("");
      setCreateUserMsg("");
      setUserActionError("");
      setUserActionMsg("");

      if (!newDraftPassword.trim()) {
        setPasswordActionError(
          `Inserisci una nuova password per ${adminUser.username}.`
        );
        return;
      }

      await authPatch(
        `${BASE_URL}/api/admin/users/${adminUser._id}/password`,
        { password: newDraftPassword },
        "Impossibile aggiornare la password."
      );

      setPasswordActionMsg(
        `Password aggiornata con successo per ${adminUser.username}.`
      );

      setPasswordDrafts((prev) => ({
        ...prev,
        [adminUser._id]: "",
      }));

      await fetchUsers();
    } catch (err) {
      setPasswordActionError(
        err.message || "Impossibile aggiornare la password."
      );
    } finally {
      setPasswordActionLoadingId("");
    }
  }

  // =========================
  // FETCH RICHIESTE CHIUSURA MANUALE
  // =========================
  const fetchManualClosureRequests = useCallback(async () => {
    try {
      setManualRequestsLoading(true);
      setManualRequestsError("");

      const data = await authGet(
        `${BASE_URL}/api/admin/manual-closure-requests`,
        "Impossibile caricare le richieste di chiusura manuale."
      );

      if (!data) return;

      setManualRequests(data.records || []);
    } catch (err) {
      setManualRequestsError(
        err.message || "Impossibile caricare le richieste di chiusura manuale."
      );
    } finally {
      setManualRequestsLoading(false);
    }
  }, [BASE_URL, authGet]);

  async function handleApproveManualRequest(recordId) {
    try {
      setManualActionLoadingId(recordId);
      setManualActionType("approve");
      setManualRequestsError("");
      setManualRequestsMsg("");

      await authPost(
        `${BASE_URL}/api/admin/manual-closure-requests/${recordId}/approve`,
        {},
        "Impossibile approvare la richiesta."
      );

      setManualRequestsMsg("Richiesta approvata con successo.");

      await fetchManualClosureRequests();
      await refreshAnalyticsAfterAdminAction();
    } catch (err) {
      setManualRequestsError(
        err.message || "Impossibile approvare la richiesta."
      );
    } finally {
      setManualActionLoadingId("");
      setManualActionType("");
    }
  }

  async function handleRejectManualRequest(recordId) {
    try {
      setManualActionLoadingId(recordId);
      setManualActionType("reject");
      setManualRequestsError("");
      setManualRequestsMsg("");

      await authPost(
        `${BASE_URL}/api/admin/manual-closure-requests/${recordId}/reject`,
        {},
        "Impossibile rifiutare la richiesta."
      );

      setManualRequestsMsg("Richiesta rifiutata con successo.");

      await fetchManualClosureRequests();
      await refreshAnalyticsAfterAdminAction();
    } catch (err) {
      setManualRequestsError(
        err.message || "Impossibile rifiutare la richiesta."
      );
    } finally {
      setManualActionLoadingId("");
      setManualActionType("");
    }
  }

  // =========================
  // FETCH RICHIESTE ASSENZE
  // =========================
  const fetchLeaveRequests = useCallback(async () => {
    try {
      setLeaveRequestsLoading(true);
      setLeaveRequestsError("");

      const data = await authGet(
        `${BASE_URL}/api/admin/leave-requests`,
        "Impossibile caricare le richieste di assenza."
      );

      if (!data) return;

      setLeaveRequests(data.leaves || []);
    } catch (err) {
      setLeaveRequestsError(
        err.message || "Impossibile caricare le richieste di assenza."
      );
    } finally {
      setLeaveRequestsLoading(false);
    }
  }, [BASE_URL, authGet]);

  async function fetchApprovedLeavesSummary() {
    try {
      setApprovedLeavesHasSearched(true);
      setApprovedLeavesLoading(true);
      setApprovedLeavesError("");
      setApprovedLeaves([]);

      if (!approvedLeavesFromDate || !approvedLeavesToDate) {
        setApprovedLeavesError("Seleziona il periodo da consultare.");
        return;
      }

      if (approvedLeavesFromDate > approvedLeavesToDate) {
        setApprovedLeavesError(
          "La data iniziale non può essere successiva alla data finale."
        );
        return;
      }

      const params = new URLSearchParams({
        from: approvedLeavesFromDate,
        to: approvedLeavesToDate,
      });

      if (approvedLeavesUsername) {
        params.set("username", approvedLeavesUsername);
      }

      if (approvedLeavesType) {
        params.set("type", approvedLeavesType);
      }

      const data = await authGet(
        `${BASE_URL}/api/admin/approved-leaves?${params.toString()}`,
        "Impossibile caricare il riepilogo ferie/PIR approvati."
      );

      if (!data) return;

      setApprovedLeaves(data.leaves || []);
    } catch (err) {
      setApprovedLeavesError(
        err.message || "Impossibile caricare il riepilogo ferie/PIR approvati."
      );
    } finally {
      setApprovedLeavesLoading(false);
    }
  }

  async function cancelApprovedLeave(leaveId) {
    const rawReason = window.prompt(
      "Inserisci la motivazione dell'annullamento di questa ferie/PIR approvata:"
    );

    if (rawReason === null) return;

    const reviewNote = rawReason.trim();

    if (!reviewNote) {
      setApprovedLeavesError("La motivazione dell'annullamento è obbligatoria.");
      return;
    }

    const confirmed = window.confirm(
      "Confermi l'annullamento di questa ferie/PIR approvata?"
    );

    if (!confirmed) return;

    try {
      setApprovedLeavesLoading(true);
      setApprovedLeavesError("");

      await authPost(
        `${BASE_URL}/api/admin/leave-requests/${leaveId}/cancel`,
        { reviewNote },
        "Impossibile annullare la ferie/PIR approvata."
      );

      await fetchApprovedLeavesSummary();
    } catch (err) {
      setApprovedLeavesError(
        err.message || "Impossibile annullare la ferie/PIR approvata."
      );
    } finally {
      setApprovedLeavesLoading(false);
    }
  }

  // =========================
  // CARICAMENTO INIZIALE
  // =========================
  useEffect(() => {
    fetchUsers();
    fetchManualClosureRequests();
    fetchLeaveRequests();
  }, [fetchUsers, fetchManualClosureRequests, fetchLeaveRequests]);

  async function cancelTimeRecord(recordId) {
    const rawReason = window.prompt(
      "Inserisci la motivazione dell'annullamento di questa timbratura:"
    );

    if (rawReason === null) return;

    const cancelReason = rawReason.trim();

    if (!cancelReason) {
      window.alert("La motivazione dell'annullamento è obbligatoria.");
      return;
    }

    const confirmed = window.confirm(
      "Confermi l'annullamento di questa timbratura? L'operazione resterà tracciata nello storico."
    );

    if (!confirmed) return;

    try {
      setDayError("");

      await authPost(
        `${BASE_URL}/api/admin/records/${recordId}/cancel`,
        { cancelReason },
        "Impossibile annullare la timbratura."
      );

      await refreshAnalyticsAfterAdminAction();
    } catch (err) {
      setDayError(err.message || "Impossibile annullare la timbratura.");
    }
  }

  async function handleApproveLeaveRequest(leaveId) {
    try {
      setLeaveActionLoadingId(leaveId);
      setLeaveActionType("approve");
      setLeaveRequestsError("");
      setLeaveRequestsMsg("");

      await authPost(
        `${BASE_URL}/api/admin/leave-requests/${leaveId}/approve`,
        {},
        "Impossibile approvare la richiesta di assenza."
      );

      setLeaveRequestsMsg("Richiesta assenza approvata con successo.");

      await fetchLeaveRequests();
      await refreshAnalyticsAfterAdminAction();
    } catch (err) {
      setLeaveRequestsError(
        err.message || "Impossibile approvare la richiesta di assenza."
      );
    } finally {
      setLeaveActionLoadingId("");
      setLeaveActionType("");
    }
  }

  async function handleRejectLeaveRequest(leave) {
    const leaveId = leave?._id;

    const reviewNote = window.prompt(
      "Inserisci la motivazione del rifiuto per questa richiesta ferie/PIR:"
    );

    if (reviewNote === null) return;

    const trimmedReviewNote = reviewNote.trim();

    if (!trimmedReviewNote) {
      setLeaveRequestsError(
        "La motivazione del rifiuto è obbligatoria per ferie e PIR."
      );
      return;
    }

    try {
      setLeaveActionLoadingId(leaveId);
      setLeaveActionType("reject");
      setLeaveRequestsError("");
      setLeaveRequestsMsg("");

      await authPost(
        `${BASE_URL}/api/admin/leave-requests/${leaveId}/reject`,
        { reviewNote: trimmedReviewNote },
        "Impossibile rifiutare la richiesta di assenza."
      );

      setLeaveRequestsMsg("Richiesta assenza rifiutata con successo.");

      await fetchLeaveRequests();
      await refreshAnalyticsAfterAdminAction();
    } catch (err) {
      setLeaveRequestsError(
        err.message || "Impossibile rifiutare la richiesta di assenza."
      );
    } finally {
      setLeaveActionLoadingId("");
      setLeaveActionType("");
    }
  }


  // =========================
  // FETCH RIEPILOGO SINGOLO
  // =========================
  async function fetchSummaryForUserAndRange(username, from, to) {
    try {
      setSummaryHasSearched(true);
      setSummaryLoading(true);
      setSummaryError("");
      setSummaryData(null);

      if (!username || !from || !to) {
        setSummaryError("Seleziona un utente e il periodo da analizzare.");
        return;
      }

      if (from > to) {
        setSummaryError(
          "La data iniziale non può essere successiva alla data finale."
        );
        return;
      }

      const data = await authGet(
        `${BASE_URL}/api/admin/summary?username=${encodeURIComponent(
          username
        )}&from=${from}&to=${to}`,
        "Impossibile caricare il riepilogo dell'utente."
      );

      if (!data) return;

      setSummaryData(data);
    } catch (err) {
      setSummaryError(
        err.message || "Impossibile caricare il riepilogo dell'utente."
      );
    } finally {
      setSummaryLoading(false);
    }
  }

  async function fetchSummary() {
    await fetchSummaryForUserAndRange(selectedUsername, fromDate, toDate);
  }

  // =========================
  // FETCH RIEPILOGO MULTIUTENTE
  // =========================
  async function fetchMultiSummary() {
    try {
      setMultiSummaryHasSearched(true);
      setMultiSummaryLoading(true);
      setMultiSummaryError("");
      setMultiSummaryRows([]);
      setExpandedMultiUserIds(new Set());

      if (!multiFromDate || !multiToDate) {
        setMultiSummaryError("Seleziona il periodo da analizzare.");
        return;
      }

      if (multiFromDate > multiToDate) {
        setMultiSummaryError(
          "La data iniziale non può essere successiva alla data finale."
        );
        return;
      }

      const data = await authGet(
        `${BASE_URL}/api/admin/summary-all?from=${multiFromDate}&to=${multiToDate}&includeRecords=true`,
        "Impossibile caricare il riepilogo multiutente."
      );

      if (!data) return;

      setMultiSummaryRows(data.rows || []);
    } catch (err) {
      setMultiSummaryError(
        err.message || "Impossibile caricare il riepilogo multiutente."
      );
    } finally {
      setMultiSummaryLoading(false);
    }
  }

  // =========================
  // FETCH LEAVE DEL MESE PER CALENDARIO ADMIN
  // =========================
  const fetchMonthLeaves = useCallback(async (username, dateInMonth) => {
    try {
      if (
        !username ||
        !(dateInMonth instanceof Date) ||
        Number.isNaN(dateInMonth.getTime())
      ) {
        setMonthLeaves([]);
        return;
      }

      setMonthLeavesLoading(true);

      const { from, to } = getMonthRangeFromDate(dateInMonth);

      const data = await authGet(
        `${BASE_URL}/api/admin/leaves?username=${encodeURIComponent(
          username
        )}&from=${from}&to=${to}`,
        "Impossibile caricare le assenze del mese."
      );

      if (!data) return;

      setMonthLeaves(data.leaves || []);
    } catch {
      setMonthLeaves([]);
    } finally {
      setMonthLeavesLoading(false);
    }
  }, [BASE_URL, authGet]);

  // Refresh leave mensili quando cambia utente o mese visualizzato
  useEffect(() => {
    if (!dayUsername) {
      setMonthLeaves([]);
      return;
    }

    fetchMonthLeaves(dayUsername, activeMonth);
  }, [dayUsername, activeMonth, fetchMonthLeaves]);

  // =========================
  // FETCH DETTAGLIO GIORNALIERO
  // =========================
  async function fetchDayRecords() {
    try {
      setDayHasSearched(true);
      setDayLoading(true);
      setDayError("");
      setDayRecords([]);
      setDayLeaves([]);
      setDayTotalSec(0);

      if (!dayUsername) {
        setDayError("Seleziona un utente per vedere il dettaglio giornaliero.");
        return;
      }

      const dateStr = toRomeYMD(selectedDate);

      const [recordsData, leavesData] = await Promise.all([
        authGet(
          `${BASE_URL}/api/admin/records?username=${encodeURIComponent(
            dayUsername
          )}&date=${dateStr}`,
          "Impossibile caricare il dettaglio giornaliero."
        ),
        authGet(
          `${BASE_URL}/api/admin/leaves?username=${encodeURIComponent(
            dayUsername
          )}&date=${dateStr}`,
          "Impossibile caricare le assenze del giorno."
        ),
      ]);

      if (!recordsData || !leavesData) return;

      setDayRecords(recordsData.records || []);
      setDayLeaves(leavesData.leaves || []);
      setDayTotalSec(recordsData.totalSec || 0);
    } catch (err) {
      setDayError(
        err.message || "Impossibile caricare il dettaglio giornaliero."
      );
    } finally {
      setDayLoading(false);
    }
  }

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.approvedLeavesFromDate,
      approvedLeavesFromDate
    );
  }, [approvedLeavesFromDate]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.approvedLeavesToDate,
      approvedLeavesToDate
    );
  }, [approvedLeavesToDate]);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEYS.approvedLeavesUsername,
      approvedLeavesUsername
    );
  }, [approvedLeavesUsername]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.approvedLeavesType, approvedLeavesType);
  }, [approvedLeavesType]);

  // =========================
  // SUPPORTO EXPORT CSV FRONTEND
  // =========================
  function exportSummaryCsv() {
    if (
      !summaryData ||
      !summaryData.records ||
      summaryData.records.length === 0
    ) {
      return;
    }

    const header = [
      "data",
      "entrata",
      "uscita",
      "durataSec",
      "durataHHMMSS",
      "stato",
    ];

    const rows = summaryData.records.map((record) => {
      const data = record.clockIn ? formatDateIT(record.clockIn) : "";
      const entrata = record.clockIn ? formatDateTimeIT(record.clockIn) : "";
      const uscita = record.clockOut ? formatDateTimeIT(record.clockOut) : "";
      const durataSec = record.durationSec ?? "";
      const durataHHMMSS =
        record.durationSec != null ? formatDuration(record.durationSec) : "";
      const stato = getRecordStatusLabel(record);

      return [data, entrata, uscita, durataSec, durataHHMMSS, stato];
    });

    const csvContent = [header, ...rows]
      .map((row) => row.map(csvEscape).join(";"))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.setAttribute(
      "download",
      `riepilogo_${summaryData.username}_${summaryData.from}_to_${summaryData.to}.csv`
    );

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // =========================
  // LOGOUT
  // =========================
  function handleLogout() {
    logout();
    setShowLogoutMessage(true);

    logoutTimerRef.current = setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1200);
  }

  // =========================
  // CLICK SU RIGA MULTIUTENTE
  // =========================
  function openSingleSummaryFromMulti(username) {
    setSelectedUsername(username);
    setFromDate(multiFromDate);
    setToDate(multiToDate);

    fetchSummaryForUserAndRange(username, multiFromDate, multiToDate);
    triggerSingleSummaryHighlight();

    if (singleSummarySectionRef.current) {
      singleSummarySectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function toggleMultiUserDetails(row) {
    const key = row.userId || row.username;
    if (!key) return;

    setExpandedMultiUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  // =========================
  // DATI DERIVATI
  // =========================
  const normalUsers = useMemo(() => {
    return users.filter((u) => String(u.role).toLowerCase() === "user");
  }, [users]);

  const usersSectionRef = useRef(null);
  const leaveRequestsSectionRef = useRef(null);
  const manualRequestsSectionRef = useRef(null);
  const approvedLeavesSectionRef = useRef(null);

  function scrollToAdminSection(sectionRef) {
    sectionRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const adminQuickSummary = useMemo(() => {
    const activeUsers = normalUsers.filter(
      (adminUser) => adminUser.isActive !== false
    );

    const inactiveUsers = normalUsers.length - activeUsers.length;

    return {
      totalUsers: normalUsers.length,
      activeUsers: activeUsers.length,
      inactiveUsers,
      pendingLeaveRequests: leaveRequests.length,
      pendingManualRequests: manualRequests.length,
      approvedLeavesVisible: approvedLeaves.length,
      isLoading:
        usersLoading ||
        leaveRequestsLoading ||
        manualRequestsLoading ||
        approvedLeavesLoading,
    };
  }, [
    normalUsers,
    leaveRequests,
    manualRequests,
    approvedLeaves,
    usersLoading,
    leaveRequestsLoading,
    manualRequestsLoading,
    approvedLeavesLoading,
  ]);

  const summaryWorkedDays = useMemo(() => {
    if (!summaryData?.records?.length) return 0;

    const uniqueDays = new Set(
      summaryData.records
        .filter((record) => record.clockIn)
        .map((record) => toRomeYMD(new Date(record.clockIn)))
    );

    return uniqueDays.size;
  }, [summaryData]);

  const summaryAverageSecPerDay = useMemo(() => {
    if (!summaryData || summaryWorkedDays === 0) return 0;
    return Math.floor((summaryData.totalSec || 0) / summaryWorkedDays);
  }, [summaryData, summaryWorkedDays]);

  const monthLeaveDaysSet = useMemo(() => {
    return new Set(
      monthLeaves.map((leave) => leave?.dateLabel || "").filter(Boolean)
    );
  }, [monthLeaves]);

  const multiTotals = useMemo(() => {
    const totalRecords = multiSummaryRows.reduce(
      (sum, row) => sum + (row.totalRecords || 0),
      0
    );

    const totalSec = multiSummaryRows.reduce(
      (sum, row) => sum + (row.totalSec || 0),
      0
    );

    const totalWorkedDays = multiSummaryRows.reduce(
      (sum, row) => sum + (row.workedDays || 0),
      0
    );

    const totalMutue = multiSummaryRows.reduce(
      (sum, row) => sum + (row.mutue || 0),
      0
    );

    const totalFerie = multiSummaryRows.reduce(
      (sum, row) => sum + (row.ferie || 0),
      0
    );

    const totalPir = multiSummaryRows.reduce(
      (sum, row) => sum + (row.pir || 0),
      0
    );

    const totalAbsenceDays = multiSummaryRows.reduce(
      (sum, row) => sum + (row.absenceDays || 0),
      0
    );

    return {
      totalRecords,
      totalSec,
      totalWorkedDays,
      totalMutue,
      totalFerie,
      totalPir,
      totalAbsenceDays,
    };
  }, [multiSummaryRows]);

  const summaryHasRecords = (summaryData?.records?.length || 0) > 0;

  const summaryHasLeaves =
    (summaryData?.mutue || 0) > 0 ||
    (summaryData?.ferie || 0) > 0 ||
    (summaryData?.pir || 0) > 0 ||
    (summaryData?.absenceDays || 0) > 0;

  const summaryHasContent = summaryHasRecords || summaryHasLeaves;

  const summaryShouldShowEmptyState =
    summaryHasSearched &&
    !summaryLoading &&
    !summaryError &&
    summaryData &&
    !summaryHasContent;

  const multiSummaryHasRows = multiSummaryRows.length > 0;

  const multiSummaryShouldShowEmptyState =
    multiSummaryHasSearched &&
    !multiSummaryLoading &&
    !multiSummaryError &&
    multiFromDate &&
    multiToDate &&
    !multiSummaryHasRows;

  const dayHasRecords = dayRecords.length > 0;
  const dayHasLeaves = dayLeaves.length > 0;

  const dayShouldShowEmptyState =
    dayHasSearched &&
    !dayLoading &&
    !dayError &&
    !dayHasRecords &&
    !dayHasLeaves;

  const isInitialUsersLoad = usersLoading && users.length === 0;
  const hasBlockingUsersError = !!usersError && users.length === 0;

  // =========================
  // RENDER DI STATO
  // =========================
  if (isInitialUsersLoad) {
    return (
      <div className="homeadmin-container">
        <div className="homeadmin-box">
          <p className="homeadmin-loading-text">
            Caricamento utenti in corso...
          </p>
        </div>
      </div>
    );
  }

  if (hasBlockingUsersError) {
    return (
      <div className="homeadmin-container">
        <div className="homeadmin-box">
          <section className="homeadmin-card homeadmin-empty-state">
            <div className="homeadmin-alert error">
              Non siamo riusciti a caricare gli utenti.
            </div>

            <p className="homeadmin-muted-text">{usersError}</p>

            <button
              className="homeadmin-btn homeadmin-btn-secondary"
              onClick={fetchUsers}
              disabled={usersLoading}
            >
              {usersLoading ? "Riprovo..." : "Riprova"}
            </button>
          </section>
        </div>
      </div>
    );
  }

  // =========================
  // RENDER PRINCIPALE
  // =========================
  return (
    <div className="homeadmin-container">
      <div className="homeadmin-box">
        <div className="homeadmin-header">
          <div>
            <h1 className="homeadmin-title">Area Admin</h1>
            <p className="homeadmin-subtitle">
              Benvenuto{user?.username ? `, ${user.username}` : ""}.
            </p>
          </div>

          <div className="homeadmin-header-actions">
            <button
              className="homeadmin-btn homeadmin-btn-danger"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>

        {showLogoutMessage && (
          <div className="homeadmin-alert success">
            Logout effettuato con successo.
          </div>
        )}

        {isDemoMode && (
          <section className="homeadmin-demo-panel">
            <div className="homeadmin-demo-panel-header">
              <span className="homeadmin-demo-panel-icon">Demo</span>
              <div>
                <p className="homeadmin-demo-panel-kicker">
                  Modalità demo attiva
                </p>
                <h2 className="homeadmin-demo-panel-title">
                  Esplora una dashboard admin con dati realistici
                </h2>
              </div>
            </div>

            <p className="homeadmin-demo-panel-text">
              Questa demo mostra come una piccola azienda può controllare
              presenze, assenze, anomalie e riepiloghi senza usare fogli Excel o
              messaggi sparsi.
            </p>

            <div className="homeadmin-demo-panel-grid">
              <span>Timbrature entrata/uscita</span>
              <span>Ferie, PIR e mutua</span>
              <span>Riepiloghi presenze</span>
              <span>Export CSV</span>
              <span>Chiusure manuali</span>
              <span>Geolocalizzazione nella versione reale</span>
            </div>

            <p className="homeadmin-demo-panel-note">
              Le azioni sensibili sono bloccate per proteggere l&apos;ambiente
              pubblico della demo.
            </p>
          </section>
        )}

        {isDemoMode && (
          <section className="homeadmin-demo-guide">
            <div>
              <span className="homeadmin-demo-guide-kicker">
                Da provare nella demo
              </span>
              <p>
                Parti dal riepilogo rapido, poi esplora richieste assenze,
                gestione utenti, ferie/PIR approvati ed export CSV.
              </p>
            </div>
          </section>
        )}

        <section className="homeadmin-card homeadmin-quick-summary-card homeadmin-card--overview">
          <div className="homeadmin-section-header">
            <div>
              <h2 className="homeadmin-section-title">Riepilogo rapido</h2>
              <p className="homeadmin-muted-text">
                Una vista immediata delle attività principali da controllare.
              </p>
              <p className="homeadmin-contextual-hint">
                Suggerimento: controlla prima assenze e chiusure manuali in attesa, perché richiedono una decisione admin.
              </p>
            </div>

            {adminQuickSummary.isLoading && (
              <span className="homeadmin-quick-summary-loading">Aggiornamento...</span>
            )}
          </div>

          <div className="homeadmin-quick-summary-grid">
            <button
              type="button"
              className="homeadmin-quick-summary-item homeadmin-quick-summary-item--button"
              onClick={() => scrollToAdminSection(usersSectionRef)}
            >
              <div>
                <span className="homeadmin-quick-summary-label">Utenti attivi</span>
                <strong>{adminQuickSummary.activeUsers}</strong>
                <small>{adminQuickSummary.totalUsers} utenti totali</small>
              </div>

              <span className="homeadmin-quick-summary-icon homeadmin-quick-summary-icon--blue">
                👥
              </span>
            </button>

            <button
              type="button"
              className="homeadmin-quick-summary-item homeadmin-quick-summary-item--button"
              onClick={() => scrollToAdminSection(usersSectionRef)}
            >
              <div>
                <span className="homeadmin-quick-summary-label">Utenti disattivati</span>
                <strong>{adminQuickSummary.inactiveUsers}</strong>
                <small>Account non operativi</small>
              </div>

              <span className="homeadmin-quick-summary-icon homeadmin-quick-summary-icon--gray">
                👤
              </span>
            </button>

            <button
              type="button"
              className="homeadmin-quick-summary-item homeadmin-quick-summary-item--button homeadmin-quick-summary-item--warning"
              onClick={() => scrollToAdminSection(leaveRequestsSectionRef)}
            >
              <div>
                <span className="homeadmin-quick-summary-label">Assenze in attesa</span>
                <strong>{adminQuickSummary.pendingLeaveRequests}</strong>
                <small>Ferie/PIR da gestire</small>
              </div>

              <span className="homeadmin-quick-summary-icon homeadmin-quick-summary-icon--orange">
                📅
              </span>
            </button>

            <button
              type="button"
              className="homeadmin-quick-summary-item homeadmin-quick-summary-item--button homeadmin-quick-summary-item--warning"
              onClick={() => scrollToAdminSection(manualRequestsSectionRef)}
            >
              <div>
                <span className="homeadmin-quick-summary-label">Chiusure manuali</span>
                <strong>{adminQuickSummary.pendingManualRequests}</strong>
                <small>Timbrature da verificare</small>
              </div>

              <span className="homeadmin-quick-summary-icon homeadmin-quick-summary-icon--orange">
                🔒
              </span>
            </button>

            <button
              type="button"
              className="homeadmin-quick-summary-item homeadmin-quick-summary-item--button"
              onClick={() => scrollToAdminSection(approvedLeavesSectionRef)}
            >
              <div>
                <span className="homeadmin-quick-summary-label">Approvati visibili</span>
                <strong>{adminQuickSummary.approvedLeavesVisible}</strong>
                <small>Ferie/PIR nel filtro corrente</small>
              </div>

              <span className="homeadmin-quick-summary-icon homeadmin-quick-summary-icon--green">
                ✅
              </span>
            </button>
          </div>
        </section>

        <section
          ref={usersSectionRef}
          className="homeadmin-card homeadmin-card-primary homeadmin-card--users"
        >
          <AdminUsersSection
            users={users}
            usersLoading={usersLoading}
            createUserLoading={createUserLoading}
            createUserError={createUserError}
            createUserMsg={createUserMsg}
            userActionLoadingId={userActionLoadingId}
            deleteUserLoadingId={deleteUserLoadingId}
            userActionError={userActionError}
            userActionMsg={userActionMsg}
            passwordDrafts={passwordDrafts}
            passwordActionLoadingId={passwordActionLoadingId}
            passwordActionError={passwordActionError}
            passwordActionMsg={passwordActionMsg}
            newUsername={newUsername}
            setNewUsername={setNewUsername}
            newPassword={newPassword}
            setNewPassword={setNewPassword}
            newRole={newRole}
            setNewRole={setNewRole}
            newFullName={newFullName}
            setNewFullName={setNewFullName}
            newEmail={newEmail}
            setNewEmail={setNewEmail}
            setPasswordDrafts={setPasswordDrafts}
            fetchUsers={fetchUsers}
            handleCreateUser={handleCreateUser}
            handleToggleUserStatus={handleToggleUserStatus}
            handleToggleUserGeolocation={handleToggleUserGeolocation}
            handleChangeUserPassword={handleChangeUserPassword}
            handleDeleteUser={handleDeleteUser}
            resetCreateUserForm={resetCreateUserForm}
            getUserStatusLabel={getUserStatusLabel}
            getUserStatusBadgeClass={getUserStatusBadgeClass}
            getRoleLabel={getRoleLabel}
            uiLabels={ADMIN_UI_LABELS}
          />
        </section>

        <section
          ref={leaveRequestsSectionRef}
          className="homeadmin-card homeadmin-card-primary homeadmin-card--leave-requests"
        >
          <div className="admin-section-title-row">
            <h2 className="homeadmin-section-title">Richieste assenze</h2>

            <div className="admin-inline-actions">
              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={fetchLeaveRequests}
                disabled={leaveRequestsLoading || leaveActionLoadingId !== ""}
              >
                {leaveRequestsLoading
                  ? "Aggiornamento in corso..."
                  : "Aggiorna richieste"}
              </button>
            </div>
          </div>

          <p className="manual-requests-note">
            Qui trovi le richieste di ferie e PIR in attesa di revisione. Le
            mutue giornaliere, invece, restano auto-approvate.
          </p>

          {leaveRequestsMsg && (
            <div className="homeadmin-alert success">{leaveRequestsMsg}</div>
          )}

          {leaveRequestsError && (
            <div className="homeadmin-alert error">{leaveRequestsError}</div>
          )}

          {leaveRequestsLoading ? (
            <p className="homeadmin-loading-text">
              Caricamento richieste assenze in corso...
            </p>
          ) : leaveRequests.length === 0 ? (
            renderEmptyState("Non ci sono richieste di assenza in attesa.")
          ) : (
            <div className="homeadmin-table-wrapper">
              <table className="homeadmin-table">
                <thead>
                  <tr>
                    <th>Utente</th>
                    <th>Tipo</th>
                    <th>Data</th>
                    <th>{ADMIN_UI_LABELS.fields.status}</th>
                    <th>Nota</th>
                    <th>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {leaveRequests.map((leave) => {
                    const rowLoading = leaveActionLoadingId === leave._id;
                    const isApproving =
                      rowLoading && leaveActionType === "approve";
                    const isRejecting =
                      rowLoading && leaveActionType === "reject";
                    const isAnyLeaveActionRunning = leaveActionLoadingId !== "";

                    return (
                      <tr key={leave._id}>
                        <td>
                          <span className="manual-request-user">
                            {leave.username || leave.user?.username || "-"}
                          </span>
                          <span className="manual-request-subtext">
                            {leave.fullName?.trim() || "Nessun nominativo"}
                          </span>
                        </td>

                        <td>{getLeaveTypeLabel(leave)}</td>

                        <td>{getLeavePeriodLabel(leave)}</td>

                        <td>
                          <span
                            className={`status-badge ${getLeaveStatusBadgeClass(
                              leave
                            )}`}
                          >
                            {getLeaveStatusLabel(leave)}
                          </span>
                        </td>

                        <td className="manual-request-note">
                          {leave.note?.trim() || "-"}
                        </td>

                        <td>
                          <div className="homeadmin-table-actions">
                            <button
                              className="homeadmin-btn homeadmin-btn-success homeadmin-btn-sm"
                              onClick={() =>
                                handleApproveLeaveRequest(leave._id)
                              }
                              disabled={isAnyLeaveActionRunning}
                            >
                              {isApproving
                                ? "Approvazione in corso..."
                                : "Approva"}
                            </button>
                            <button
                              className="homeadmin-btn homeadmin-btn-danger homeadmin-btn-sm"
                              onClick={() => handleRejectLeaveRequest(leave)}
                              disabled={isAnyLeaveActionRunning}
                            >
                              {isRejecting
                                ? "Rifiuto in corso..."
                                : "Rifiuta"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          ref={approvedLeavesSectionRef}
          className="homeadmin-card homeadmin-card-primary homeadmin-card--approved-leaves"
        >
          <div className="admin-section-title-row">
            <h2 className="homeadmin-section-title">Ferie e PIR approvati</h2>

            <div className="admin-inline-actions">
              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={fetchApprovedLeavesSummary}
                disabled={
                  approvedLeavesLoading ||
                  isInvalidRange(approvedLeavesFromDate, approvedLeavesToDate)
                }
              >
                {approvedLeavesLoading ? "Ricerca in corso..." : "Aggiorna riepilogo"}
              </button>
            </div>
          </div>

          <p className="manual-requests-note">
            Consulta le ferie e i PIR già approvati, filtrando per periodo, utente e
            tipo richiesta.
          </p>

          <div className="homeadmin-form">
            <div className="homeadmin-form-row">
              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.from}</label>
                <input
                  className="homeadmin-input"
                  type="date"
                  value={approvedLeavesFromDate}
                  onChange={(e) => setApprovedLeavesFromDate(e.target.value)}
                  disabled={approvedLeavesLoading}
                />
              </div>

              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.to}</label>
                <input
                  className="homeadmin-input"
                  type="date"
                  value={approvedLeavesToDate}
                  onChange={(e) => setApprovedLeavesToDate(e.target.value)}
                  disabled={approvedLeavesLoading}
                />
              </div>

              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.user}</label>
                <select
                  className="homeadmin-select"
                  value={approvedLeavesUsername}
                  onChange={(e) => setApprovedLeavesUsername(e.target.value)}
                  disabled={approvedLeavesLoading}
                >
                  <option value="">Tutti gli utenti</option>
                  {normalUsers.map((u) => (
                    <option key={u._id} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="homeadmin-field">
                <label>Tipo</label>
                <select
                  className="homeadmin-select"
                  value={approvedLeavesType}
                  onChange={(e) => setApprovedLeavesType(e.target.value)}
                  disabled={approvedLeavesLoading}
                >
                  <option value="">Ferie e PIR</option>
                  <option value="ferie">Solo ferie</option>
                  <option value="pir">Solo PIR</option>
                </select>
              </div>
            </div>

            <div className="admin-inline-actions">
              <button
                className="homeadmin-btn homeadmin-btn-primary"
                onClick={fetchApprovedLeavesSummary}
                disabled={
                  approvedLeavesLoading ||
                  !approvedLeavesFromDate ||
                  !approvedLeavesToDate ||
                  isInvalidRange(approvedLeavesFromDate, approvedLeavesToDate)
                }
              >
                {approvedLeavesLoading ? "Ricerca in corso..." : "Cerca approvati"}
              </button>

              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={resetApprovedLeavesFilters}
                disabled={
                  approvedLeavesLoading ||
                  (!approvedLeavesFromDate &&
                    !approvedLeavesToDate &&
                    !approvedLeavesUsername &&
                    !approvedLeavesType &&
                    approvedLeaves.length === 0 &&
                    !approvedLeavesHasSearched)
                }
              >
                Reset filtri
              </button>
            </div>
          </div>

          {approvedLeavesError && (
            <div className="homeadmin-alert error">{approvedLeavesError}</div>
          )}

          {approvedLeavesLoading ? (
            <p className="homeadmin-loading-text">
              Caricamento ferie/PIR approvati in corso...
            </p>
          ) : approvedLeavesHasSearched && approvedLeaves.length === 0 ? (
            renderEmptyState("Non ci sono ferie o PIR approvati nel periodo selezionato.")
          ) : approvedLeaves.length > 0 ? (
            <div className="homeadmin-table-wrapper">
              <table className="homeadmin-table">
                <thead>
                  <tr>
                    <th>Utente</th>
                    <th>Tipo</th>
                    <th>Periodo</th>
                    <th>{ADMIN_UI_LABELS.fields.status}</th>
                    <th>Nota</th>
                    <th>Approvata il</th>
                    <th>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {approvedLeaves.map((leave) => (
                    <tr key={leave._id}>
                      <td>
                        <span className="manual-request-user">
                          {leave.username || leave.user?.username || "-"}
                        </span>
                        <span className="manual-request-subtext">
                          {leave.fullName?.trim() || "Nessun nominativo"}
                        </span>
                      </td>

                      <td>{getLeaveTypeLabel(leave)}</td>

                      <td>{getLeavePeriodLabel(leave)}</td>

                      <td>
                        <span
                          className={`status-badge ${getLeaveStatusBadgeClass(leave)}`}
                        >
                          {getLeaveStatusLabel(leave)}
                        </span>
                      </td>

                      <td className="manual-request-note">
                        {leave.note?.trim() || "-"}
                      </td>

                      <td>
                        {leave.reviewedAt ? formatDateIT(leave.reviewedAt) : "-"}
                      </td>

                      <td>
                        <button
                          className="homeadmin-btn homeadmin-btn-danger"
                          onClick={() => cancelApprovedLeave(leave._id)}
                          disabled={approvedLeavesLoading}
                        >
                          Annulla
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="homeadmin-muted-text">
              Seleziona un periodo e avvia la ricerca per visualizzare ferie e PIR
              approvati.
            </p>
          )}
        </section>

        <section
          ref={manualRequestsSectionRef}
          className="homeadmin-card homeadmin-card-primary homeadmin-card--manual-requests"
        >
          <div className="admin-section-title-row">
            <h2 className="homeadmin-section-title">
              Richieste chiusura manuale
            </h2>

            <div className="admin-inline-actions">
              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={fetchManualClosureRequests}
                disabled={manualRequestsLoading || manualActionLoadingId !== ""}
              >
                {manualRequestsLoading
                  ? "Aggiornamento in corso..."
                  : "Aggiorna richieste"}
              </button>
            </div>
          </div>

          <p className="manual-requests-note">
            Qui trovi le timbrature anomale per cui un dipendente ha proposto
            manualmente un&apos;ora di uscita. Fino a decisione admin,
            l&apos;utente resta bloccato e non può aprire una nuova timbratura.
          </p>

          {manualRequestsMsg && (
            <div className="homeadmin-alert success">{manualRequestsMsg}</div>
          )}

          {manualRequestsError && (
            <div className="homeadmin-alert error">{manualRequestsError}</div>
          )}

          {manualRequestsLoading ? (
            <p className="homeadmin-loading-text">
              Caricamento richieste in corso...
            </p>
          ) : manualRequests.length === 0 ? (
            renderEmptyState(
              "Non ci sono richieste di chiusura manuale in attesa."
            )
          ) : (
            <div className="homeadmin-table-wrapper">
              <table className="homeadmin-table">
                <thead>
                  <tr>
                    <th>Utente</th>
                    <th>Entrata</th>
                    <th>Uscita proposta</th>
                    <th>Durata proposta</th>
                    <th>{ADMIN_UI_LABELS.fields.status}</th>
                    <th>Nota dipendente</th>
                    <th>Azioni</th>
                  </tr>
                </thead>

                <tbody>
                  {manualRequests.map((record) => {
                    const request = record.manualClosureRequest || {};
                    const rowLoading = manualActionLoadingId === record._id;
                    const isApproving =
                      rowLoading && manualActionType === "approve";
                    const isRejecting =
                      rowLoading && manualActionType === "reject";

                    return (
                      <tr key={record._id}>
                        <td>
                          <span className="manual-request-user">
                            {record.username || record.user?.username || "-"}
                          </span>
                          <span className="manual-request-subtext">
                            ID record: {record._id}
                          </span>
                        </td>

                        <td>
                          <span className="manual-request-datetime">
                            {record.clockIn
                              ? formatDateTimeIT(record.clockIn)
                              : "-"}
                          </span>
                        </td>

                        <td>
                          <span className="manual-request-datetime">
                            {request.proposedClockOut
                              ? formatDateTimeIT(request.proposedClockOut)
                              : "-"}
                          </span>
                        </td>

                        <td>
                          <span className="manual-request-duration">
                            {record.proposedDurationHHMMSS ||
                              (record.proposedDurationSec != null
                                ? formatDuration(record.proposedDurationSec)
                                : "-")}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`status-badge ${getRecordStatusBadgeClass(
                              record
                            )}`}
                          >
                            {getRecordStatusLabel(record)}
                          </span>
                        </td>

                        <td className="manual-request-note">
                          {request.note?.trim() || "-"}
                        </td>

                        <td>
                          <div className="homeadmin-table-actions">
                            <button
                              className="homeadmin-btn homeadmin-btn-success homeadmin-btn-sm"
                              onClick={() =>
                                handleApproveManualRequest(record._id)
                              }
                              disabled={rowLoading}
                            >
                              {isApproving
                                ? "Approvazione in corso..."
                                : "Approva"}
                            </button>

                            <button
                              className="homeadmin-btn homeadmin-btn-danger homeadmin-btn-sm"
                              onClick={() =>
                                handleRejectManualRequest(record._id)
                              }
                              disabled={rowLoading}
                            >
                              {isRejecting ? "Rifiuto in corso..." : "Rifiuta"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          ref={singleSummarySectionRef}
          className={`homeadmin-card ${highlightSingleSummary ? "homeadmin-card-highlight" : ""
            }`}
        >
          <h2 className="homeadmin-section-title">Riepilogo periodo utente</h2>

          <div className="homeadmin-form">
            <div className="homeadmin-form-row">
              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.user}</label>
                <select
                  className="homeadmin-select"
                  value={selectedUsername}
                  onChange={(e) => setSelectedUsername(e.target.value)}
                  disabled={summaryLoading}
                >
                  <option value="">Seleziona utente</option>
                  {normalUsers.map((u) => (
                    <option key={u._id} value={u.username}>
                      {u.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.from}</label>
                <input
                  className="homeadmin-input"
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={summaryLoading}
                />
              </div>

              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.to}</label>
                <input
                  className="homeadmin-input"
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={summaryLoading}
                />
              </div>
            </div>

            <div className="admin-inline-actions">
              <button
                className="homeadmin-btn homeadmin-btn-primary"
                onClick={fetchSummary}
                disabled={
                  summaryLoading ||
                  !selectedUsername ||
                  isInvalidRange(fromDate, toDate)
                }
              >
                {summaryLoading ? "Ricerca in corso..." : "Cerca"}
              </button>

              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={resetSummaryFilters}
                disabled={
                  summaryLoading ||
                  (!selectedUsername &&
                    !fromDate &&
                    !toDate &&
                    !summaryData &&
                    !summaryHasSearched)
                }
              >
                Reset filtri
              </button>

              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={exportSummaryCsv}
                disabled={summaryLoading || !summaryHasRecords}
              >
                Esporta CSV
              </button>
            </div>
          </div>

          {summaryError && (
            <div className="homeadmin-alert error">{summaryError}</div>
          )}

          {summaryLoading && (
            <p className="homeadmin-loading-text">
              Ricerca riepilogo in corso...
            </p>
          )}

          {summaryShouldShowEmptyState &&
            renderEmptyState(
              "Nessuna timbratura o assenza trovata per l'utente e il periodo selezionati."
            )}

          {summaryData && !summaryLoading && summaryHasContent && (
            <div className="homeadmin-results-block homeadmin-results-block-user">
              <div className="homeadmin-stat-grid">
                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Utente</p>
                  <p className="homeadmin-stat-value">{summaryData.username}</p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Totale timbrature</p>
                  <p className="homeadmin-stat-value">
                    {summaryData.totalRecords}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Totale ore lavorate</p>
                  <p className="homeadmin-stat-value">
                    {formatDuration(summaryData.totalSec || 0)}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Giorni lavorati</p>
                  <p className="homeadmin-stat-value">{summaryWorkedDays}</p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Media ore / giorno</p>
                  <p className="homeadmin-stat-value">
                    {formatDuration(summaryAverageSecPerDay)}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Mutue</p>
                  <p className="homeadmin-stat-value">
                    {summaryData.mutue || 0}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Ferie</p>
                  <p className="homeadmin-stat-value">
                    {summaryData.ferie || 0}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">PIR</p>
                  <p className="homeadmin-stat-value">
                    {summaryData.pir || 0}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Giorni assenza</p>
                  <p className="homeadmin-stat-value">
                    {summaryData.absenceDays || 0}
                  </p>
                </div>
              </div>

              {summaryHasRecords ? (
                <div className="homeadmin-table-wrapper">
                  <table className="homeadmin-table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Entrata</th>
                        <th>Uscita</th>
                        <th>Durata</th>
                        <th>{ADMIN_UI_LABELS.fields.status}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {summaryData.records.map((record) => (
                        <tr key={record._id}>
                          <td>
                            {record.clockIn
                              ? formatDateIT(record.clockIn)
                              : "-"}
                          </td>
                          <td>
                            {record.clockIn
                              ? formatDateTimeIT(record.clockIn)
                              : "-"}
                          </td>
                          <td>
                            {record.clockOut
                              ? formatDateTimeIT(record.clockOut)
                              : "-"}
                          </td>
                          <td>
                            {record.durationSec != null
                              ? formatDuration(record.durationSec)
                              : "-"}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${getRecordStatusBadgeClass(
                                record
                              )}`}
                            >
                              {getRecordStatusLabel(record)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="homeadmin-muted-text">
                  Nessuna timbratura nel periodo selezionato. Sono presenti solo
                  assenze.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="homeadmin-card homeadmin-card--multi-summary">
          <h2 className="homeadmin-section-title">Riepilogo multiutente</h2>

          <div className="homeadmin-form">
            <div className="homeadmin-form-row">
              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.from}</label>
                <input
                  className="homeadmin-input"
                  type="date"
                  value={multiFromDate}
                  onChange={(e) => setMultiFromDate(e.target.value)}
                  disabled={multiSummaryLoading}
                />
              </div>

              <div className="homeadmin-field">
                <label>{ADMIN_UI_LABELS.fields.to}</label>
                <input
                  className="homeadmin-input"
                  type="date"
                  value={multiToDate}
                  onChange={(e) => setMultiToDate(e.target.value)}
                  disabled={multiSummaryLoading}
                />
              </div>
            </div>

            <div className="admin-inline-actions">
              <button
                className="homeadmin-btn homeadmin-btn-primary"
                onClick={fetchMultiSummary}
                disabled={
                  multiSummaryLoading ||
                  isInvalidRange(multiFromDate, multiToDate)
                }
              >
                {multiSummaryLoading
                  ? "Ricerca in corso..."
                  : "Cerca riepilogo multiutente"}
              </button>

              <button
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={resetMultiSummaryFilters}
                disabled={
                  multiSummaryLoading ||
                  (!multiFromDate &&
                    !multiToDate &&
                    multiSummaryRows.length === 0 &&
                    !multiSummaryHasSearched)
                }
              >
                Reset filtri
              </button>
            </div>
          </div>

          {multiSummaryError && (
            <div className="homeadmin-alert error">{multiSummaryError}</div>
          )}

          {multiSummaryLoading && (
            <p className="homeadmin-loading-text">
              Ricerca riepilogo multiutente in corso...
            </p>
          )}

          {!multiSummaryLoading && !multiSummaryError && multiSummaryHasRows && (
            <div className="homeadmin-results-block homeadmin-results-block-multi">
              <div className="homeadmin-stat-grid">
                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Utenti trovati</p>
                  <p className="homeadmin-stat-value">
                    {multiSummaryRows.length}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Totale timbrature</p>
                  <p className="homeadmin-stat-value">
                    {multiTotals.totalRecords}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Totale ore lavorate</p>
                  <p className="homeadmin-stat-value">
                    {formatDuration(multiTotals.totalSec)}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Somma giorni lavorati</p>
                  <p className="homeadmin-stat-value">
                    {multiTotals.totalWorkedDays}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Mutue</p>
                  <p className="homeadmin-stat-value">
                    {multiTotals.totalMutue}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Ferie</p>
                  <p className="homeadmin-stat-value">
                    {multiTotals.totalFerie}
                  </p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">PIR</p>
                  <p className="homeadmin-stat-value">{multiTotals.totalPir}</p>
                </div>

                <div className="homeadmin-stat-card">
                  <p className="homeadmin-stat-label">Giorni assenza</p>
                  <p className="homeadmin-stat-value">
                    {multiTotals.totalAbsenceDays}
                  </p>
                </div>
              </div>

              <div className="homeadmin-table-wrapper">
                <table className="homeadmin-table">
                  <thead>
                    <tr>
                      <th>Utente</th>
                      <th>{ADMIN_UI_LABELS.fields.timeRecords}</th>
                      <th>{ADMIN_UI_LABELS.fields.workedHours}</th>
                      <th>Giorni lavorati</th>
                      <th>Media / giorno</th>
                      <th>Mutue</th>
                      <th>Ferie</th>
                      <th>PIR</th>
                      <th>Giorni assenza</th>
                      <th>Azioni</th>
                    </tr>
                  </thead>

                  <tbody>
                    {multiSummaryRows.map((row) => {
                      const rowKey = row.userId || row.username;
                      const isExpanded = expandedMultiUserIds.has(rowKey);
                      const records = Array.isArray(row.records)
                        ? row.records
                        : [];

                      return (
                        <Fragment key={rowKey}>
                          <tr>
                            <td>{row.username}</td>
                            <td>{row.totalRecords}</td>
                            <td>
                              {row.totalHHMMSS ||
                                formatDuration(row.totalSec || 0)}
                            </td>
                            <td>{row.workedDays}</td>
                            <td>
                              {row.avgHHMMSS ||
                                formatDuration(row.avgSecPerDay || 0)}
                            </td>
                            <td>{row.mutue || 0}</td>
                            <td>{row.ferie || 0}</td>
                            <td>{row.pir || 0}</td>
                            <td>{row.absenceDays || 0}</td>
                            <td>
                              <div className="homeadmin-table-actions">
                                <button
                                  type="button"
                                  className="homeadmin-btn homeadmin-btn-secondary homeadmin-btn-sm"
                                  onClick={() => toggleMultiUserDetails(row)}
                                  disabled={records.length === 0}
                                >
                                  {isExpanded ? "Nascondi" : "Dettagli"}
                                </button>
                                <button
                                  type="button"
                                  className="homeadmin-btn homeadmin-btn-primary homeadmin-btn-sm"
                                  onClick={() =>
                                    openSingleSummaryFromMulti(row.username)
                                  }
                                >
                                  Apri
                                </button>
                              </div>
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr className="homeadmin-multi-detail-row">
                              <td colSpan="10">
                                {records.length > 0 ? (
                                  <table className="homeadmin-table homeadmin-nested-table">
                                    <thead>
                                      <tr>
                                        <th>Data</th>
                                        <th>Entrata</th>
                                        <th>Uscita</th>
                                        <th>Durata</th>
                                        <th>{ADMIN_UI_LABELS.fields.status}</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {records.map((record) => (
                                        <tr key={record._id}>
                                          <td>
                                            {record.clockIn
                                              ? formatDateIT(record.clockIn)
                                              : "-"}
                                          </td>
                                          <td>
                                            {record.clockIn
                                              ? formatDateTimeIT(record.clockIn)
                                              : "-"}
                                          </td>
                                          <td>
                                            {record.clockOut
                                              ? formatDateTimeIT(
                                                record.clockOut
                                              )
                                              : "-"}
                                          </td>
                                          <td>
                                            {record.effectiveDurationHHMMSS ||
                                              formatDuration(
                                                record.effectiveDurationSec ||
                                                record.durationSec ||
                                                0
                                              )}
                                          </td>
                                          <td>
                                            <span
                                              className={`status-badge ${getRecordStatusBadgeClass(
                                                record
                                              )}`}
                                            >
                                              {getRecordStatusLabel(record)}
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                ) : (
                                  <div className="homeadmin-table-empty">
                                    Nessuna timbratura nel periodo selezionato.
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {multiSummaryShouldShowEmptyState &&
            renderEmptyState("Nessun dato disponibile nel periodo selezionato.")}
        </section>

        <section className="homeadmin-card homeadmin-card--daily-detail">
          <h2 className="homeadmin-section-title">Dettaglio giornaliero</h2>

          <div className="homeadmin-grid">
            <div className="homeadmin-left-column">
              <div className="homeadmin-calendar-wrapper">
                <Calendar
                  onChange={(value) => setSelectedDate(value)}
                  onActiveStartDateChange={({ activeStartDate }) => {
                    if (activeStartDate) {
                      setActiveMonth(activeStartDate);
                    }
                  }}
                  value={selectedDate}
                  locale="it-IT"
                  tileClassName={({ date, view }) => {
                    if (view !== "month") return null;

                    const ymd = toRomeYMD(date);

                    if (monthLeaveDaysSet.has(ymd)) {
                      return "calendar-day-has-leave";
                    }

                    return null;
                  }}
                />
              </div>

              {dayUsername && monthLeavesLoading && (
                <p className="homeadmin-muted-text">
                  Aggiornamento assenze del mese...
                </p>
              )}
            </div>

            <div className="homeadmin-right-column">
              <div className="homeadmin-form">
                <div className="homeadmin-field">
                  <label>{ADMIN_UI_LABELS.fields.user}</label>
                  <select
                    className="homeadmin-select"
                    value={dayUsername}
                    onChange={(e) => setDayUsername(e.target.value)}
                    disabled={dayLoading}
                  >
                    <option value="">Seleziona utente</option>
                    {normalUsers.map((u) => (
                      <option key={u._id} value={u.username}>
                        {u.username}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="homeadmin-field">
                  <label>Data selezionata</label>
                  <input
                    className="homeadmin-input"
                    type="text"
                    value={formatDateIT(selectedDate)}
                    readOnly
                  />
                </div>

                <div className="admin-inline-actions">
                  <button
                    className="homeadmin-btn homeadmin-btn-primary"
                    onClick={fetchDayRecords}
                    disabled={dayLoading || !dayUsername}
                  >
                    {dayLoading
                      ? "Ricerca in corso..."
                      : "Cerca dettaglio giorno"}
                  </button>

                  <button
                    className="homeadmin-btn homeadmin-btn-secondary"
                    onClick={resetDayFilters}
                    disabled={
                      dayLoading ||
                      (!dayUsername &&
                        dayRecords.length === 0 &&
                        dayLeaves.length === 0 &&
                        !dayHasSearched)
                    }
                  >
                    Reset filtri
                  </button>
                </div>
              </div>

              {dayError && (
                <div className="homeadmin-alert error">{dayError}</div>
              )}

              {dayLoading && (
                <p className="homeadmin-loading-text">
                  Ricerca dettaglio giornaliero in corso...
                </p>
              )}

              {dayShouldShowEmptyState &&
                renderEmptyState(
                  "Nessuna timbratura o assenza trovata per il giorno selezionato."
                )}

              {!dayLoading && !dayError && (dayHasRecords || dayHasLeaves) && (
                <>
                  {dayHasLeaves && (
                    <div className="homeadmin-table-wrapper">
                      <table className="homeadmin-table">
                        <thead>
                          <tr>
                            <th>Assenza</th>
                            <th>Data</th>
                            <th>{ADMIN_UI_LABELS.fields.status}</th>
                            <th>Nota</th>
                          </tr>
                        </thead>

                        <tbody>
                          {dayLeaves.map((leave) => (
                            <tr key={leave._id}>
                              <td>{getLeaveTypeLabel(leave)}</td>
                              <td>{getLeavePeriodLabel(leave)}</td>
                              <td>
                                <span
                                  className={`status-badge ${getLeaveStatusBadgeClass(
                                    leave
                                  )}`}
                                >
                                  {getLeaveStatusLabel(leave)}
                                </span>
                              </td>
                              <td>{leave.note?.trim() || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {dayHasRecords && (
                    <div className="homeadmin-table-wrapper">
                      <table className="homeadmin-table">
                        <thead>
                          <tr>
                            <th>Entrata</th>
                            <th>Uscita</th>
                            <th>Durata</th>
                            <th>{ADMIN_UI_LABELS.fields.status}</th>
                            <th>Azioni</th>
                          </tr>
                        </thead>

                        <tbody>
                          {dayRecords.map((record) => (
                            <tr key={record._id}>
                              <td>
                                {record.clockIn
                                  ? formatTimeIT(record.clockIn)
                                  : "-"}
                              </td>
                              <td>
                                {record.clockOut
                                  ? formatTimeIT(record.clockOut)
                                  : "-"}
                              </td>
                              <td>
                                {record.durationSec != null
                                  ? formatDuration(record.durationSec)
                                  : "-"}
                              </td>
                              <td>
                                <span
                                  className={`status-badge ${getRecordStatusBadgeClass(
                                    record
                                  )}`}
                                >
                                  {getRecordStatusLabel(record)}
                                </span>
                              </td>
                              <td>
                                {canCancelTimeRecord(record) ? (
                                  <button
                                    type="button"
                                    className="homeadmin-btn homeadmin-btn-danger homeadmin-btn-sm"
                                    onClick={() => cancelTimeRecord(record._id)}
                                    disabled={dayLoading}
                                  >
                                    Annulla
                                  </button>
                                ) : (
                                  "-"
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <ul className="homeadmin-detail-list">
                    <li className="homeadmin-detail-item">
                      <span className="homeadmin-detail-label">
                        Totale giornata
                      </span>
                      <span className="homeadmin-detail-value">
                        {formatDuration(dayTotalSec || 0)}
                      </span>
                    </li>
                  </ul>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="homeadmin-card homeadmin-settings-card homeadmin-card--settings">
          <div className="homeadmin-section-header">
            <div>
              <h2>Impostazioni ferie/PIR</h2>
              <p>
                Definisci quanti giorni prima un utente deve inviare una richiesta ferie o PIR.
              </p>
            </div>
          </div>

          <form className="homeadmin-settings-form" onSubmit={handleSaveAppSettings}>
            <label className="homeadmin-field">
              <span>Giorni minimi di anticipo</span>
              <input
                type="number"
                min="0"
                max="365"
                step="1"
                value={leaveMinAdvanceDays}
                onChange={(event) => setLeaveMinAdvanceDays(event.target.value)}
                disabled={settingsLoading || settingsSaving}
              />
            </label>

            <label className="homeadmin-field homeadmin-settings-emails-field">
              <span>Email notifiche ferie/PIR</span>
              <textarea
                rows="4"
                value={leaveNotificationEmails}
                onChange={(event) => setLeaveNotificationEmails(event.target.value)}
                disabled={settingsLoading || settingsSaving}
                placeholder={"admin@example.com\nhr@example.com"}
              />
              <small>
                Inserisci massimo 10 indirizzi, separati da virgola o andando a capo.
              </small>
            </label>

            <button
              type="submit"
              className="homeadmin-btn homeadmin-btn-primary"
              disabled={settingsLoading || settingsSaving}
            >
              {settingsSaving ? "Salvataggio..." : "Salva impostazioni"}
            </button>
          </form>

          {settingsLoading && (
            <p className="homeadmin-muted-text">Caricamento impostazioni...</p>
          )}

          {settingsError && (
            <div className="homeadmin-alert error">{settingsError}</div>
          )}

          {settingsMsg && (
            <div className="homeadmin-alert success">{settingsMsg}</div>
          )}
        </section>

        <div className="homeadmin-footer-actions">
          <button
            className="homeadmin-btn homeadmin-btn-secondary"
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          >
            Torna all&apos;inizio
          </button>
        </div>
      </div>
    </div>
  );
}
