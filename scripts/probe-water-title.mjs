const r = await fetch("https://water.grudge-studio.com/");
const t = await r.text();
console.log("title:", (t.match(/<title>([^<]+)/) || [])[1]);
console.log("canonical:", (t.match(/rel="canonical" href="([^"]+)/) || [])[1]);
console.log("bundle:", (t.match(/assets\/index-[^"]+\.js/) || [])[0]);
console.log("has objectstore in bundle check via index-DuFSVEgb?", t.includes("index-DuFSVEgb") || t.includes("index-RzNExlpA") || t.includes("index-"));
// confirm no dead host in main chunk if we can find it
const m = t.match(/src="(\/assets\/index-[^"]+\.js)"/);
if (m) {
  const js = await (await fetch("https://water.grudge-studio.com" + m[1])).text();
  console.log("dead api.grudge-studio.com in main?", js.includes("api.grudge-studio.com"));
  console.log("github.io ObjectStore?", js.includes("github.io/ObjectStore"));
  console.log("objectstore.grudge?", js.includes("objectstore.grudge-studio.com"));
  console.log("id.grudge?", js.includes("id.grudge-studio.com"));
  console.log("water.grudge?", js.includes("water.grudge-studio.com"));
  console.log("railway game data?", js.includes("grudge-api-production"));
}
