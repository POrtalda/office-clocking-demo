import { useContext } from "react";
import { ThemeContext } from "../../context/theme-context";
import "./Theme.css";
export default function ThemeToggle() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const dark = theme === "dark";
  return <button type="button" className="theme-toggle" onClick={toggleTheme}
    aria-label="Modalità scura" aria-pressed={dark}
    title={dark ? "Attiva modalità chiara" : "Attiva modalità scura"}>
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" focusable="false">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.8 14A9 9 0 0 1 10 3.2 9 9 0 1 0 20.8 14Z" />}
    </svg>
    <span>Tema {dark ? "scuro" : "chiaro"}</span>
  </button>;
}
