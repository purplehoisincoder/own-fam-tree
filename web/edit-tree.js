// Single-page tree editor. Reads window.FAMILY_DATA (loaded from ../data/family.js).
//
// Design: ALL editing happens in this one page against an in-memory working
// copy, so plain JS state survives for the whole session (no storage, no
// cross-page carrier). Leaving the page without saving discards edits.
// "Save & Download" writes a fresh data/family.js the user drops back into
// the project's data/ folder to make changes permanent.
//
// The `ancestors` field is intentionally dropped on save (nothing reads it;
// parents are derived from each person's `children`).

(function () {
  "use strict";

  // ---- Working copy ----------------------------------------------------
  var source = window.FAMILY_DATA || { "tree-name": "", people: [] };
  var work = JSON.parse(JSON.stringify(source));
  if (!Array.isArray(work.people)) work.people = [];

  var selectedId = null;
  var dirty = false;
  var searchTerm = "";

  var GENDERS = ["", "male", "female", "other"];

  // ---- Small helpers ---------------------------------------------------
  function byId(id) {
    for (var i = 0; i < work.people.length; i++) {
      if (work.people[i].id === id) return work.people[i];
    }
    return null;
  }
  function fullName(p) {
    var n = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
    return n || "(unnamed)";
  }
  function parentsOf(id) {
    return work.people.filter(function (p) {
      return Array.isArray(p.children) && p.children.indexOf(id) !== -1;
    });
  }
  function childrenOf(p) {
    return (p.children || []).map(byId).filter(Boolean);
  }
  function nextId() {
    var max = 0, seen = false;
    work.people.forEach(function (p) {
      var n = parseInt(p.id, 10);
      if (!isNaN(n)) { seen = true; if (n > max) max = n; }
    });
    return seen ? String(max + 1) : String(Date.now());
  }
  function markDirty() { dirty = true; }

  // Tiny DOM builder. children may be a node, string, or array of those.
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") node.className = attrs[k];
        else if (k === "text") node.textContent = attrs[k];
        else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") {
          node.addEventListener(k.slice(2), attrs[k]);
        } else if (attrs[k] != null && attrs[k] !== false) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return node;
  }

  // ---- Left list -------------------------------------------------------
  function renderList() {
    var listEl = document.getElementById("people-list");
    listEl.innerHTML = "";

    var term = searchTerm.trim().toLowerCase();
    var people = work.people.slice().sort(function (a, b) {
      return fullName(a).toLowerCase().localeCompare(fullName(b).toLowerCase());
    });
    if (term) {
      people = people.filter(function (p) {
        return fullName(p).toLowerCase().indexOf(term) !== -1 ||
               String(p.id).toLowerCase().indexOf(term) !== -1;
      });
    }

    if (!people.length) {
      listEl.appendChild(el("li", { class: "list-empty",
        text: term ? "No matches." : "No people yet. Add one." }));
      return;
    }

    people.forEach(function (p) {
      var row = el("button", {
        class: "person-row" + (p.id === selectedId ? " is-active" : ""),
        type: "button",
        onclick: function () { selectPerson(p.id); }
      }, [
        el("span", { class: "row-name", text: fullName(p) }),
        el("span", { class: "row-id", text: "#" + p.id })
      ]);
      listEl.appendChild(el("li", null, row));
    });
  }

  // ---- Right form ------------------------------------------------------
  function selectPerson(id) {
    selectedId = id;
    renderList();
    renderForm();
    var pane = document.getElementById("form-pane");
    if (pane) pane.scrollTop = 0;
  }

  function textField(label, value, span, oninput) {
    var input = el("input", { type: "text", value: value || "" });
    input.addEventListener("input", function () { oninput(input.value); });
    return el("div", { class: "field" + (span ? " span-2" : "") },
      [el("label", { text: label }), input]);
  }

  function renderForm() {
    var pane = document.getElementById("form-pane");
    pane.innerHTML = "";

    var p = byId(selectedId);
    if (!p) {
      pane.appendChild(el("p", { class: "empty-hint",
        text: "Select a person on the left to edit, or add a new one." }));
      return;
    }

    // Header: name + delete
    pane.appendChild(el("div", { class: "form-head" }, [
      el("h2", { text: fullName(p) }),
      el("button", {
        class: "delete-person", type: "button",
        onclick: function () { deletePerson(p.id); }
      }, "Delete person")
    ]));
    pane.appendChild(el("p", { class: "form-id", text: "ID: " + p.id }));

    // --- Basic details ---
    var grid = el("div", { class: "field-grid" });
    grid.appendChild(textField("First name", p.first_name, false, function (v) {
      p.first_name = v; markDirty(); refreshName(p);
    }));
    grid.appendChild(textField("Middle name", p.middle_name, false, function (v) {
      p.middle_name = v; markDirty(); refreshName(p);
    }));
    grid.appendChild(textField("Last name", p.last_name, false, function (v) {
      p.last_name = v; markDirty(); refreshName(p);
    }));

    // Gender select
    var gsel = el("select");
    GENDERS.forEach(function (g) {
      var opt = el("option", { value: g, text: g === "" ? "(unspecified)" : g });
      if ((p.gender || "") === g) opt.selected = true;
      gsel.appendChild(opt);
    });
    gsel.addEventListener("change", function () { p.gender = gsel.value; markDirty(); });
    grid.appendChild(el("div", { class: "field" },
      [el("label", { text: "Gender" }), gsel]));

    // DOB
    var dob = el("input", { type: "date", value: p.dob || "" });
    dob.addEventListener("input", function () { p.dob = dob.value; markDirty(); });
    grid.appendChild(el("div", { class: "field" },
      [el("label", { text: "Date of birth" }), dob]));

    grid.appendChild(textField("Birth country", p.birth_country, false, function (v) {
      p.birth_country = v; markDirty();
    }));

    var details = el("fieldset", null, [el("legend", { text: "Details" }), grid]);
    pane.appendChild(details);

    // --- Relationships ---
    pane.appendChild(buildParents(p));
    pane.appendChild(buildChildren(p));
    pane.appendChild(buildSpouses(p));

    // --- Info / links ---
    pane.appendChild(buildInfo(p));
  }

  // Update the heading + left-list label when a name changes (no full rebuild,
  // so the focused input keeps focus).
  function refreshName(p) {
    var head = document.querySelector(".form-head h2");
    if (head) head.textContent = fullName(p);
    renderList();
  }

  // People eligible to be added to a relation: everyone except self and the
  // ids already excluded (e.g. already related).
  function eligible(selfId, excludeIds) {
    return work.people
      .filter(function (q) {
        return q.id !== selfId && excludeIds.indexOf(q.id) === -1;
      })
      .sort(function (a, b) {
        return fullName(a).toLowerCase().localeCompare(fullName(b).toLowerCase());
      });
  }

  function addRelControl(label, selfId, excludeIds, onPick) {
    var sel = el("select");
    sel.appendChild(el("option", { value: "", text: label }));
    var opts = eligible(selfId, excludeIds);
    opts.forEach(function (q) {
      sel.appendChild(el("option", { value: q.id, text: fullName(q) + " (#" + q.id + ")" }));
    });
    if (!opts.length) {
      sel.disabled = true;
      sel.firstChild.textContent = "No one else available";
    }
    sel.addEventListener("change", function () {
      if (sel.value) { onPick(sel.value); }
    });
    return el("div", { class: "rel-add" }, sel);
  }

  function relItem(person, dateNode, onRemove) {
    var children = [el("span", { class: "rel-name", text: fullName(person) })];
    if (dateNode) children.push(dateNode);
    children.push(el("button", {
      class: "rel-remove", type: "button", title: "Remove", onclick: onRemove
    }, "\u00d7"));
    return el("li", { class: "rel-item" }, children);
  }

  // Parents: derived from other people's `children`. Adding a parent pushes
  // this person's id onto that parent's children list.
  function buildParents(p) {
    var list = el("ul", { class: "rel-list" });
    var parents = parentsOf(p.id);
    if (!parents.length) {
      list = el("p", { class: "rel-empty", text: "No parents linked." });
    } else {
      parents.forEach(function (par) {
        list.appendChild(relItem(par, null, function () {
          par.children = (par.children || []).filter(function (c) { return c !== p.id; });
          markDirty(); renderForm();
        }));
      });
    }
    var exclude = parents.map(function (x) { return x.id; }).concat([p.id]);
    var adder = addRelControl("+ Add parent\u2026", p.id, exclude, function (pid) {
      var par = byId(pid);
      if (!par) return;
      if (!Array.isArray(par.children)) par.children = [];
      if (par.children.indexOf(p.id) === -1) par.children.push(p.id);
      markDirty(); renderForm();
    });
    return el("fieldset", null, [el("legend", { text: "Parents" }), list, adder]);
  }

  // Children: this person's own `children` list.
  function buildChildren(p) {
    if (!Array.isArray(p.children)) p.children = [];
    var kids = childrenOf(p);
    var list = el("ul", { class: "rel-list" });
    if (!kids.length) {
      list = el("p", { class: "rel-empty", text: "No children linked." });
    } else {
      kids.forEach(function (kid) {
        list.appendChild(relItem(kid, null, function () {
          p.children = p.children.filter(function (c) { return c !== kid.id; });
          markDirty(); renderForm();
        }));
      });
    }
    var exclude = p.children.concat([p.id]);
    var adder = addRelControl("+ Add child\u2026", p.id, exclude, function (cid) {
      if (p.children.indexOf(cid) === -1) p.children.push(cid);
      markDirty(); renderForm();
    });
    return el("fieldset", null, [el("legend", { text: "Children" }), list, adder]);
  }

  // Spouses: symmetric {id, date} on both partners.
  function buildSpouses(p) {
    if (!Array.isArray(p.spouses)) p.spouses = [];
    var list = el("ul", { class: "rel-list" });
    if (!p.spouses.length) {
      list = el("p", { class: "rel-empty", text: "No spouses linked." });
    } else {
      p.spouses.forEach(function (sp) {
        var partner = byId(sp.id);
        var name = partner ? fullName(partner) : "(unknown #" + sp.id + ")";
        var dateInput = el("input", { type: "date", value: sp.date || "", title: "Marriage date" });
        dateInput.addEventListener("input", function () {
          setSpouseDate(p, sp.id, dateInput.value);
          markDirty();
        });
        list.appendChild(el("li", { class: "rel-item" }, [
          el("span", { class: "rel-name", text: name }),
          dateInput,
          el("button", {
            class: "rel-remove", type: "button", title: "Remove",
            onclick: function () { removeSpouse(p, sp.id); markDirty(); renderForm(); }
          }, "\u00d7")
        ]));
      });
    }
    var exclude = p.spouses.map(function (s) { return s.id; }).concat([p.id]);
    var adder = addRelControl("+ Add spouse\u2026", p.id, exclude, function (sid) {
      addSpouse(p, sid);
      markDirty(); renderForm();
    });
    return el("fieldset", null, [el("legend", { text: "Spouses" }), list, adder]);
  }

  function addSpouse(p, sid) {
    var partner = byId(sid);
    if (!partner) return;
    if (!Array.isArray(p.spouses)) p.spouses = [];
    if (!Array.isArray(partner.spouses)) partner.spouses = [];
    if (!p.spouses.some(function (s) { return s.id === sid; })) p.spouses.push({ id: sid, date: "" });
    if (!partner.spouses.some(function (s) { return s.id === p.id; })) partner.spouses.push({ id: p.id, date: "" });
  }
  function removeSpouse(p, sid) {
    var partner = byId(sid);
    p.spouses = (p.spouses || []).filter(function (s) { return s.id !== sid; });
    if (partner) partner.spouses = (partner.spouses || []).filter(function (s) { return s.id !== p.id; });
  }
  function setSpouseDate(p, sid, date) {
    (p.spouses || []).forEach(function (s) { if (s.id === sid) s.date = date; });
    var partner = byId(sid);
    if (partner) (partner.spouses || []).forEach(function (s) { if (s.id === p.id) s.date = date; });
  }

  // Info: list of { t?, l? } rows (free text + optional link).
  function buildInfo(p) {
    if (!Array.isArray(p.info)) p.info = [];
    var list = el("ul", { class: "info-list-edit" });
    p.info.forEach(function (bit, idx) {
      var tIn = el("input", { class: "info-text-in", type: "text",
        value: bit.t || "", placeholder: "Note / fact" });
      tIn.addEventListener("input", function () { bit.t = tIn.value; markDirty(); });
      var lIn = el("input", { class: "info-link-in", type: "text",
        value: bit.l || "", placeholder: "Link (optional)" });
      lIn.addEventListener("input", function () { bit.l = lIn.value; markDirty(); });
      list.appendChild(el("li", { class: "info-row" }, [
        tIn, lIn,
        el("button", {
          class: "info-remove", type: "button", title: "Remove",
          onclick: function () { p.info.splice(idx, 1); markDirty(); renderForm(); }
        }, "\u00d7")
      ]));
    });
    var add = el("button", { class: "btn-add-row", type: "button",
      onclick: function () { p.info.push({ t: "", l: "" }); markDirty(); renderForm(); }
    }, "+ Add info row");
    return el("fieldset", null, [el("legend", { text: "Info / links" }), list, add]);
  }

  // ---- Add / delete people --------------------------------------------
  function addPerson() {
    var person = {
      id: nextId(),
      first_name: "", middle_name: "", last_name: "",
      gender: "", dob: "", birth_country: "",
      children: [], spouses: [], info: []
    };
    work.people.push(person);
    markDirty();
    searchTerm = "";
    var searchEl = document.getElementById("search");
    if (searchEl) searchEl.value = "";
    selectPerson(person.id);
    // Focus the first name field for quick entry.
    var first = document.querySelector(".form-pane .field input");
    if (first) first.focus();
  }

  function deletePerson(id) {
    var p = byId(id);
    if (!p) return;
    if (!window.confirm("Delete " + fullName(p) + "? This also removes their links to other people.")) return;

    work.people = work.people.filter(function (q) { return q.id !== id; });
    // Scrub references everywhere.
    work.people.forEach(function (q) {
      if (Array.isArray(q.children)) q.children = q.children.filter(function (c) { return c !== id; });
      if (Array.isArray(q.spouses)) q.spouses = q.spouses.filter(function (s) { return s.id !== id; });
      if (Array.isArray(q.ancestors)) q.ancestors = q.ancestors.filter(function (a) { return a !== id; });
    });
    markDirty();
    if (selectedId === id) selectedId = null;
    renderList();
    renderForm();
  }

  // ---- Save & download -------------------------------------------------
  // Build the clean person record (drops `ancestors`, keeps a stable field
  // order, prunes empty info rows).
  function cleanPerson(p) {
    var out = {
      id: p.id,
      first_name: p.first_name || "",
      middle_name: p.middle_name || "",
      last_name: p.last_name || "",
      gender: p.gender || "",
      dob: p.dob || "",
      birth_country: p.birth_country || "",
      children: (p.children || []).slice(),
      spouses: (p.spouses || []).map(function (s) { return { id: s.id, date: s.date || "" }; })
    };
    var info = (p.info || [])
      .filter(function (b) { return (b.t && b.t.trim()) || (b.l && b.l.trim()); })
      .map(function (b) {
        var o = {};
        if (b.t && b.t.trim()) o.t = b.t;
        if (b.l && b.l.trim()) o.l = b.l;
        return o;
      });
    if (info.length) out.info = info;
    return out;
  }

  function buildFileText() {
    var obj = {};
    Object.keys(work).forEach(function (k) { if (k !== "people") obj[k] = work[k]; });
    obj.people = work.people.map(cleanPerson);

    var header =
      "// SINGLE SOURCE OF TRUTH for family data.\n" +
      "//\n" +
      "// Why a .js file and not a .json file?\n" +
      "// Browsers block fetch()/XHR/ES-module imports of local files when the app is\n" +
      "// opened via file:// (double-click) in Chrome, Safari and Edge (CORS). Loading\n" +
      "// this data through <script src> is the ONLY method that works across all\n" +
      "// browsers with no server. The object below is PURE JSON; edit it like JSON.\n" +
      "//\n" +
      "// This file was generated by the in-app editor (web/edit-tree.html).\n\n" +
      "window.FAMILY_DATA =\n";
    return header + JSON.stringify(obj, null, 2) + ";\n";
  }

  function downloadFile() {
    var blob = new Blob([buildFileText()], { type: "application/javascript" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "family.js";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    dirty = false; // file produced; leaving the page no longer loses work
  }

  // Path to the project's data/ folder (this file lives in <root>/web/).
  function projectDataPath() {
    var p = "";
    try { p = decodeURIComponent(location.pathname); } catch (e) { p = location.pathname; }
    p = p.replace(/\/[^\/]*$/, "");   // strip edit-tree.html -> .../web
    p = p.replace(/\/[^\/]*$/, "");   // strip web -> project root
    p = p + "/data";
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1);      // Windows: /C:/.. -> C:/..
    if (/^[A-Za-z]:/.test(p)) p = p.replace(/\//g, "\\"); // Windows backslashes
    return p || "(unknown)";
  }

  function openSaveModal() {
    downloadFile();
    document.getElementById("data-path").textContent = projectDataPath();
    document.getElementById("save-modal").hidden = false;
  }
  function closeSaveModal() {
    document.getElementById("save-modal").hidden = true;
  }

  // ---- Wire up ---------------------------------------------------------
  document.getElementById("add-person").addEventListener("click", addPerson);
  document.getElementById("save-btn").addEventListener("click", openSaveModal);
  document.getElementById("save-again").addEventListener("click", downloadFile);
  document.getElementById("save-close").addEventListener("click", closeSaveModal);
  document.getElementById("save-modal").addEventListener("click", function (e) {
    if (e.target === this) closeSaveModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !document.getElementById("save-modal").hidden) closeSaveModal();
  });

  var searchInput = document.getElementById("search");
  searchInput.addEventListener("input", function () {
    searchTerm = searchInput.value;
    renderList();
  });

  // Warn before losing unsaved, un-downloaded edits.
  window.addEventListener("beforeunload", function (e) {
    if (dirty) { e.preventDefault(); e.returnValue = ""; }
  });

  // Initial render; honor ?person=<id> deep-link from a detail page.
  renderList();
  var wanted = new URLSearchParams(location.search).get("person");
  if (wanted && byId(wanted)) {
    selectPerson(wanted);
  } else {
    renderForm();
  }
})();
