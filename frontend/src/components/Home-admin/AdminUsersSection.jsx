import React, { useMemo, useState } from "react";

export default function AdminUsersSection({
  users,
  usersLoading,
  createUserLoading,
  createUserError,
  createUserMsg,
  userActionLoadingId,
  deleteUserLoadingId,
  userActionError,
  userActionMsg,
  passwordDrafts,
  passwordActionLoadingId,
  passwordActionError,
  passwordActionMsg,
  newUsername,
  setNewUsername,
  newPassword,
  setNewPassword,
  newRole,
  setNewRole,
  newFullName,
  setNewFullName,
  newEmail,
  setNewEmail,
  setPasswordDrafts,
  fetchUsers,
  handleCreateUser,
  handleToggleUserStatus,
  handleToggleUserGeolocation,
  handleChangeUserPassword,
  handleDeleteUser,
  resetCreateUserForm,
  getUserStatusLabel,
  getUserStatusBadgeClass,
  getRoleLabel,
  uiLabels,
}) {
  const [userToDelete, setUserToDelete] = useState(null);
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";

  const anyUserRowActionLoading =
    userActionLoadingId !== "" ||
    deleteUserLoadingId !== "" ||
    passwordActionLoadingId !== "";

  const modalDeleteLoading = useMemo(() => {
    if (!userToDelete?._id) return false;
    return deleteUserLoadingId === userToDelete._id;
  }, [deleteUserLoadingId, userToDelete]);

  function openDeleteModal(adminUser) {
    if (anyUserRowActionLoading) return;
    setUserToDelete(adminUser);
  }

  function closeDeleteModal() {
    if (modalDeleteLoading) return;
    setUserToDelete(null);
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return;

    try {
      await handleDeleteUser(userToDelete);
      setUserToDelete(null);
    } catch (error) {
      console.error(error);
    }
  }

  function renderUsersEmptyState() {
    return <p className="homeadmin-muted-text">Nessun utente da mostrare.</p>;
  }

  return (
    <>
      <section className="homeadmin-card">
        <div className="admin-section-title-row">
          <h2 className="homeadmin-section-title">Gestione utenti</h2>

          <div className="admin-inline-actions">
            <button
              className="homeadmin-btn homeadmin-btn-secondary"
              onClick={fetchUsers}
              disabled={
                usersLoading ||
                createUserLoading ||
                userActionLoadingId !== "" ||
                deleteUserLoadingId !== "" ||
                passwordActionLoadingId !== ""
              }
            >
              {usersLoading ? "Aggiornamento in corso..." : "Aggiorna utenti"}
            </button>
          </div>
        </div>

        <p className="manual-requests-note">
          Da qui l&apos;admin può gestire gli utenti aziendali: creare nuovi profili,
          attivarli o disattivarli, aggiornare le password e completare i dati
          anagrafici opzionali.
        </p>

        {isDemoMode && (
          <p className="manual-requests-note">
            Nella demo alcune azioni sensibili possono essere limitate o bloccate per
            proteggere l&apos;ambiente pubblico.
          </p>
        )}

        {createUserMsg && (
          <div className="homeadmin-alert success">{createUserMsg}</div>
        )}
        {createUserError && (
          <div className="homeadmin-alert error">{createUserError}</div>
        )}

        {userActionMsg && (
          <div className="homeadmin-alert success">{userActionMsg}</div>
        )}
        {userActionError && (
          <div className="homeadmin-alert error">{userActionError}</div>
        )}

        {passwordActionMsg && (
          <div className="homeadmin-alert success">{passwordActionMsg}</div>
        )}
        {passwordActionError && (
          <div className="homeadmin-alert error">{passwordActionError}</div>
        )}

        <div className="homeadmin-form" style={{ marginBottom: "24px" }}>
          <div className="homeadmin-form-row">
            <div className="homeadmin-field">
              <label>Username</label>
              <input
                className="homeadmin-input"
                type="text"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                disabled={createUserLoading}
                placeholder="Es. giulia"
              />
            </div>

            <div className="homeadmin-field">
              <label>Password</label>
              <input
                className="homeadmin-input"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={createUserLoading}
                placeholder="Password iniziale"
              />
            </div>

            <div className="homeadmin-field">
              <label>{uiLabels.fields.role}</label>
              <select
                className="homeadmin-select"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                disabled={createUserLoading}
              >
                <option value="user">{getRoleLabel("user")}</option>
                <option value="admin">{getRoleLabel("admin")}</option>
              </select>
            </div>
          </div>

          <div className="homeadmin-form-row">
            <div className="homeadmin-field">
              <label>Full name</label>
              <input
                className="homeadmin-input"
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                disabled={createUserLoading}
                placeholder="Nome e cognome (opzionale)"
              />
            </div>

            <div className="homeadmin-field">
              <label>Email</label>
              <input
                className="homeadmin-input"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                disabled={createUserLoading}
                placeholder="Email (opzionale)"
              />
            </div>
          </div>

          <div className="admin-inline-actions">
            <button
              className="homeadmin-btn homeadmin-btn-primary"
              onClick={handleCreateUser}
              disabled={createUserLoading}
            >
              {createUserLoading ? "Creazione in corso..." : "Crea nuovo utente"}
            </button>

            <button
              className="homeadmin-btn homeadmin-btn-secondary"
              type="button"
              onClick={resetCreateUserForm}
              disabled={createUserLoading || anyUserRowActionLoading}
            >
              Pulisci form
            </button>
          </div>
        </div>

        {usersLoading ? (
          <p className="homeadmin-loading-text">Caricamento utenti in corso...</p>
        ) : users.length === 0 ? (
          renderUsersEmptyState()
        ) : (
          <div className="homeadmin-table-wrapper">
            <table className="homeadmin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>{uiLabels.fields.role}</th>
                  <th>{uiLabels.fields.status}</th>
                  <th>Geolocalizzazione</th>
                  <th>Full name</th>
                  <th>Email</th>
                  <th>Attiva / Disattiva</th>
                  <th>Geo</th>
                  <th>Elimina</th>
                  <th>Cambio password</th>
                </tr>
              </thead>
              <tbody>
                {users.map((adminUser) => {
                  const statusLoading = userActionLoadingId === adminUser._id;
                  const geolocationLoading = userActionLoadingId === adminUser._id;
                  const deleteLoading = deleteUserLoadingId === adminUser._id;
                  const passwordLoading =
                    passwordActionLoadingId === adminUser._id;

                  const rowActionLoading =
                    statusLoading || geolocationLoading || deleteLoading || passwordLoading;

                  return (
                    <tr key={adminUser._id}>
                      <td>{adminUser.username}</td>
                      <td>{getRoleLabel(adminUser.role)}</td>
                      <td>
                        <span
                          className={`status-badge ${getUserStatusBadgeClass(
                            adminUser
                          )}`}
                        >
                          {getUserStatusLabel(adminUser)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`status-badge ${
                            adminUser.geolocationEnabled === false ? "warning" : "success"
                          }`}
                        >
                            {adminUser.geolocationEnabled === false
                            ? "Geo disattivata"
                            : "Geo attiva"}
                        </span>
                      </td>
                      <td>{adminUser.fullName?.trim() || "-"}</td>
                      <td>{adminUser.email?.trim() || "-"}</td>

                      <td>
                        <button
                          className={`homeadmin-btn homeadmin-btn-sm ${
                            adminUser.isActive
                              ? "homeadmin-btn-danger"
                              : "homeadmin-btn-success"
                          }`}
                          onClick={() => handleToggleUserStatus(adminUser)}
                          disabled={rowActionLoading}
                        >
                          {statusLoading
                            ? "Aggiornamento in corso..."
                            : adminUser.isActive
                            ? "Disattiva"
                            : "Attiva"}
                        </button>
                      </td>

                      <td>
                        <button
                          className={`homeadmin-btn homeadmin-btn-sm ${
                            adminUser.geolocationEnabled === false
                              ? "homeadmin-btn-success"
                              : "homeadmin-btn-secondary"
                          }`}
                          onClick={() => handleToggleUserGeolocation(adminUser)}
                          disabled={rowActionLoading}
                        >
                          {geolocationLoading
                            ? "Aggiornamento in corso..."
                            : adminUser.geolocationEnabled === false
                              ? "Attiva geo"
                              : "Disattiva geo"}
                        </button>
                      </td>

                      <td>
                        <button
                          className="homeadmin-btn homeadmin-btn-danger homeadmin-btn-sm"
                          onClick={() => openDeleteModal(adminUser)}
                          disabled={rowActionLoading}
                        >
                          {deleteLoading ? "Eliminazione in corso..." : "Elimina"}
                        </button>
                      </td>

                      <td>
                        <div
                          className="homeadmin-table-actions"
                          style={{ minWidth: "220px" }}
                        >
                          <input
                            className="homeadmin-input"
                            type="password"
                            placeholder="Nuova password"
                            value={passwordDrafts[adminUser._id] || ""}
                            onChange={(e) =>
                              setPasswordDrafts((prev) => ({
                                ...prev,
                                [adminUser._id]: e.target.value,
                              }))
                            }
                            disabled={rowActionLoading}
                          />

                          <button
                            className="homeadmin-btn homeadmin-btn-primary homeadmin-btn-sm"
                            onClick={() => handleChangeUserPassword(adminUser)}
                            disabled={rowActionLoading}
                          >
                            {passwordLoading
                              ? "Salvataggio in corso..."
                              : "Aggiorna"}
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

      {userToDelete && (
        <div className="admin-modal-overlay" onClick={closeDeleteModal}>
          <div
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-user-modal-title"
          >
            <h3 id="delete-user-modal-title" className="admin-modal-title">
              Elimina utente
            </h3>

            <p className="admin-modal-text">
              Stai per eliminare definitivamente l&apos;utente{" "}
              <strong>{userToDelete.username}</strong>.
              <br />
              Questa operazione non può essere annullata.
            </p>

            <div className="admin-modal-actions">
              <button
                type="button"
                className="homeadmin-btn homeadmin-btn-secondary"
                onClick={closeDeleteModal}
                disabled={modalDeleteLoading}
              >
                Annulla
              </button>

              <button
                type="button"
                className="homeadmin-btn homeadmin-btn-danger"
                onClick={confirmDeleteUser}
                disabled={modalDeleteLoading}
              >
                {modalDeleteLoading
                  ? "Eliminazione in corso..."
                  : "Elimina"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
