const BASE_URL = import.meta.env.VITE_API_URL;

function authHeaders() {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function clockIn() {
  const res = await fetch(`${BASE_URL}/api/records/clock-in`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Clock-in fallito");
  return data;
}

export async function clockOut() {
  const res = await fetch(`${BASE_URL}/api/records/clock-out`, {
    method: "POST",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Clock-out fallito");
  return data;
}

export async function getMyRecords(dateYYYYMMDD) {
  const res = await fetch(`${BASE_URL}/api/records/my?date=${dateYYYYMMDD}`, {
    method: "GET",
    headers: authHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Lettura storico fallita");
  return data;
}