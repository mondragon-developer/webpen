// Kept out of index.html so the site can ship a CSP without inline script.
var SCRIPT_URL = "https://webpen-presenter.netlify.app/presenter.js";
var code = "javascript:(function(){if(window.Presenter){Presenter.show();return;}var s=document.createElement('script');s.src='" + SCRIPT_URL + "?v='+Date.now();s.onload=function(){Presenter.show();};document.head.appendChild(s);})();";
document.getElementById("code").value = code;
document.getElementById("drag").href = code;
document.getElementById("drag").addEventListener("click", function (e) { e.preventDefault(); });
document.getElementById("copy").addEventListener("click", function () {
  var t = document.getElementById("code");
  t.select();
  var done = function () { document.getElementById("status").textContent = "Copied."; };
  if (navigator.clipboard) navigator.clipboard.writeText(code).then(done, function () { document.execCommand("copy"); done(); });
  else { document.execCommand("copy"); done(); }
});
