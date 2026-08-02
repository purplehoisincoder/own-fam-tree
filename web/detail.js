// Detail page logic. Reads window.FAMILY_DATA (loaded from ../data/family.js).
// This file lives in web/, so media paths step up one level (../media/...).

(function () {
  "use strict";

  // Fallback photo used when a person has no <id>.jpg of their own.
  var FALLBACK_PHOTO = "../media/photos/no-photo.svg";
  // Inline SVG placeholder if even the fallback photo is missing.
  var PLACEHOLDER =
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="160">' +
        '<rect width="100%" height="100%" fill="#e5e7eb"/>' +
        '<text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" ' +
        'fill="#9ca3af" font-family="sans-serif" font-size="14">No photo</text>' +
      '</svg>'
    );

  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  function fullName(p) {
    return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  }

  function findPerson(id) {
    var data = window.FAMILY_DATA;
    if (!data || !Array.isArray(data.people)) return null;
    return data.people.filter(function (p) { return p.id === id; })[0] || null;
  }

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  // Format "YYYY-MM-DD" as "12 Mar 1948"; fall back to the raw value.
  function formatDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return s || "";
    var month = MONTHS[parseInt(m[2], 10) - 1];
    if (!month) return s;
    return parseInt(m[3], 10) + " " + month + " " + m[1];
  }

  // Parents are NOT read from `ancestors` (that lists ALL ancestors); they are
  // found by reverse lookup: anyone whose `children` contains this id.
  function findParentsOf(id) {
    var data = window.FAMILY_DATA;
    if (!data || !Array.isArray(data.people)) return [];
    return data.people.filter(function (p) {
      return Array.isArray(p.children) && p.children.indexOf(id) !== -1;
    });
  }

  function findChildrenOf(person) {
    return (person.children || [])
      .map(findPerson)
      .filter(Boolean);
  }

  // Render a list of people as detail.html links into `el`, comma-separated.
  // Shows "Unavailable" when the list is empty.
  function renderPeople(el, people) {
    if (!el) return;
    el.textContent = "";
    if (!people.length) {
      el.textContent = "Unavailable";
      el.classList.add("is-unavailable");
      return;
    }
    el.classList.remove("is-unavailable");
    people.forEach(function (p, i) {
      var a = document.createElement("a");
      a.href = "detail.html?id=" + encodeURIComponent(p.id);
      a.textContent = fullName(p);
      el.appendChild(a);
      if (i < people.length - 1) {
        el.appendChild(document.createTextNode(", "));
      }
    });
  }

  function setupBio(person) {
    var el = document.getElementById("person-bio");
    if (!el) return;
    var parts = [];
    if (person.dob) parts.push("Born " + formatDate(person.dob));
    if (person.birth_country) parts.push(person.birth_country);
    if (parts.length) {
      el.textContent = parts.join(" \u00b7 ");
    } else {
      el.hidden = true;
    }
  }

  function showError(msg) {
    var editLink = document.getElementById("edit-person");
    if (editLink) editLink.hidden = true;
    document.getElementById("person-name").textContent = "Not found";
    var panel = document.getElementById("panel-info");
    if (panel) {
      panel.innerHTML = '<p class="placeholder error"></p>';
      panel.querySelector("p").textContent = msg;
    }
    document.getElementById("person-photo").src = PLACEHOLDER;
  }

  // Tabs: switch panels in-page, no navigation.
  function setupTabs() {
    var tabs = document.querySelectorAll(".tab");
    var panels = document.querySelectorAll(".tab-panel");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.getAttribute("data-tab");
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        panels.forEach(function (p) {
          var on = p.getAttribute("data-tab") === name;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
      });
    });
  }

  // ---- Info tab ----
  // Each person may have an `info` array of bits: [{ t: "...", l: "..." }, ...].
  // `t` (text) and `l` (link) are both optional:
  //   - t only      -> a plain text row (as before)
  //   - l only       -> a row with a clickable "Link" on the right
  //   - t and l      -> text on the left, clickable "Link" on the right
  function setupInfo(person) {
    var panel = document.getElementById("panel-info");
    if (!panel) return;
    var bits = Array.isArray(person.info) ? person.info : [];

    panel.innerHTML = "";
    if (bits.length === 0) {
      var empty = document.createElement("p");
      empty.className = "placeholder";
      empty.textContent = "No info yet.";
      panel.appendChild(empty);
      return;
    }

    var list = document.createElement("ul");
    list.className = "info-list";
    bits.forEach(function (bit) {
      var t = bit && bit.t;
      var l = bit && bit.l;
      if (!t && !l) return;        // nothing to show
      var li = document.createElement("li");
      li.className = "info-bit";

      if (t) {
        var span = document.createElement("span");
        span.className = "info-text";
        span.textContent = t;      // textContent: safe, no HTML injection
        li.appendChild(span);
      }
      if (l) {
        var a = document.createElement("a");
        a.className = "info-link";
        a.href = normalizeLink(l);
        a.target = "_blank";
        a.rel = "noopener";
        a.textContent = "Link";
        li.appendChild(a);
      }
      list.appendChild(li);
    });
    panel.appendChild(list);
  }

  // A bare domain like "fakelink.com" would resolve as a relative file:// path,
  // so prepend https:// unless the value already has a scheme (e.g. http://).
  function normalizeLink(url) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : "https://" + url;
  }

  // ---- Photos tab ----
  // file:// cannot list a directory, so we probe a numbered convention:
  // media/photos/<id>/1.jpg, 2.png, ... trying each extension per index and
  // stopping at the first index with no matching file (capped for safety).
  var PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"];
  var MAX_PHOTOS = 30;

  // Try each extension for one index; resolve with the first path that loads,
  // or null if none of the extensions exist.
  function probePhoto(dir, index) {
    return new Promise(function (resolve) {
      var i = 0;
      (function tryNext() {
        if (i >= PHOTO_EXTS.length) { resolve(null); return; }
        var path = dir + index + "." + PHOTO_EXTS[i++];
        var img = new Image();
        img.onload = function () { resolve(path); };
        img.onerror = tryNext;
        img.src = path;
      })();
    });
  }

  function makeTile(src, id, alt) {
    var a = document.createElement("a");
    a.className = "photo-tile";
    a.href = "media.html?src=" + encodeURIComponent(src) +
             (id ? "&id=" + encodeURIComponent(id) : "");
    var img = document.createElement("img");
    img.src = src;
    img.alt = alt || "Photo";
    img.loading = "lazy";
    a.appendChild(img);
    return a;
  }

  function showExamplePhotos(grid, id) {
    ["no-photo.svg", "no-photo2.svg", "no-photo3.svg", "no-photo4.svg"].forEach(function (name) {
      grid.appendChild(makeTile("../media/photos/" + name, id, "No photo"));
    });
  }

  function setupPhotos(id) {
    var hint = document.getElementById("photo-hint");
    var grid = document.getElementById("photo-grid");
    if (!grid) return;
    // Project-relative path (the actual folder the user drops files into).
    var folder = "media/photos/" + id;
    if (hint) {
      // Resolve an absolute file:// URL at runtime so source paths stay
      // relative. Clicking opens the folder (Finder on Safari; an in-browser
      // directory listing on Chrome/Firefox).
      var href = new URL(
        "../media/photos/" + encodeURIComponent(id) + "/",
        window.location.href
      ).href;
      var link = document.createElement("a");
      link.href = href;
      link.textContent = folder;
      link.title = "Open this folder";
      hint.textContent = "";
      hint.appendChild(document.createTextNode("Showing photos from folder "));
      hint.appendChild(link);
      hint.appendChild(
        document.createTextNode(". Additional photos can be added there. Name them <number>.[jpg|jpeg|png] where the numbers are 1,2,3,...")
      );
    }

    var dir = "../media/photos/" + encodeURIComponent(id) + "/";
    var found = 0;
    (function probeFrom(index) {
      if (index > MAX_PHOTOS) { finish(); return; }
      probePhoto(dir, index).then(function (path) {
        if (!path) { finish(); return; }   // first gap -> stop
        found++;
        grid.appendChild(makeTile(path, id, "Photo " + index));
        probeFrom(index + 1);
      });
    })(1);

    function finish() {
      if (found === 0) showExamplePhotos(grid, id);
    }
  }

  function setupPhoto(id) {
    var img = document.getElementById("person-photo");
    // Fallback chain: <id>.jpg -> fallback photo -> SVG placeholder.
    var step = 0;
    img.onerror = function () {
      if (step === 0) { step = 1; img.src = FALLBACK_PHOTO; }
      else if (step === 1) { step = 2; img.src = PLACEHOLDER; }
      else { img.onerror = null; }
    };
    img.src = "../media/photos/" + encodeURIComponent(id) + ".jpg";
  }

  setupTabs();

  var id = getParam("id");
  if (!id) {
    showError("No person id provided in the URL (expected detail.html?id=...).");
    return;
  }

  var person = findPerson(id);
  if (!person) {
    showError('No person found with id "' + id + '".');
    return;
  }

  var editLink = document.getElementById("edit-person");
  if (editLink) editLink.href = "edit-tree.html?person=" + encodeURIComponent(id);

  document.title = fullName(person) + " \u2014 Family Tree";
  document.getElementById("person-name").textContent = fullName(person);
  document.getElementById("person-photo").alt = fullName(person);
  setupBio(person);
  renderPeople(document.getElementById("person-parents"), findParentsOf(id));
  renderPeople(document.getElementById("person-children"), findChildrenOf(person));
  setupPhoto(id);
  setupPhotos(id);
  setupInfo(person);
})();
