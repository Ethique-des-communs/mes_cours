(function(){
  "use strict";

  // -------- helpers
  function $(sel, root){ return (root||document).querySelector(sel); }
  function el(tag, cls){ const n=document.createElement(tag); if(cls) n.className=cls; return n; }
  function norm(s){ return (s||"").toString().toLowerCase(); }
  function addOption(select, label, value){ const o=document.createElement("option"); o.value=value; o.textContent=label; select.appendChild(o); }

  function ytId(url){
    try{
      const u=new URL(url, location.href);
      if(u.hostname.includes("youtu.be")) return u.pathname.slice(1);
      if(u.searchParams.get("v")) return u.searchParams.get("v");
      if(u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2];
    }catch(e){}
    return null;
  }
  function ytThumb(id){ return id ? "https://i.ytimg.com/vi/"+id+"/hqdefault.jpg" : ""; }

  // -------- build filters (only from data)
  function buildFilters(data){
    const controls = $(".controls");
    if(!controls) return { types:new Set(), themes:new Set() };

    let themeFilter = $("#themeFilter");
    if(!themeFilter){ themeFilter = el("select"); themeFilter.id = "themeFilter"; controls.appendChild(themeFilter); }
    let typeFilter = $("#typeFilter");
    if(!typeFilter){ typeFilter = el("select"); typeFilter.id = "typeFilter"; controls.appendChild(typeFilter); }

    const prevType  = typeFilter.value || "all";
    const prevTheme = themeFilter.value || "all";

    typeFilter.innerHTML = "";
    themeFilter.innerHTML = "";

    const types  = new Set();
    const themes = new Set();
    data.forEach(function(it){
      if(!it) return;
      const t  = (it.type  || "").toString().trim();
      const th = (it.theme || "").toString().trim();
      if(t)  types.add(t);
      if(th) themes.add(th);
    });

    addOption(typeFilter,  "Tous les types",  "all");
    Array.from(types).sort(function(a,b){ return a.localeCompare(b,"fr"); })
      .forEach(function(t){ addOption(typeFilter, t, t); });

    addOption(themeFilter, "Tous les thèmes", "all");
    Array.from(themes).sort(function(a,b){ return a.localeCompare(b,"fr"); })
      .forEach(function(th){ addOption(themeFilter, th, th); });

    // restore previous selection if still available
    if([].some.call(typeFilter.options,  function(o){return o.value===prevType;}))  typeFilter.value  = prevType;  else typeFilter.value  = "all";
    if([].some.call(themeFilter.options, function(o){return o.value===prevTheme;})) themeFilter.value = prevTheme; else themeFilter.value = "all";

    if(!typeFilter.dataset.bound){  typeFilter.addEventListener("change", render);  typeFilter.dataset.bound  = "1"; }
    if(!themeFilter.dataset.bound){ themeFilter.addEventListener("change", render); themeFilter.dataset.bound = "1"; }

    return { types, themes };
  }

  // -------- card
  function card(it){
    const c = el("article","card");

let thumbURL = it.thumbnail || "";
  const yid = ytId(it.url);
  if(!thumbURL && yid) thumbURL = ytThumb(yid);

  const img = el("img","thumb");
  img.alt = it.title || "";
  img.loading = "lazy";
  img.decoding = "async";
  // met toujours une source (miniature ou pixel transparent)
  img.src = thumbURL || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
  c.appendChild(img);

    const b = el("div","body");
    c.appendChild(b);

    const t = el("h3","title");
    t.textContent = it.title || "(Sans titre)";
    b.appendChild(t);

    const meta = el("div","meta");
    meta.textContent = [it.creator, it.theme, it.session].filter(Boolean).join(" · ");
    b.appendChild(meta);

    const badges = el("div","badges");
    if(it.type){ const tb = el("span","badge"); tb.textContent = it.type; badges.appendChild(tb); }
    (it.tags||[]).forEach(function(tag){ const s=el("span","badge"); s.textContent=tag; badges.appendChild(s); });
    b.appendChild(badges);

    if(it.note){ const p = el("p","note"); p.textContent = it.note; b.appendChild(p); }

    const actions = el("div","actions");
    b.appendChild(actions);

    const a = el("a","btn");
    a.href = it.url || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = "Ouvrir";
    actions.appendChild(a);

    if(yid){
      const p = el("a","btn");
      p.href = "https://www.youtube-nocookie.com/embed/"+encodeURIComponent(yid);
      p.target = "_blank";
      p.rel = "noopener noreferrer";
      p.textContent = "Lecteur sans cookies";
      actions.appendChild(p);
    }

    return c;
  }

  // -------- render
  function render(){
    const app = $("#app");
    if(!app) return;

    if(!Array.isArray(window.resources)){
      app.innerHTML = '<p style="padding:12px;border:1px solid var(--border);border-radius:8px">Aucune donnée chargée. Vérifie que le fichier data/&lt;cours&gt;.js est chargé avant assets/script.js.</p>';
      return;
    }

    const data = window.resources.slice();

    // build/refresh filters
    buildFilters(data);

    const q = $("#q");
    const groupBy    = $("#groupBy");
    const typeFilter = $("#typeFilter");
    const themeFilter= $("#themeFilter");

    const term = norm(q && q.value);
    const typeVal  = typeFilter ? typeFilter.value  : "all";
    const themeVal = themeFilter ? themeFilter.value : "all";

    const items = data.filter(function(it){
      if(typeVal  !== "all" && (it.type  || "") !== typeVal)  return false;
      if(themeVal !== "all" && (it.theme || "") !== themeVal) return false;
      if(!term) return true;
      const hay = [it.title, it.creator, it.theme, it.session, (it.tags||[]).join(" "), (it.note||"")].map(norm).join(" ");
      return hay.indexOf(term) !== -1;
    });

    const mode = groupBy ? groupBy.value : "session";
    const groups = {};
    if(mode === "none"){
      groups["Toutes les ressources"] = items;
    }else{
      items.forEach(function(it){
        const k = (mode === "theme")
          ? (it.theme  || "Autres thèmes")
          : (mode === "course")
            ? (it.course || "Autres cours")
            : (it.session|| "Sans séance");
        (groups[k] = groups[k] || []).push(it);
      });
    }

    app.innerHTML = "";
    Object.keys(groups).sort(function(a,b){
  // essaie d'extraire un numéro si présent
  const na = parseInt(a.match(/\d+/));
  const nb = parseInt(b.match(/\d+/));
  if(!isNaN(na) && !isNaN(nb)) return na - nb;
  return a.localeCompare(b, "fr");
}).forEach(function(groupName){
      const h = el("h2","groupTitle"); h.textContent = groupName; app.appendChild(h);
      const grid = el("div","grid"); app.appendChild(grid);
      groups[groupName].forEach(function(it){ grid.appendChild(card(it)); });
    });
  }

  // -------- init
  function init(){
    const yearEl = document.getElementById("year"); if(yearEl) yearEl.textContent = new Date().getFullYear();
    const cm = window.courseMeta || { code:"", title:"Cours" };
    const titleEl = document.getElementById("page-title"); if(titleEl) titleEl.textContent = (cm.code ? cm.code+" — " : "") + cm.title;

    const q = $("#q"); if(q && !q.dataset.bound){ q.addEventListener("input", render); q.dataset.bound = "1"; }
    const gb = $("#groupBy"); if(gb && !gb.dataset.bound){ gb.addEventListener("change", render); gb.dataset.bound = "1"; }

    render();
  }

  window._course_init = init;
})();
