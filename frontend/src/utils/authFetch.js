export async function authFetch(url, options = {}, authHelpers) {
  const { handleSessionExpired, navigate } = authHelpers;

  const token = localStorage.getItem("token");

  const mergedOptions = {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  };

  const res = await fetch(url, mergedOptions);

  // Se il token è scaduto o non valido, forzo logout e redirect al login
  if (res.status === 401 || res.status === 403) {
    handleSessionExpired();
    navigate("/login");
    return null;
  }

  return res;
}