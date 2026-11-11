import { useEffect, useLayoutEffect, useState } from "react";
import { ThemeContext } from "../../context/theme-context";
import { applyTheme, cachedTheme, loadAccountTheme, rememberTheme, themeAccount } from "../../utils/themePreferences";
import "./Theme.css";

export default function AccountThemeProvider({ user, authLoading = false, children }) {
  const account = themeAccount(user);
  const [resolved, setResolved] = useState(null);
  const entry = resolved?.account === account ? resolved.entry : cachedTheme(user);
  const pending = Boolean(account && !entry);
  const theme = entry?.theme || "light";
  useEffect(() => {
    let current = true;
    if (account) loadAccountTheme({ username: account }).then(next => {
      if (current) setResolved({ account, entry: next });
    });
    return () => { current = false; };
  }, [account]);
  useLayoutEffect(() => {
    // Preserve the bootstrap color during auth validation or account lookup.
    if (!pending && !(authLoading && !account)) applyTheme(theme);
  }, [theme, pending, authLoading, account]);
  function toggleTheme() {
    if (!account || !entry) return;
    const next = { ...entry, theme: theme === "dark" ? "light" : "dark" };
    rememberTheme(user, next);
    setResolved({ account, entry: next });
  }
  if (pending || (authLoading && !account)) return <div className="theme-loading" role="status">Caricamento Office Clocking...</div>;
  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
