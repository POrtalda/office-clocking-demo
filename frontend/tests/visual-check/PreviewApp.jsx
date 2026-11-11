import React, { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../../src/context/auth-context";
import AccountThemeProvider from "../../src/components/Theme/AccountThemeProvider";
import HomeUser from "../../src/components/Home-user/Home-user";
import Storico from "../../src/components/Storico/Storico";
import HomeAdmin from "../../src/components/Home-admin/Home-admin";
import "../../src/index.css";
import "./preview.css";
export default function Preview() {
  const initial = new URLSearchParams(window.location.search);
  const [account, setAccount] = useState(initial.get("account") || "ui-preview-a");
  const [role, setRole] = useState(initial.get("role") || "user");
  function select(nextAccount, nextRole) {
    setAccount(nextAccount); setRole(nextRole);
    window.history.replaceState(null, "", `?account=${encodeURIComponent(nextAccount)}&role=${encodeURIComponent(nextRole)}`);
  }
  const value = { user: { username: account, role: role === "admin" ? "admin" : "user" }, logout() {}, handleSessionExpired() {} };
  return <>
    <aside className="visual-check-controls">
      <strong>Collaudo UI con dati fittizi · database ed email scollegati</strong>
      <label>Account di prova <select value={account} onChange={event => select(event.target.value, role)}><option value="ui-preview-a">Account A</option><option value="ui-preview-b">Account B</option></select></label>
      <label>Pagina di prova <select value={role} onChange={event => select(account, event.target.value)}><option value="user">Home User</option><option value="admin">Home Admin</option><option value="history">Storico</option></select></label>
    </aside>
    <MemoryRouter><AuthContext.Provider value={value}><AccountThemeProvider user={value.user}>{role === "user" ? <HomeUser key={account} /> : role === "admin" ? <HomeAdmin key={account} /> : <Storico key={account} />}</AccountThemeProvider></AuthContext.Provider></MemoryRouter>
  </>;
}
