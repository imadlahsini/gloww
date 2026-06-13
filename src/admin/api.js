export const ADMIN_FN = "/.netlify/functions/admin";
export const IMGBB_KEY = import.meta.env.VITE_IMGBB_KEY || "";

export async function callAdmin(body) {
  let response;
  try {
    response = await fetch(ADMIN_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Connexion au serveur impossible. Reessayez.");
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error((payload && payload.error) || `Erreur (${response.status})`);
  }
  if (!payload || payload.ok !== true) {
    throw new Error("Reponse inattendue du serveur. Verifiez la configuration.");
  }
  return payload;
}

export async function loadData() {
  const response = await fetch(`/data.json?${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Impossible de charger les donnees (${response.status})`);
  }
  return response.json();
}

export async function uploadPhoto(file) {
  if (!IMGBB_KEY) {
    throw new Error("Upload d'image non active.");
  }
  const formData = new FormData();
  formData.append("image", file);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) throw new Error("Upload impossible");
  const json = await response.json();
  return json.data.url;
}
