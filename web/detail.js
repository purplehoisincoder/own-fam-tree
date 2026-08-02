// Detail page logic. Reads window.FAMILY_DATA (loaded from ../data/family.js).
// This file lives in web/, so media paths step up one level (../media/...).

(function () {
  "use strict";

  // Fallback photo used when a person has no <id>.jpg of their own.
  var FALLBACK_PHOTO = "../media/photos/PXL_20260617_003846295.jpg";
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

  function showError(msg) {
    document.getElementById("person-name").textContent = "Not found";
    var pre = document.getElementById("person-json");
    pre.textContent = msg;
    pre.classList.add("error");
    document.getElementById("person-photo").src = PLACEHOLDER;
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

  document.title = fullName(person) + " \u2014 Family Tree";
  document.getElementById("person-name").textContent =
    fullName(person) + " (" + person.id + ")";
  document.getElementById("person-photo").alt = fullName(person);
  document.getElementById("person-json").textContent =
    JSON.stringify(person, null, 2);
  setupPhoto(id);
})();
