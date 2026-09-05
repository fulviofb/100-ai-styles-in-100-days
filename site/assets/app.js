const ROLE_LABEL = {
  hero: "Vídeo no X",
  midjourney_sheets: "Pranchas Midjourney",
  prompt: "Prompt no X",
  quote: "Inspiração citada",
};

async function loadCatalog() {
  const res = await fetch("data/catalog.public.json?v=6", { cache: "no-store" });
  if (!res.ok) throw new Error("Falha ao carregar o catálogo");
  return res.json();
}

function filledDays(catalog) {
  return catalog.days
    .filter((d) => d.source_review !== "empty")
    .sort((a, b) => Number(b.day) - Number(a.day) || String(b.variant || "").localeCompare(String(a.variant || "")));
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1600);
}

async function copyText(text, label) {
  if (!text) {
    toast("Este dia ainda não tem prompt publicado");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    toast(label || "Copiado");
  } catch {
    toast("Não deu para copiar — selecione o texto");
  }
}

function copyButton(text, shortLabel) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "copy";
  btn.textContent = shortLabel || "Copiar prompt";
  btn.disabled = !text;
  if (!text) {
    btn.classList.add("ghost");
    btn.textContent = "Sem prompt";
  }
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    copyText(text, "Prompt copiado");
  });
  return btn;
}

function still(url, alt) {
  if (!url) return `<div class="hero-still"></div>`;
  return `<img src="${escapeAttr(url)}" alt="${escapeAttr(alt || "")}" referrerpolicy="no-referrer" loading="lazy">`;
}

function renderGallery(catalog) {
  const root = document.getElementById("gallery");
  if (!root) return;
  const items = filledDays(catalog);
  root.innerHTML = "";
  for (const d of items) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = `dia.html?id=${encodeURIComponent(d.id)}`;
    a.innerHTML = `
      ${still(d.poster_url, d.style_name)}
      <div class="scrim"></div>
      <div class="meta">
        <div class="n">Dia ${escapeHtml(String(d.id))}</div>
        <h2>${escapeHtml(d.style_name || "sem nome")}</h2>
        <p>${escapeHtml(d.logline || "")}</p>
      </div>
    `;
    const actions = document.createElement("div");
    actions.className = "actions";
    actions.appendChild(copyButton(d.prompt_published));
    a.appendChild(actions);
    root.appendChild(a);
  }
}

function renderTicks(catalog) {
  const root = document.getElementById("ticks");
  if (!root) return;
  const map = new Map();
  for (const d of filledDays(catalog)) {
    if (!map.has(Number(d.day))) map.set(Number(d.day), d);
  }
  const planned = catalog.planned_days || 100;
  const frag = document.createDocumentFragment();
  for (let n = 1; n <= planned; n++) {
    const d = map.get(n);
    if (d) {
      const a = document.createElement("a");
      a.href = `dia.html?id=${encodeURIComponent(d.id)}`;
      a.title = `${n} — ${d.style_name || ""}`;
      frag.appendChild(a);
    } else {
      const s = document.createElement("span");
      s.title = String(n);
      frag.appendChild(s);
    }
  }
  root.innerHTML = "";
  root.appendChild(frag);
}

function renderIndexes(catalog) {
  const styles = document.getElementById("styles");
  const tools = document.getElementById("tools");
  const items = filledDays(catalog);
  if (styles) {
    styles.innerHTML = items
      .slice()
      .sort((a, b) => (a.style_name || "").localeCompare(b.style_name || ""))
      .map(
        (d) => `<a href="dia.html?id=${encodeURIComponent(d.id)}">
          ${d.poster_url ? still(d.poster_url, d.style_name) : "<span></span>"}
          <span><strong>${escapeHtml(d.style_name || "sem nome")}</strong><small>dia ${escapeHtml(String(d.id))}</small></span>
        </a>`
      )
      .join("");
  }
  if (tools) {
    const bag = new Map();
    for (const d of items) {
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
          `<a href="#"><span></span><span><strong>${escapeHtml(name)}</strong><small>${ds.map((d) => d.id).join(", ")}</small></span></a>`
      )
      .join("");
  }
}

function embedBlock(part) {
  const label = ROLE_LABEL[part.role] || part.role;
  const url = part.post_url;
  const note = part.note ? `<p style="color:var(--muted)">${escapeHtml(part.note)}</p>` : "";
  const body = url
    ? `<div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
        <a class="btn" href="${escapeAttr(url)}" rel="noopener noreferrer">Abrir no X</a>
        ${part.embed ? `<blockquote class="twitter-tweet"><a href="${escapeAttr(url)}"></a></blockquote>` : ""}
      </div>`
    : `<p style="color:var(--muted)">URL ainda não verificada.</p>`;
  return `<div class="block"><h3>${escapeHtml(label)}</h3>${note}${body}</div>`;
}

function renderFicha(catalog) {
  const root = document.getElementById("ficha");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  const d = catalog.days.find((x) => String(x.id) === String(id));
  if (!d || d.source_review === "empty") {
    root.innerHTML = `<p>Ficha ainda não preenchida.</p><p><a href="index.html">Voltar</a></p>`;
    return;
  }
  document.title = `Dia ${d.id} — ${d.style_name || "sem nome"}`;
  const extra = d.style_name_extra ? ` ${escapeHtml(d.style_name_extra)}` : "";
  const tools = (d.tools || []).filter((t) => t.name).map((t) => t.name).join(" · ");
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

  root.innerHTML = `
    <p><a href="index.html">← galeria</a></p>
    <div class="kicker">Dia ${escapeHtml(String(d.id))} ${tools ? " · " + escapeHtml(tools) : ""}</div>
    <h2>${escapeHtml(d.style_name || "sem nome")}${extra}</h2>
    ${d.logline ? `<p class="logline">${escapeHtml(d.logline)}</p>` : ""}
    <div class="hero-still">${still(d.poster_url, d.style_name)}</div>
    <div class="prompt-box" id="prompt-box">
      <header>
        <h3>Bloco de estilo — copiar</h3>
      </header>
      <p class="prompt-text">${escapeHtml(d.prompt_published || "O autor não publicou bloco de estilo neste dia.")}</p>
    </div>
    ${d.creator_notes ? `<div class="block"><h3>Notas do autor</h3><p>${escapeHtml(d.creator_notes)}</p></div>` : ""}
    ${insp ? `<div class="block"><h3>Inspiração</h3>${insp}</div>` : ""}
    ${(d.thread || []).map(embedBlock).join("")}
    ${d.curator_notes ? `<div class="block"><h3>Nota do curador</h3><p>${escapeHtml(d.curator_notes)}</p></div>` : ""}
    <p><a class="btn" href="${escapeAttr(d.open_on_x)}" rel="noopener noreferrer">Ver o dia no X</a></p>
  `;
  const box = document.getElementById("prompt-box");
  if (box) box.querySelector("header").appendChild(copyButton(d.prompt_published, "Copiar"));
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
    renderGallery(catalog);
    renderTicks(catalog);
    renderIndexes(catalog);
    renderFicha(catalog);
  } catch (e) {
    const box = document.getElementById("gallery") || document.getElementById("ficha") || document.getElementById("styles");
    if (box) box.innerHTML = `<p>Sirva a pasta <code>site/</code> via HTTP para carregar o catálogo.</p>`;
    console.error(e);
  }
}

boot();
