const base = "https://grudge-crafting.puter.site";
const r = await fetch(base + "/");
const html = await r.text();
console.log("status", r.status);
console.log("title", (html.match(/<title>([^<]+)/) || [])[1]);
// scripts
const scripts = [...html.matchAll(/src=["']([^"']+)["']/g)].map((m) => m[1]);
console.log("scripts", scripts);
const links = [...html.matchAll(/href=["']([^"']+\.(js|css|json))["']/g)].map((m) => m[1]);
console.log("links", links.slice(0, 20));

// try common entry names
const candidates = [
  ...scripts.filter((s) => s.endsWith(".js") || s.includes("script")),
  "/app.js",
  "/main.js",
  "/index.js",
  "/crafting.js",
  "/js/app.js",
  "/assets/index.js",
];
for (const c of [...new Set(candidates)]) {
  const u = c.startsWith("http") ? c : base + (c.startsWith("/") ? c : "/" + c);
  try {
    const res = await fetch(u);
    const t = await res.text();
    console.log("\n===", res.status, u, "len", t.length);
    if (res.ok && t.length < 500000) {
      // find character/auth related
      for (const needle of [
        "characters",
        "grudgewarlords",
        "api.grudge",
        "id.grudge",
        "railway",
        "era",
        "sso_token",
        "grudge_token",
        "Sign in",
        "/api/characters",
        "fetchCharacters",
        "loadCharacters",
        "puter.auth",
      ]) {
        if (t.includes(needle)) console.log("  has:", needle);
      }
    }
  } catch (e) {
    console.log("ERR", u, e.message);
  }
}
