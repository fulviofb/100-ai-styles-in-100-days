const ROLE_LABEL = {
  hero: "Vídeo",
  midjourney_sheets: "Pranchas Midjourney",
  prompt: "Prompt",
  quote: "Inspiração citada",
};

const REVIEW_LABEL = {
  empty: "vazio",
  discovered_needs_original_review: "descoberta — falta revisar o original",
  reviewed: "revisado",
  inaccessible: "inacessível",
  superseded: "substituído",
};

async function loadCatalog() {
  const res = await fetch("data/catalog.public.json", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar o catálogo");
  return res.json();
}

function byDayMap(days) {
  const map = new Map();
  for (const d of days) {
    const key = Number(d.day);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(d);
  }
  return map;
}

function pickForCell(entries) {
  if (!entries || !entries.length) return null;
  const filled = entries.filter((d) => d.source_review !== "empty");
  return (filled[0] || entries[0]);
}

function renderGrid(catalog) {
  const root = document.getElementById("grid");
  if (!root) return;
  const map = byDayMap(catalog.days);
  const planned = catalog.planned_days || 100;
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= planned; n++) {
    const d = pickForCell(map.get(n));
    const filled = d && d.source_review !== "empty";
    const el = document.createElement(filled ? "a" : "div");
    el.className = "cell" + (filled ? " reviewed" : " empty");
    if (filled) el.href = `dia.html?id=${encodeURIComponent(d.id)}`;
    const name = filled ? (d.style_name || "sem nome") : "—";
    el.innerHTML = `<span class="n">${String(n).padStart(3, "0")}${d && d.variant ? d.variant : ""}</span><span class="name">${escapeHtml(name)}</span>`;
    frag.appendChild(el);
  }
  root.innerHTML = "";
  root.appendChild(frag);
}

function renderIndexes(catalog) {
  const styles = document.getElementById("styles");
  const tools = document.getElementById("tools");
  const filled = catalog.days.filter((d) => d.source_review !== "empty");
  if (styles) {
    const items = [...filled].sort((a, b) => (a.style_name || "").localeCompare(b.style_name || ""));
    styles.innerHTML = items
      .map(
        (d) =>
          `<a href="dia.html?id=${encodeURIComponent(d.id)}">${escapeHtml(d.style_name || "sem nome")} <small>dia ${d.id}</small></a>`
      )
      .join("");
  }
  if (tools) {
    const bag = new Map();
    for (const d of filled) {
      for (const t of d.tools || []) {
        if (!t.name) continue;
        if (!bag.has(t.name)) bag.set(t.name, []);
        bag.get(t.name).push(d);
      }
    }
    tools.innerHTML = [...bag.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(
        ([name, ds]) =>
          `<a href="#">${escapeHtml(name)} <small>${ds.map((d) => d.id).join(", ")}</small></a>`
      )
      .join("");
  }
}

function tweetId(url) {
  if (!url) return "";
  const m = String(url).match(/status\/(\d+)/);
  return m ? m[1] : "";
}

function embedBlock(part) {
  const label = ROLE_LABEL[part.role] || part.role;
  const review = REVIEW_LABEL[part.source_review] || part.source_review;
  const url = part.post_url;
  let body;
  if (url && part.embed) {
    body = `
      <div class="embed-fallback">
        <a class="btn" href="${escapeAttr(url)}" rel="noopener noreferrer">Abrir no X</a>
        <span class="badge">${escapeHtml(review)}</span>
      </div>
      <blockquote class="twitter-tweet"><a href="${escapeAttr(url)}"></a></blockquote>`;
  } else if (url) {
    body = `<div class="embed-fallback"><a class="btn" href="${escapeAttr(url)}" rel="noopener noreferrer">Abrir no X</a><span class="badge">${escapeHtml(review)}</span></div>`;
  } else {
    body = `<p>URL ainda não verificada.</p><span class="badge discovered">${escapeHtml(review)}</span>`;
  }
  const note = part.note ? `<p style="color:var(--muted)">${escapeHtml(part.note)}</p>` : "";
  return `<div class="block"><h3>${escapeHtml(label)}</h3>${note}${body}</div>`;
}

function renderFicha(catalog) {
  const root = document.getElementById("ficha");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const d = catalog.days.find((x) => String(x.id) === String(id));
  if (!d || d.source_review === "empty") {
    root.innerHTML = `<p>Ficha ainda não preenchida.</p><p><a href="index.html">Voltar à grade</a></p>`;
    return;
  }
  document.title = `Dia ${d.id} — ${d.style_name || "sem nome"}`;
  const extra = d.style_name_extra ? ` ${escapeHtml(d.style_name_extra)}` : "";
  const tools = (d.tools || [])
    .filter((t) => t.name)
    .map((t) => t.name + (t.role ? ` (${t.role})` : ""))
    .join(" · ");
  const insp = (d.inspiration || [])
    .map((item) => {
      if (item.quote) {
        const href = item.post_url
          ? `<p><a href="${escapeAttr(item.post_url)}" rel="noopener noreferrer">@${escapeHtml(item.handle || "")} — ${escapeHtml(item.work || "post")}</a></p>`
          : "";
        return `${href}<blockquote class="quote">${escapeHtml(item.quote)}</blockquote>`;
      }
      const bits = [item.work, item.text, item.note].filter(Boolean).join(" — ");
      const link = item.post_url
        ? `<a href="${escapeAttr(item.post_url)}" rel="noopener noreferrer">${escapeHtml(bits || item.post_url)}</a>`
        : escapeHtml(bits);
      return `<p>${link}</p>`;
    })
    .join("");
  const prompt = d.prompt_published
    ? `<div class="block"><h3>Bloco de estilo (citado)</h3><div class="prompt">${escapeHtml(d.prompt_published)}</div></div>`
    : "";
  const curator = d.curator_notes
    ? `<div class="block"><h3>Nota do curador</h3><p>${escapeHtml(d.curator_notes)}</p></div>`
    : "";
  root.innerHTML = `
    <p><a href="index.html">← grade</a></p>
    <span class="badge ${d.source_review === "reviewed" ? "reviewed" : "discovered"}">${escapeHtml(REVIEW_LABEL[d.source_review] || d.source_review)}</span>
    <h2>Dia ${escapeHtml(String(d.id))} — ${escapeHtml(d.style_name || "sem nome")}${extra}</h2>
    <p class="meta">${d.date_utc ? escapeHtml(d.date_utc) : ""} ${tools ? " · " + escapeHtml(tools) : ""}</p>
    ${d.logline ? `<div class="block"><h3>Logline</h3><p>${escapeHtml(d.logline)}</p></div>` : ""}
    ${d.creator_notes ? `<div class="block"><h3>Notas do autor</h3><p>${escapeHtml(d.creator_notes)}</p></div>` : ""}
    ${prompt}
    ${insp ? `<div class="block"><h3>Inspiração</h3>${insp}</div>` : ""}
    <div class="thread">${(d.thread || []).map(embedBlock).join("")}</div>
    ${curator}
    <p><a class="btn" href="${escapeAttr(d.open_on_x)}" rel="noopener noreferrer">Ver o dia no X</a></p>
  `;
  if (window.twttr && window.twttr.widgets) window.twttr.widgets.load();
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

async function boot() {
  try {
    const catalog = await loadCatalog();
    renderGrid(catalog);
    renderIndexes(catalog);
    renderFicha(catalog);
  } catch (e) {
    const box = document.getElementById("grid") || document.getElementById("ficha") || document.getElementById("styles");
    if (box) box.innerHTML = `<p>Não foi possível carregar o catálogo. Sirva a pasta <code>site/</code> via HTTP.</p>`;
    console.error(e);
  }
}

boot();
