(function(){
  "use strict";

  // ---------- helpers
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

  // ---------- hydrate "cas" items from window.cases (if present)
  function mergeCaseFields(stub, full){
    const out = Object.assign({}, stub);
    ["title","thumbnail","theme","note","creator"].forEach(function(k){
      if(!out[k] && full && full[k]) out[k] = full[k];
    });
    if((!out.tags || out.tags.length===0) && full && Array.isArray(full.tags)){
      out.tags = full.tags.slice();
    }
    return out;
  }
  function findCaseById(all, id){
    if(!all) return null;
    if(Array.isArray(all)) return all.find(function(x){ return x && x.id === id; }) || null;
    return all[id] || null;
  }
function hydrateCases(list){
  if(!window.cases) return list;
  // supporte objet ou tableau
  function findCaseById(all,id){ return Array.isArray(all) ? all.find(x=>x&&x.id===id) : all[id]; }
  return list.map(function(it){
    if(((it.type||"").toLowerCase()!=="cas") || !it.id) return it;
    const full = findCaseById(window.cases, it.id);
    return full ? mergeCaseFields(it, full) : it;
  });
}

  // ---------- build filters (from data only)
  function buildFilters(data){
    const controls = $(".controls");
    if(!controls) return;

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
      const t = (it.type||"").toString().trim();
      const th= (it.theme||"").toString().trim();
      if(t)  types.add(t);
      if(th) themes.add(th);
    });

    addOption(typeFilter,  "Tous les types",  "all");
    Array.from(types).sort(function(a,b){ return a.localeCompare(b,"fr"); })
      .forEach(function(t){ addOption(typeFilter, t, t); });

    addOption(themeFilter, "Tous les thèmes", "all");
    Array.from(themes).sort(function(a,b){ return a.localeCompare(b,"fr"); })
      .forEach(function(th){ addOption(themeFilter, th, th); });

    // restore previous selection if available
    if([].some.call(typeFilter.options,  function(o){return o.value===prevType;}))  typeFilter.value  = prevType;  else typeFilter.value  = "all";
    if([].some.call(themeFilter.options, function(o){return o.value===prevTheme;})) themeFilter.value = prevTheme; else themeFilter.value = "all";

    if(!typeFilter.dataset.bound){  typeFilter.addEventListener("change", render);  typeFilter.dataset.bound  = "1"; }
    if(!themeFilter.dataset.bound){ themeFilter.addEventListener("change", render); themeFilter.dataset.bound = "1"; }
  }

  // ---------- card
  function card(it){
    const c = el("article","card");

    // thumbnail selection: explicit > youtube > transparent pixel
    let thumbURL = it.thumbnail || "";
    const yid = ytId(it.url);
    if(!thumbURL && yid) thumbURL = ytThumb(yid);

    const img = el("img","thumb");
    img.alt = it.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = thumbURL || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
    c.appendChild(img);

    const b = el("div","body"); c.appendChild(b);

    const t = el("h3","title"); t.textContent = it.title || "(Sans titre)"; b.appendChild(t);

    const meta = el("div","meta");
    meta.textContent = [it.creator, it.theme, it.session].filter(Boolean).join(" · ");
    b.appendChild(meta);

const badges = el("div","badges");

// Type → filtre "type"
if(it.type){
  const tb = el("button","badge");
  tb.type = "button";
  tb.dataset.filter = "type";
  tb.dataset.value  = it.type;
  tb.textContent    = it.type;
  badges.appendChild(tb);
}

// Thème → filtre "theme"
if(it.theme){
  const thb = el("button","badge");
  thb.type = "button";
  thb.dataset.filter = "theme";
  thb.dataset.value  = it.theme;
  thb.textContent    = it.theme;
  badges.appendChild(thb);
}

// Tags → recherche texte (champ #q)
(it.tags||[]).forEach(function(tag){
  const s = el("button","badge");
  s.type = "button";
  s.dataset.filter = "q";
  s.dataset.value  = tag;
  s.textContent    = tag;
  badges.appendChild(s);
});

b.appendChild(badges);

    if(it.note){ const p = el("p","note"); p.textContent = it.note; b.appendChild(p); }

    const actions = el("div","actions"); b.appendChild(actions);

    const isCase = ((it.type||"").toLowerCase()==="cas");

    const a = el("a","btn");
    if(isCase){
      a.href = "./cas.html?id=" + encodeURIComponent(it.id || "");
      a.target = "_self";
      a.textContent = "Ouvrir le cas";
    } else {
      a.href = it.url || "#";
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "Ouvrir";
    }
    actions.appendChild(a);

    if(yid && !isCase){
      const p = el("a","btn");
      p.href = "https://www.youtube-nocookie.com/embed/"+encodeURIComponent(yid);
      p.target = "_blank";
      p.rel = "noopener noreferrer";
      p.textContent = "Lecteur sans cookies";
      actions.appendChild(p);
    }

    return c;
  }

  // ---------- render (course pages)
  function render(){
    const app = $("#app");
    if(!app) return;

    if(!Array.isArray(window.resources)){
      app.innerHTML = '<p style="padding:12px;border:1px solid var(--border);border-radius:8px">Aucune donnée chargée. Vérifie que le fichier data/&lt;cours&gt;.js est chargé avant assets/script.js.</p>';
      return;
    }

    // copy + hydrate cases
    let data = window.resources.slice();
    data = hydrateCases(data);

    // build/refresh filters
    buildFilters(data);

    const q = $("#q");
    const groupBy    = $("#groupBy");
    const typeFilter = $("#typeFilter");
    const themeFilter= $("#themeFilter");

    const term = norm(q && q.value);
    const typeVal  = typeFilter ? typeFilter.value  : "all";
    const themeVal = themeFilter ? themeFilter.value : "all";

    // filtering
    const items = data.filter(function(it){
      if(typeVal  !== "all" && (it.type  || "") !== typeVal)  return false;
      if(themeVal !== "all" && (it.theme || "") !== themeVal) return false;
      if(!term) return true;
      const hay = [it.title, it.creator, it.theme, it.session, (it.tags||[]).join(" "), (it.note||"")].map(norm).join(" ");
      return hay.indexOf(term) !== -1;
    });

    // group
    const mode = groupBy ? groupBy.value : "session";
    const groups = {};
    if(mode === "none"){
      groups["Toutes les ressources"] = items;
    } else {
      items.forEach(function(it){
        const k = (mode === "theme")
          ? (it.theme  || "Autres thèmes")
          : (mode === "course")
            ? (it.course || "Autres cours")
            : (it.session|| "Sans séance");
        (groups[k] = groups[k] || []).push(it);
      });
    }

    // render groups with numeric-aware sort (Séance 1, 2, ... 10)
    function groupKeySort(a,b){
      const na = parseInt((a||"").match(/\d+/));
      const nb = parseInt((b||"").match(/\d+/));
      if(!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, "fr");
    }

    app.innerHTML = "";
    Object.keys(groups).sort(groupKeySort).forEach(function(groupName){
      const h = el("h2","groupTitle"); h.textContent = groupName; app.appendChild(h);
      const grid = el("div","grid"); app.appendChild(grid);
      groups[groupName].forEach(function(it){ grid.appendChild(card(it)); });
    });
  }

  // ---------- init for course pages
  function initCourse(){
    const yearEl = document.getElementById("year"); if(yearEl) yearEl.textContent = new Date().getFullYear();
    const cm = window.courseMeta || { code:"", title:"Cours" };
    const titleEl = document.getElementById("page-title"); if(titleEl) titleEl.textContent = (cm.code ? cm.code+" — " : "") + cm.title;

    const q = $("#q"); if(q && !q.dataset.bound){ q.addEventListener("input", render); q.dataset.bound = "1"; }
    const gb = $("#groupBy"); if(gb && !gb.dataset.bound){ gb.addEventListener("change", render); gb.dataset.bound = "1"; }


if(!document.body.dataset.badgeBound){
  document.body.addEventListener("click", function(e){
    const btn = e.target.closest(".badge[data-filter]");
    if(!btn) return;
    const t = btn.dataset.filter;
    const v = btn.dataset.value || "";
    if(t === "type"){ const tf = $("#typeFilter"); if(tf){ tf.value = v; } }
    else if(t === "theme"){ const th = $("#themeFilter"); if(th){ th.value = v; } }
    else if(t === "q"){ const q = $("#q"); if(q){ q.value = v; } }
    render();
    try{ window.scrollTo({ top: 0, behavior: "smooth" }); }catch(_){}
  });
  document.body.dataset.badgeBound = "1";
}


    render();
  }

  // ---------- init for cas.html
  function initCase(){
    var root = $("#case-container");
    if(!root) return; // not on cas.html

    function E(tag, cls){ const n=document.createElement(tag); if(cls) n.className=cls; return n; }

    try{
      const id = new URLSearchParams(location.search).get("id") || "";
      const all = window.cases || {};
      let data = findCaseById(all, id);

      if(!data){
        const known = Array.isArray(all) ? all.map(x => x && x.id).filter(Boolean) : Object.keys(all);
        root.innerHTML =
          "<p>Cas introuvable. <strong>id="+(id||"(vide)")+"</strong></p>" +
          "<details style='margin-top:8px'><summary>IDs disponibles</summary><pre style='white-space:pre-wrap'>"+
          (known.length ? known.join(", ") : "(aucun cas chargé)") + "</pre></details>";
        return;
      }

      // main card
      const card = E("article","card");
      const body = E("div","body"); card.appendChild(body);

      // header with compact image
      const header = E("div","case-layout"); // CSS provided in cas.html (or move to style.css)
      body.appendChild(header);

      const img = E("img","thumb thumb--small");
      img.alt = data.title || "";
      img.loading = "lazy"; img.decoding = "async";
      img.src = data.thumbnail || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
      header.appendChild(img);

      const headText = E("div");
      header.appendChild(headText);

      const h = E("h2","title"); h.textContent = data.title || "Cas"; headText.appendChild(h);

      const meta = E("div","meta");
      meta.textContent = [data.subtitle, (data.creator ? "par " + data.creator : "")]
        .filter(Boolean).join(" · ");
      headText.appendChild(meta);

      const badges = E("div","badges");
      if(data.theme){ const b1 = E("span","badge"); b1.textContent = data.theme; badges.appendChild(b1); }
      (data.tags||[]).forEach(function(t){ const b=E("span","badge"); b.textContent=t; badges.appendChild(b); });
      headText.appendChild(badges);

      // body paragraphs
      (data.body||[]).forEach(function(p){
        const para = document.createElement("p"); para.textContent = p; body.appendChild(para);
      });

      // actors (optional)
      if (Array.isArray(data.actors) && data.actors.length){
        const sec = E("div","section");
        const h3 = E("h3","groupTitle"); h3.textContent = "Personnages"; sec.appendChild(h3);
        const grid = E("div","actors"); sec.appendChild(grid);
        data.actors.forEach(function(a){
          const c = E("div","card");
          const t = E("h4","title"); t.textContent = a.name || ""; c.appendChild(t);
          const m = E("div","meta"); m.textContent = a.role || ""; c.appendChild(m);
          if(a.note){ const p = document.createElement("p"); p.textContent = a.note; c.appendChild(p); }
          grid.appendChild(c);
        });
        body.appendChild(sec);
      }

      // questions (optional)
      if (Array.isArray(data.questions) && data.questions.length){
        const sec = E("div","section");
        const h3 = E("h3","groupTitle"); h3.textContent = "Questions de discussion"; sec.appendChild(h3);
        const ol = document.createElement("ol");
        data.questions.forEach(function(q){ const li = document.createElement("li"); li.textContent = q; ol.appendChild(li); });
        sec.appendChild(ol);
        body.appendChild(sec);
      }

      // references (optional)
      if((data.references||[]).length){
        const sec = E("div","section");
        const h3 = E("h3","groupTitle"); h3.textContent = "Références"; sec.appendChild(h3);
        const ul = document.createElement("ul");
        data.references.forEach(function(ref){
          if(!ref) return;
          const li = document.createElement("li");
          if(ref.url){
            const a = document.createElement("a");
            a.href = ref.url; a.target = "_blank"; a.rel="noopener";
            a.textContent = ref.label || ref.url;
            li.appendChild(a);
          } else if(ref.label){
            li.textContent = ref.label;
          }
          ul.appendChild(li);
        });
        sec.appendChild(ul);
        body.appendChild(sec);
      }

      const title = $("#case-title");
      if(title) title.textContent = data.title || "Cas";

      root.appendChild(card);
    }catch(err){
      root.innerHTML = "<pre style='white-space:pre-wrap'>"+(err && err.stack || err) +"</pre>";
      console.error(err);
    }
  }

  // expose in window
  window._course_init = initCourse;
  window._case_init   = initCase;
})();
