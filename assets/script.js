// Simplified, readable script.js with the same behavior
(function(){
  "use strict";

  // Helpers ---------------------------------------------------------------
  function $(sel, root){ return (root || document).querySelector(sel); }
  function el(tag, cls){ var n = document.createElement(tag); if(cls) n.className = cls; return n; }
  function norm(s){ return (s || "").toString().toLowerCase(); }
  function addOption(select, label, value){ var o = document.createElement("option"); o.value = value; o.textContent = label; select.appendChild(o); }

  // YouTube helpers -------------------------------------------------------
  function ytId(url){
    try{
      var u = new URL(url, location.href);
      if(u.hostname.indexOf("youtu.be") !== -1) return u.pathname.slice(1);
      if(u.searchParams.get("v")) return u.searchParams.get("v");
      if(u.pathname.indexOf("/shorts/") === 0) return u.pathname.split("/")[2];
    }catch(_){/* ignore */}
    return null;
  }
  function ytThumb(id){ return id ? ("https://i.ytimg.com/vi/" + id + "/hqdefault.jpg") : ""; }

  // Cases hydration -------------------------------------------------------
  function mergeCaseFields(stub, full){
    var out = Object.assign({}, stub);
    ["title","thumbnail","theme","note","creator"].forEach(function(k){ if(!out[k] && full && full[k]) out[k] = full[k]; });
    if((!out.tags || out.tags.length === 0) && full && Array.isArray(full.tags)) out.tags = full.tags.slice();
    return out;
  }
  function findCaseById(all, id){
    if(!all) return null;
    if(Array.isArray(all)) return all.find(function(x){ return x && x.id === id; }) || null;
    return all[id] || null;
  }
  function hydrateCases(list){
    if(!window.cases) return list;
    return list.map(function(it){
      if(((it.type || "").toLowerCase() !== "cas") || !it.id) return it;
      var full = findCaseById(window.cases, it.id);
      return full ? mergeCaseFields(it, full) : it;
    });
  }

  // Filters ---------------------------------------------------------------
  function buildFilters(data){
    var controls = $(".controls");
    if(!controls) return;

    var themeFilter = $("#themeFilter");
    if(!themeFilter){ themeFilter = el("select"); themeFilter.id = "themeFilter"; controls.appendChild(themeFilter); }
    var typeFilter = $("#typeFilter");
    if(!typeFilter){ typeFilter = el("select"); typeFilter.id = "typeFilter"; controls.appendChild(typeFilter); }

    var prevType  = typeFilter.value || "all";
    var prevTheme = themeFilter.value || "all";
    typeFilter.innerHTML = "";
    themeFilter.innerHTML = "";

    var types  = new Set();
    var themes = new Set();
    data.forEach(function(it){
      if(!it) return;
      var t  = (it.type  || "").toString().trim();
      var th = (it.theme || "").toString().trim();
      if(t)  types.add(t);
      if(th) themes.add(th);
    });

    addOption(typeFilter,  "Tous les types",  "all");
    Array.from(types).sort(function(a,b){ return a.localeCompare(b, "fr"); }).forEach(function(t){ addOption(typeFilter, t, t); });

    addOption(themeFilter, "Tous les themes", "all");
    Array.from(themes).sort(function(a,b){ return a.localeCompare(b, "fr"); }).forEach(function(th){ addOption(themeFilter, th, th); });

    // Restore previous selection when possible
    typeFilter.value  = ([].some.call(typeFilter.options,  function(o){ return o.value === prevType; }))  ? prevType  : "all";
    themeFilter.value = ([].some.call(themeFilter.options, function(o){ return o.value === prevTheme; })) ? prevTheme : "all";

    if(!typeFilter.dataset.bound){  typeFilter.addEventListener("change", render);  typeFilter.dataset.bound  = "1"; }
    if(!themeFilter.dataset.bound){ themeFilter.addEventListener("change", render); themeFilter.dataset.bound = "1"; }
  }

  // Badge helper ----------------------------------------------------------
  function makeFilterBadge(filterType, value, label){
    var b = el("button", "badge");
    b.type = "button";
    b.dataset.filter = filterType;
    b.dataset.value = value;
    b.textContent = label;
    return b;
  }

  // Card ------------------------------------------------------------------
  function card(it){
    var c = el("article", "card");

    var typeSlug = (it.type || "").toString().trim().toLowerCase().replace(/\s+/g, "-");
    if(typeSlug) c.setAttribute("data-type", typeSlug);

    // Thumbnail: explicit > YouTube > empty SVG
    var thumbURL = it.thumbnail || "";
    var yid = ytId(it.url);
    if(!thumbURL && yid) thumbURL = ytThumb(yid);

    var img = el("img", "thumb");
    img.alt = it.title || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = thumbURL || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
    c.appendChild(img);

    var body = el("div", "body");
    c.appendChild(body);

    var title = el("h3", "title");
    title.textContent = it.title || "(Sans titre)";
    body.appendChild(title);

    var meta = el("div", "meta");
    var metaParts = [it.creator, it.theme, it.session].filter(Boolean);
    meta.textContent = metaParts.join(" - ");
    body.appendChild(meta);

    var badges = el("div", "badges");
    if(it.type)  badges.appendChild(makeFilterBadge("type",  it.type,  it.type));
    if(it.theme) badges.appendChild(makeFilterBadge("theme", it.theme, it.theme));
    (it.tags || []).forEach(function(tag){ badges.appendChild(makeFilterBadge("q", tag, tag)); });
    body.appendChild(badges);

    if(it.note){ var note = el("p", "note"); note.textContent = it.note; body.appendChild(note); }

    var actions = el("div", "actions");
    body.appendChild(actions);

    var isCase = ((it.type || "").toLowerCase() === "cas");
    var open = el("a", "btn");
    if(isCase){
      open.href = "./cas.html?id=" + encodeURIComponent(it.id || "");
      open.target = "_self";
      open.textContent = "Ouvrir le cas";
    } else {
      open.href = it.url || "#";
      open.target = "_blank";
      open.rel = "noopener noreferrer";
      open.textContent = "Ouvrir";
    }
    actions.appendChild(open);

    if(yid && !isCase){
      var privacy = el("a", "btn");
      privacy.href = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(yid);
      privacy.target = "_blank";
      privacy.rel = "noopener noreferrer";
      privacy.textContent = "Lecteur sans cookies";
      actions.appendChild(privacy);
    }

    return c;
  }

  // Render (course pages) -------------------------------------------------
  function render(){
    var app = $("#app");
    if(!app) return;

    if(!Array.isArray(window.resources)){
      app.innerHTML = '<p style="padding:12px;border:1px solid var(--border);border-radius:8px">Aucune donnee chargee. Verifie que le fichier data/<cours>.js est charge avant assets/script.js.</p>';
      return;
    }

    // Data copy + hydrate cases
    var data = hydrateCases(window.resources.slice());

    // Build/refresh filters
    buildFilters(data);

    var q = $("#q");
    var groupBy = $("#groupBy");
    var typeFilter = $("#typeFilter");
    var themeFilter = $("#themeFilter");

    var term = norm(q && q.value);
    var typeVal  = typeFilter ? typeFilter.value  : "all";
    var themeVal = themeFilter ? themeFilter.value : "all";

    // Filtering
    var items = data.filter(function(it){
      if(typeVal  !== "all" && (it.type  || "") !== typeVal)  return false;
      if(themeVal !== "all" && (it.theme || "") !== themeVal) return false;
      if(!term) return true;
      var hay = [it.title, it.creator, it.theme, it.session, (it.tags || []).join(" "), (it.note || "")] 
        .map(norm).join(" ");
      return hay.indexOf(term) !== -1;
    });

    // Grouping
    var mode = groupBy ? groupBy.value : "session";
    var groups = {};
    if(mode === "none"){
      groups["Toutes les ressources"] = items;
    } else {
      items.forEach(function(it){
        var key = (mode === "theme")
          ? (it.theme  || "Autres themes")
          : (mode === "course")
            ? (it.course || "Autres cours")
            : (it.session || "Sans seance");
        (groups[key] = groups[key] || []).push(it);
      });
    }

    // Numeric-aware sort (Seance 1, 2, ... 10)
    function groupKeySort(a, b){
      var na = parseInt((a || "").match(/\d+/));
      var nb = parseInt((b || "").match(/\d+/));
      if(!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b, "fr");
    }

    app.innerHTML = "";
    Object.keys(groups).sort(groupKeySort).forEach(function(name){
      var h = el("h2", "groupTitle"); h.textContent = name; app.appendChild(h);
      var grid = el("div", "grid"); app.appendChild(grid);
      groups[name].forEach(function(it){ grid.appendChild(card(it)); });
    });
  }

  // Init for course pages -------------------------------------------------
  function initCourse(){
    var yearEl = document.getElementById("year"); if(yearEl) yearEl.textContent = new Date().getFullYear();
    var cm = window.courseMeta || { code: "", title: "Cours" };
    var titleEl = document.getElementById("page-title"); if(titleEl) titleEl.textContent = (cm.code ? (cm.code + " - ") : "") + cm.title;

    var q = $("#q"); if(q && !q.dataset.bound){ q.addEventListener("input", render); q.dataset.bound = "1"; }
    var gb = $("#groupBy"); if(gb && !gb.dataset.bound){ gb.addEventListener("change", render); gb.dataset.bound = "1"; }

    if(!document.body.dataset.badgeBound){
      document.body.addEventListener("click", function(e){
        var btn = e.target.closest(".badge[data-filter]");
        if(!btn) return;
        var t = btn.dataset.filter;
        var v = btn.dataset.value || "";
        if(t === "type"){ var tf = $("#typeFilter"); if(tf){ tf.value = v; } }
        else if(t === "theme"){ var th = $("#themeFilter"); if(th){ th.value = v; } }
        else if(t === "q"){ var qi = $("#q"); if(qi){ qi.value = v; } }
        render();
        try{ window.scrollTo({ top: 0, behavior: "smooth" }); }catch(_){/* no-op */}
      });
      document.body.dataset.badgeBound = "1";
    }

    render();
  }

  // Init for cas.html -----------------------------------------------------
  function initCase(){
    var root = $("#case-container");
    if(!root) return; // not on cas.html

    function E(tag, cls){ var n = document.createElement(tag); if(cls) n.className = cls; return n; }

    try{
      var id = new URLSearchParams(location.search).get("id") || "";
      var all = window.cases || {};
      var data = findCaseById(all, id);

      if(!data){
        var known = Array.isArray(all) ? all.map(function(x){ return x && x.id; }).filter(Boolean) : Object.keys(all);
        root.innerHTML = "<p>Cas introuvable. <strong>id=" + (id || "(vide)") + "</strong></p>"
          + "<details style='margin-top:8px'><summary>IDs disponibles</summary><pre style='white-space:pre-wrap'>"
          + (known.length ? known.join(", ") : "(aucun cas charge)") + "</pre></details>";
        return;
      }

      // main card
      var card = E("article", "card");
      var body = E("div", "body"); card.appendChild(body);

      // header with compact image
      var header = E("div", "case-layout");
      body.appendChild(header);

      var img = E("img", "thumb thumb--small");
      img.alt = data.title || "";
      img.loading = "lazy"; img.decoding = "async";
      img.src = data.thumbnail || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg'/>";
      header.appendChild(img);

      var headText = E("div");
      header.appendChild(headText);

      var h = E("h2", "title"); h.textContent = data.title || "Cas"; headText.appendChild(h);

      var meta = E("div", "meta");
      var meta2 = [data.subtitle, (data.creator ? ("par " + data.creator) : "")].filter(Boolean);
      meta.textContent = meta2.join(" - ");
      headText.appendChild(meta);

      var badges = E("div", "badges");
      if(data.theme){ var b1 = E("span", "badge"); b1.textContent = data.theme; badges.appendChild(b1); }
      (data.tags || []).forEach(function(t){ var b = E("span", "badge"); b.textContent = t; badges.appendChild(b); });
      headText.appendChild(badges);

      // body paragraphs
      (data.body || []).forEach(function(p){ var para = document.createElement("p"); para.textContent = p; body.appendChild(para); });

      // actors (optional)
      if(Array.isArray(data.actors) && data.actors.length){
        var sec = E("div", "section");
        var h3 = E("h3", "groupTitle"); h3.textContent = "Personnages"; sec.appendChild(h3);
        var grid = E("div", "actors"); sec.appendChild(grid);
        data.actors.forEach(function(a){
          var c = E("div", "card");
          var t = E("h4", "title"); t.textContent = a.name || ""; c.appendChild(t);
          var m = E("div", "meta"); m.textContent = a.role || ""; c.appendChild(m);
          if(a.note){ var p = document.createElement("p"); p.textContent = a.note; c.appendChild(p); }
          grid.appendChild(c);
        });
        body.appendChild(sec);
      }

      // questions (optional)
      if(Array.isArray(data.questions) && data.questions.length){
        var qsec = E("div", "section");
        var qh3 = E("h3", "groupTitle"); qh3.textContent = "Questions de discussion"; qsec.appendChild(qh3);
        var ol = document.createElement("ol");
        data.questions.forEach(function(q){ var li = document.createElement("li"); li.textContent = q; ol.appendChild(li); });
        qsec.appendChild(ol);
        body.appendChild(qsec);
      }

      // references (optional)
      if((data.references || []).length){
        var rsec = E("div", "section");
        var rh3 = E("h3", "groupTitle"); rh3.textContent = "References"; rsec.appendChild(rh3);
        var ul = document.createElement("ul");
        data.references.forEach(function(ref){
          if(!ref) return;
          var li = document.createElement("li");
          if(ref.url){
            var a = document.createElement("a");
            a.href = ref.url; a.target = "_blank"; a.rel = "noopener";
            a.textContent = ref.label || ref.url;
            li.appendChild(a);
          } else if(ref.label){
            li.textContent = ref.label;
          }
          ul.appendChild(li);
        });
        rsec.appendChild(ul);
        body.appendChild(rsec);
      }

      var titleEl = $("#case-title");
      if(titleEl) titleEl.textContent = data.title || "Cas";

      root.appendChild(card);
    }catch(err){
      root.innerHTML = "<pre style='white-space:pre-wrap'>" + (err && err.stack || err) + "</pre>";
      console.error(err);
    }
  }

  // Expose ---------------------------------------------------------------
  window._course_init = initCourse;
  window._case_init   = initCase;
})();

