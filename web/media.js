// Full-size photo viewer. Reads ?src=<relative photo path>&id=<person id>.
// Both detail.html and media.html live in web/, so a "../media/..." path passed
// from the detail grid resolves correctly here too. No data/server needed.

(function () {
  "use strict";

  // Inline SVG placeholder shown if the requested image fails to load.
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

  var src = getParam("src");
  var id = getParam("id");

  // Back link returns to the person's detail page, or the tree if no id.
  var back = document.getElementById("back-link");
  if (id) {
    back.href = "detail.html?id=" + encodeURIComponent(id);
    back.textContent = "\u2190 Back to person";
  }

  var img = document.getElementById("full-photo");
  if (src) {
    img.onerror = function () { img.onerror = null; img.src = PLACEHOLDER; };
    img.src = src;
  } else {
    img.src = PLACEHOLDER;
  }
})();
