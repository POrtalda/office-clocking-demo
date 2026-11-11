import "./OfficeClock.css";
const timeFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dateFormatter = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", year: "numeric" });
export default function OfficeClock({ now, status, navigation }) {
  const parts = timeFormatter.formatToParts(now);
  const part = type => parts.find(item => item.type === type)?.value;
  return (
    <section className="office-clock" aria-label="Orologio timbratore Office Clocking">
      <div className="office-clock-label"><strong>OFFICE CLOCKING</strong><span>EUROPE/ROME</span></div>
      <time className="office-clock-display" dateTime={now.toISOString()} aria-label={timeFormatter.format(now)}>
        <span>{part("hour")}:{part("minute")}</span><span className="office-clock-seconds">:{part("second")}</span>
      </time>
      <p className="office-clock-date">{dateFormatter.format(now)}</p>
      <div className={`office-clock-status office-clock-status--${status.tone || "neutral"}`}>
        <span className="office-clock-status-dot" aria-hidden="true" />
        <div aria-live="polite"><strong>{status.title}</strong><p>{status.description}</p>{status.detail && <small>{status.detail}</small>}</div>
      </div>
      {navigation && <nav className="office-clock-navigation" aria-label="Navigazione rapida utente">{navigation}</nav>}
    </section>
  );
}
