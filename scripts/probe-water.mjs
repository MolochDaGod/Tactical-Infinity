const base = "https://water.grudge-studio.com";
const paths = [
  "/",
  "/auth/callback",
  "/api/auth/me",
  "/api/auth/guest",
  "/api/health",
  "/api/characters",
  "/api/objectstore/v1/weapons.json",
  "/api/assets/icons/brand/bosslogo.png",
];

for (const p of paths) {
  const u = base + p;
  try {
    const method = p.includes("guest") ? "POST" : "GET";
    const r = await fetch(u, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? "{}" : undefined,
      redirect: "manual",
    });
    const ct = r.headers.get("content-type") || "";
    let body = "";
    try {
      body = (await r.text()).slice(0, 120).replace(/\s+/g, " ");
    } catch {}
    console.log(r.status, p, ct.slice(0, 40), body);
  } catch (e) {
    console.log("ERR", p, e.message);
  }
}
