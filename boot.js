(async function(){
  try {
    const b64 = window.__APP_GZ__;
    if (!b64) throw new Error("missing bundle");
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ds = new DecompressionStream("gzip");
    const ab = await new Response(new Blob([bin]).stream().pipeThrough(ds)).arrayBuffer();
    const s = document.createElement("script");
    s.textContent = new TextDecoder().decode(ab);
    document.body.appendChild(s);
  } catch (e) {
    document.body.insertAdjacentHTML("beforeend",
      "<pre style=\"color:#f88;background:#111;padding:1rem\">Eroare: " + e + "</pre>");
  }
})();
