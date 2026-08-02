// Main page logic. Reads window.FAMILY_DATA (loaded from data/family.js).
// This file lives in web/, but is included by family-tree.html at the ROOT,
// so link/asset paths below are written relative to the ROOT.

(function () {
  "use strict";

  var data = window.FAMILY_DATA;

  // ---- Layout constants (world/pixel space) ---------------------------
  var NODE_W = 120;      // node width
  var NODE_H = 116;      // node height (photo + name)
  var ROW = 200;         // vertical distance between generation tops
  var COL = 300;         // horizontal distance between leaf columns
  var COUPLE_GAP = 140;  // horizontal distance between spouses in a couple
  var PAD = 100;         // padding around the whole tree

  var FALLBACK_PHOTO = "media/photos/no-photo.svg";
  var PLACEHOLDER =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
        '<rect width="100%" height="100%" fill="#e5e7eb"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
        'fill="#9ca3af" font-family="sans-serif" font-size="13">No photo</text>' +
      '</svg>'
    );

  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  function fullName(p) {
    return [p.first_name, p.last_name].filter(Boolean).join(" ");
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---- Build a tidy layout of nodes + edges ---------------------------
  // Returns { positions:{id:{x,y}}, edges:[...], width, height }.
  function computeLayout(people) {
    var byId = {};
    people.forEach(function (p) { byId[p.id] = p; });

    // parents(id): people who list this id among their children (reliable;
    // the `ancestors` field includes ALL ancestors, not just parents).
    var parents = {};
    people.forEach(function (p) { parents[p.id] = []; });
    people.forEach(function (p) {
      (p.children || []).forEach(function (c) {
        if (byId[c]) parents[c].push(p.id);
      });
    });

    // Group spouses into "units" (couples) so they sit side by side.
    var unitOf = {};
    var units = [];
    var placed = {};
    function newUnit(members) {
      var u = { key: "U" + units.length, members: members };
      units.push(u);
      members.forEach(function (m) { unitOf[m] = u; });
      return u;
    }
    people.forEach(function (p) {
      if (placed[p.id]) return;
      var spouses = (p.spouses || [])
        .map(function (s) { return s.id; })
        .filter(function (id) { return byId[id] && !placed[id]; });
      var members = [p.id].concat(spouses);
      members.forEach(function (m) { placed[m] = true; });
      newUnit(members);
    });

    // Parent unit = unit containing the parents of any member.
    var childUnits = {};
    units.forEach(function (u) { childUnits[u.key] = []; });
    units.forEach(function (u) {
      var pu = null;
      for (var i = 0; i < u.members.length && !pu; i++) {
        var ps = parents[u.members[i]];
        for (var j = 0; j < ps.length; j++) {
          if (unitOf[ps[j]] && unitOf[ps[j]] !== u) { pu = unitOf[ps[j]]; break; }
        }
      }
      u.parent = pu;
      if (pu) childUnits[pu.key].push(u);
    });
    var roots = units.filter(function (u) { return !u.parent; });

    // Depth (generation) from roots.
    function setDepth(u, d) {
      u.depth = d;
      childUnits[u.key].forEach(function (c) { setDepth(c, d + 1); });
    }
    roots.forEach(function (r) { setDepth(r, 0); });

    // Assign column x: leaves get sequential slots, parents center over kids.
    var cursor = 0;
    function layout(u) {
      var kids = childUnits[u.key];
      if (kids.length === 0) { u.col = cursor; cursor += 1; }
      else {
        kids.forEach(layout);
        u.col = (kids[0].col + kids[kids.length - 1].col) / 2;
      }
    }
    roots.forEach(function (r) { layout(r); cursor += 1; /* gap between trees */ });

    // Convert units -> per-person pixel positions.
    var positions = {};
    units.forEach(function (u) {
      var cx = u.col * COL;
      var cy = u.depth * ROW;
      var n = u.members.length;
      u.members.forEach(function (m, i) {
        var offset = (i - (n - 1) / 2) * COUPLE_GAP;
        positions[m] = { x: cx + offset, y: cy };
      });
      u.cx = cx; u.cy = cy;
    });

    // Edges: spouse links + parent->child connectors.
    var edges = [];
    units.forEach(function (u) {
      for (var i = 0; i < u.members.length - 1; i++) {
        edges.push({ type: "spouse", a: u.members[i], b: u.members[i + 1] });
      }
      childUnits[u.key].forEach(function (c) {
        edges.push({ type: "child", from: u, to: c });
      });
    });

    // Normalise coordinates so the top-left starts at PAD.
    var xs = [], ys = [];
    Object.keys(positions).forEach(function (id) {
      xs.push(positions[id].x); ys.push(positions[id].y);
    });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var dx = PAD + NODE_W / 2 - minX;
    var dy = PAD - minY;
    Object.keys(positions).forEach(function (id) {
      positions[id].x += dx; positions[id].y += dy;
    });
    units.forEach(function (u) { u.cx += dx; u.cy += dy; });

    var width = (maxX - minX) + NODE_W + PAD * 2;
    var height = (maxY - minY) + NODE_H + PAD * 2;
    return { positions: positions, edges: edges, width: width, height: height };
  }

  // ---- Render nodes + SVG edges ---------------------------------------
  function renderTree(layout) {
    var nodesEl = document.getElementById("tree-nodes");
    var svg = document.getElementById("tree-edges");
    svg.setAttribute("width", layout.width);
    svg.setAttribute("height", layout.height);
    document.getElementById("tree-world").style.width = layout.width + "px";
    document.getElementById("tree-world").style.height = layout.height + "px";

    // Edges first (so nodes sit on top).
    var paths = [];
    layout.edges.forEach(function (e) {
      if (e.type === "spouse") {
        var a = layout.positions[e.a], b = layout.positions[e.b];
        var y = a.y + NODE_H / 2;
        paths.push('<path class="edge edge-spouse" d="M ' +
          (a.x) + ' ' + y + ' L ' + (b.x) + ' ' + y + '"/>');
      } else {
        // Orthogonal elbow from parent-couple center down to each child.
        var px = e.from.cx, py = e.from.cy + NODE_H;
        var cx = e.to.cx, cy = e.to.cy;
        var midY = (py + cy) / 2;
        paths.push('<path class="edge edge-child" d="M ' +
          px + ' ' + py + ' V ' + midY + ' H ' + cx + ' V ' + cy + '"/>');
      }
    });
    svg.innerHTML = paths.join("");

    // Nodes.
    var html = data.people.map(function (p) {
      var pos = layout.positions[p.id];
      var left = pos.x - NODE_W / 2;
      var top = pos.y;
      return (
        '<a class="node" href="web/detail.html?id=' + encodeURIComponent(p.id) + '"' +
          ' data-gender="' + escapeHtml(p.gender || "") + '"' +
          ' data-name="' + escapeHtml(fullName(p)) + '"' +
          ' data-id="' + escapeHtml(p.id) + '"' +
          ' data-dob="' + escapeHtml(p.dob || "") + '"' +
          ' data-country="' + escapeHtml(p.birth_country || "") + '"' +
          ' style="left:' + left + 'px; top:' + top + 'px; width:' + NODE_W + 'px;">' +
          '<span class="node-photo">' +
            '<img alt="' + escapeHtml(fullName(p)) + '" ' +
                 'src="media/photos/' + encodeURIComponent(p.id) + '.jpg" ' +
                 'data-fallback="0">' +
          '</span>' +
          '<span class="node-name">' + escapeHtml(fullName(p)) + '</span>' +
        '</a>'
      );
    }).join("");
    nodesEl.innerHTML = html;

    // Photo fallback chain: <id>.jpg -> sample photo -> placeholder.
    nodesEl.querySelectorAll("img").forEach(function (img) {
      img.addEventListener("error", function () {
        var step = img.getAttribute("data-fallback");
        if (step === "0") { img.setAttribute("data-fallback", "1"); img.src = FALLBACK_PHOTO; }
        else if (step === "1") { img.setAttribute("data-fallback", "2"); img.src = PLACEHOLDER; }
      });
    });
  }

  // ---- Hover tooltip ---------------------------------------------------
  // A position:fixed card that follows the cursor. Fixed positioning keeps it
  // immune to the pan/zoom transform applied to #tree-world.
  function setupTooltip() {
    var nodesEl = document.getElementById("tree-nodes");
    var tip = document.getElementById("node-tip");
    var GAP = 14; // distance from cursor

    function move(e) {
      var w = tip.offsetWidth, h = tip.offsetHeight;
      var x = e.clientX + GAP, y = e.clientY + GAP;
      // Keep the card within the viewport.
      if (x + w + 4 > window.innerWidth) x = e.clientX - GAP - w;
      if (y + h + 4 > window.innerHeight) y = e.clientY - GAP - h;
      tip.style.left = Math.max(4, x) + "px";
      tip.style.top = Math.max(4, y) + "px";
    }
    // "1948-03-12" -> "12 Mar 1948". Falls back to the raw value if it doesn't
    // match the expected YYYY-MM-DD shape (e.g. partial or unknown dates).
    var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    function friendlyDate(dob) {
      var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || "");
      if (!m) return dob || "";
      var mon = MONTHS[parseInt(m[2], 10) - 1];
      if (!mon) return dob;
      return parseInt(m[3], 10) + " " + mon + " " + m[1];
    }
    function show(node, e) {
      tip.innerHTML =
        '<span class="tip-name"></span>' +
        '<span class="tip-meta tip-dob"></span>' +
        '<span class="tip-meta tip-country"></span>' +
        '<span class="tip-id"></span>' +
        '<span class="tip-cta">Click for details</span>';
      tip.querySelector(".tip-name").textContent = node.getAttribute("data-name") || "";

      var dob = friendlyDate(node.getAttribute("data-dob"));
      var dobEl = tip.querySelector(".tip-dob");
      if (dob) { dobEl.textContent = "Born: " + dob; } else { dobEl.hidden = true; }

      var country = node.getAttribute("data-country") || "";
      var countryEl = tip.querySelector(".tip-country");
      if (country) { countryEl.textContent = "Country: " + country; } else { countryEl.hidden = true; }

      tip.querySelector(".tip-id").textContent = "ID: " + (node.getAttribute("data-id") || "");
      tip.hidden = false;
      move(e);
    }
    function hide() { tip.hidden = true; }

    nodesEl.addEventListener("mouseover", function (e) {
      var node = e.target.closest(".node");
      if (node) show(node, e);
    });
    nodesEl.addEventListener("mousemove", function (e) {
      if (!tip.hidden) move(e);
    });
    nodesEl.addEventListener("mouseout", function (e) {
      var node = e.target.closest(".node");
      if (node && !node.contains(e.relatedTarget)) hide();
    });
    // Hide while panning so it doesn't linger over the canvas.
    document.getElementById("tree-viewport")
      .addEventListener("pointerdown", hide);

    return { hide: hide };
  }

  // ---- Pan / zoom (Figma/n8n-style infinite canvas) -------------------
  function setupPanZoom(layout) {
    var viewport = document.getElementById("tree-viewport");
    var world = document.getElementById("tree-world");
    var scale = 1, tx = 0, ty = 0;
    var MIN = 0.3, MAX = 2.5;

    function apply() {
      world.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + scale + ")";
    }
    function fit() {
      var vw = viewport.clientWidth, vh = viewport.clientHeight;
      var s = Math.min(vw / layout.width, vh / layout.height) * 0.92;
      scale = clamp(s, MIN, 1.2);
      tx = (vw - layout.width * scale) / 2;
      ty = (vh - layout.height * scale) / 2;
      apply();
    }
    function zoomAt(cx, cy, factor) {
      var rect = viewport.getBoundingClientRect();
      var mx = cx - rect.left, my = cy - rect.top;
      var ns = clamp(scale * factor, MIN, MAX);
      tx = mx - (mx - tx) * (ns / scale);
      ty = my - (my - ty) * (ns / scale);
      scale = ns;
      apply();
    }

    // Wheel to zoom.
    viewport.addEventListener("wheel", function (e) {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    // Drag to pan. NOTE: we only call setPointerCapture once an actual drag
    // begins (past the threshold). Capturing on pointerdown would re-target the
    // follow-up `click` to the viewport and swallow node navigation.
    var pointerDown = false, dragging = false, captured = false;
    var sx = 0, sy = 0, stx = 0, sty = 0, pid = null;
    viewport.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      pointerDown = true; dragging = false; captured = false;
      sx = e.clientX; sy = e.clientY; stx = tx; sty = ty; pid = e.pointerId;
    });
    viewport.addEventListener("pointermove", function (e) {
      if (!pointerDown) return;
      var ddx = e.clientX - sx, ddy = e.clientY - sy;
      if (!dragging && Math.abs(ddx) + Math.abs(ddy) > 4) {
        dragging = true;
        viewport.classList.add("grabbing");
        try { viewport.setPointerCapture(pid); captured = true; } catch (err) {}
      }
      if (!dragging) return;
      tx = stx + ddx; ty = sty + ddy;
      apply();
    });
    function endDrag() {
      if (!pointerDown) return;
      pointerDown = false;
      if (captured) { try { viewport.releasePointerCapture(pid); } catch (err) {} }
      captured = false;
      viewport.classList.remove("grabbing");
      // Suppress the click that follows a real drag so we don't navigate.
      if (dragging) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 0);
      }
      dragging = false;
    }
    viewport.addEventListener("pointerup", endDrag);
    viewport.addEventListener("pointercancel", endDrag);

    var suppressClick = false;
    world.addEventListener("click", function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    document.getElementById("zoom-in").addEventListener("click", function (e) {
      e.stopPropagation();
      var r = viewport.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2);
    });
    document.getElementById("zoom-out").addEventListener("click", function (e) {
      e.stopPropagation();
      var r = viewport.getBoundingClientRect();
      zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2);
    });
    document.getElementById("zoom-reset").addEventListener("click", function (e) {
      e.stopPropagation();
      fit();
    });

    fit();
    window.addEventListener("resize", fit);
  }

  // ---- Actions menu ----------------------------------------------------
  function setupMenu() {
    var btn = document.getElementById("actions-btn");
    var menu = document.getElementById("actions-menu");
    function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    function open() { menu.hidden = false; btn.setAttribute("aria-expanded", "true"); }
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (menu.hidden) open(); else close();
    });
    document.addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    menu.addEventListener("click", function (e) { e.stopPropagation(); });
    document.getElementById("download-json").addEventListener("click", function () {
      downloadJson(); close();
    });
    setupFolderControls();
  }

  // Project folder: show the path (from the file:// location), copy it, or
  // pop the native folder picker. Browsers can't open Finder/Explorer or aim
  // the picker at this folder, so the displayed path is the reliable bit.
  function projectFolderPath() {
    var p = "";
    try { p = decodeURIComponent(location.pathname); } catch (e) { p = location.pathname; }
    p = p.replace(/\/[^\/]*$/, "");           // strip the html filename
    if (/^\/[A-Za-z]:\//.test(p)) p = p.slice(1); // Windows: /C:/... -> C:/...
    if (/^[A-Za-z]:/.test(p)) p = p.replace(/\//g, "\\"); // Windows backslashes
    return p || "(unknown)";
  }

  // The file:// URL of the folder (for the "Open" button / new tab).
  function projectFolderUrl() {
    return location.href.replace(/[^\/]*$/, "");
  }

  function setupFolderControls() {
    var pathEl = document.getElementById("folder-path");
    var copyBtn = document.getElementById("copy-folder");
    var openBtn = document.getElementById("open-folder");
    if (!pathEl) return;

    var path = projectFolderPath();
    pathEl.textContent = path;

    if (copyBtn) {
      copyBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        copyText(path);
        var prev = copyBtn.textContent;
        copyBtn.textContent = "Copied";
        setTimeout(function () { copyBtn.textContent = prev; }, 1200);
      });
    }
    if (openBtn) {
      openBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        window.open(projectFolderUrl(), "_blank");
      });
    }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { copyTextFallback(text); });
    } else {
      copyTextFallback(text);
    }
  }

  function copyTextFallback(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try { document.execCommand("copy"); } catch (e) {}
    document.body.removeChild(ta);
  }

  function downloadJson() {
    var json = JSON.stringify(data, null, 2);
    var blob = new Blob([json], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "family.json";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- Init ------------------------------------------------------------
  setupMenu();
  if (data && data["tree-name"]) {
    var title = "Family Tree of " + data["tree-name"];
    document.getElementById("tree-title").textContent = title;
    document.title = title;
  }
  if (data && Array.isArray(data.people) && data.people.length) {
    var layout = computeLayout(data.people);
    renderTree(layout);
    setupTooltip();
    setupPanZoom(layout);
  } else {
    document.getElementById("tree-nodes").innerHTML =
      '<p style="padding:20px">Could not load family data (data/family.js).</p>';
  }
})();
