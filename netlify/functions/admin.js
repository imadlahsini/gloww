// Serverless admin endpoint.
//
// Holds the GitHub token + admin password as server-side environment
// variables so they never ship to the browser. The admin UI POSTs here to
// log in and to publish changes to public/data.json.
//
// Required Netlify environment variables:
//   ADMIN_PASSWORD  - password the admin UI logs in with
//   GITHUB_TOKEN    - GitHub token with Contents read/write on the repo
//   GITHUB_REPO     - target repo in "owner/name" form (e.g. imadlahsini/gloww)

const DATA_PATH = "public/data.json";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Constant-time string compare so the password check doesn't leak length/timing.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export default async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Methode non autorisee." }, 405);
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return json({ error: "ADMIN_PASSWORD non configure sur le serveur." }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Requete invalide." }, 400);
  }

  if (!safeEqual(String(body.password || ""), adminPassword)) {
    return json({ error: "Mot de passe incorrect." }, 401);
  }

  if (body.action === "login") {
    return json({ ok: true });
  }

  if (body.action === "save") {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO;
    if (!token || !repo) {
      return json({ error: "GITHUB_TOKEN ou GITHUB_REPO non configure sur le serveur." }, 500);
    }
    if (!body.data || !Array.isArray(body.data.categories)) {
      return json({ error: "Donnees invalides." }, 400);
    }

    const apiUrl = `https://api.github.com/repos/${repo}/contents/${DATA_PATH}`;
    const ghHeaders = {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "glow-admin",
    };

    // Look up the current file SHA (required by GitHub to update an existing file).
    let sha;
    const getRes = await fetch(apiUrl, { headers: ghHeaders });
    if (getRes.ok) {
      const current = await getRes.json();
      sha = current.sha;
    } else if (getRes.status !== 404) {
      return json({ error: `Lecture GitHub echouee (${getRes.status}).` }, 502);
    }

    const content = Buffer.from(JSON.stringify(body.data, null, 2), "utf-8").toString("base64");
    const putRes = await fetch(apiUrl, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Update salon data via admin",
        content,
        ...(sha ? { sha } : {}),
      }),
    });

    if (!putRes.ok) {
      let detail = "";
      try {
        detail = (await putRes.json())?.message || "";
      } catch {
        // ignore non-JSON error body
      }
      return json({ error: `Sauvegarde GitHub echouee (${putRes.status}). ${detail}`.trim() }, 502);
    }

    const result = await putRes.json();
    return json({ ok: true, sha: result.content?.sha || null });
  }

  return json({ error: "Action inconnue." }, 400);
};
