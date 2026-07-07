// Replit's package firewall blocks esbuild's post-install native-binary
// download, so the top-level `esbuild` package never lands on disk even
// when npm reports "installed". `esbuild-wasm` ships the same JS API but
// uses a WebAssembly build of the bundler — no native binary required —
// and is already pulled in transitively, so it always resolves.
import { build as esbuild } from "esbuild-wasm";
import { build as viteBuild } from "vite";
import { rm, readFile } from "fs/promises";
import { builtinModules } from "module";

// ─────────────────────────────────────────────────────────────────────────────
// Why this file bundles *everything* by default
//
// At deploy time `node_modules/` is stripped from the image (see .dockerignore),
// so the production process can only load code that esbuild has inlined into
// `dist/index.cjs`. Historically a hand-maintained `allowlist` decided which
// packages got bundled; anything a developer added but forgot to list silently
// became `external` and crashed the deployed app at startup
// (e.g. `Cannot find module 'http-proxy-middleware'`).
//
// We invert that: esbuild bundles the entire reachable import graph of
// `server/index.ts` automatically. The only things kept `external` are:
//   1. Node.js built-ins (auto-externalized by `platform: "node"`, listed here
//      too so the post-build verifier recognises them as allowed).
//   2. Native / optional-native modules that genuinely cannot be bundled
//      (they ship `.node` binaries or are loaded behind try/catch guards).
//
// A post-build verifier then scans the emitted bundle for any remaining bare
// `require(...)` specifier that is NOT in the allowed-external set and fails the
// build loudly — so a missing module is caught here instead of in production.
// ─────────────────────────────────────────────────────────────────────────────

// Native / optional-native modules that must stay external. esbuild cannot
// inline a `.node` binary, and several of these are loaded behind try/catch so a
// missing optional peer is harmless at runtime.
const nativeExternals = [
  "bufferutil",
  "utf-8-validate",
  "pg-native",
  "pg-cloudflare",
  "cpu-features",
];

// Optional, lazily-required modules that dependencies load behind a try/catch
// (so they are safe-if-missing) and that esbuild cannot statically bundle. These
// are NOT passed to esbuild's `external` — they already stay external because of
// the dynamic `require()` — but the verifier must treat them as allowed so a
// guarded optional peer does not fail the build. `encoding`/`iconv-lite` are
// node-fetch's charset converters, only used for non-UTF8 responses.
const optionalExternals = ["encoding", "iconv-lite"];

// Node built-ins (with and without the `node:` prefix) are always external.
const nodeBuiltins = new Set<string>([
  ...builtinModules,
  ...builtinModules.map((m) => `node:${m}`),
]);

// The full set of specifiers that are *allowed* to remain external in the
// emitted bundle. Anything outside this set indicates a dependency that would be
// missing at runtime.
const allowedExternal = new Set<string>([
  ...nodeBuiltins,
  ...nativeExternals,
  ...optionalExternals,
]);

// Map a bare require specifier to its package name so subpath imports like
// `pg-cloudflare/foo` or `@scope/pkg/sub` are matched against the allow set.
function packageNameOf(spec: string): string {
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/");
    return name ? `${scope}/${name}` : spec;
  }
  return spec.split("/")[0];
}

function isAllowedExternal(spec: string): boolean {
  if (allowedExternal.has(spec)) return true;
  return allowedExternal.has(packageNameOf(spec));
}

// Scan the emitted CJS bundle for bare `require("x")` calls. A bare specifier
// (not starting with "." or "/") that is not an allowed external means esbuild
// left a dependency unbundled — it will throw `Cannot find module` in prod.
async function verifyBundle(outfile: string) {
  const code = await readFile(outfile, "utf-8");
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;
  const missing = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = requireRe.exec(code)) !== null) {
    const spec = match[1];
    if (spec.startsWith(".") || spec.startsWith("/")) continue;
    if (isAllowedExternal(spec)) continue;
    missing.add(spec);
  }
  if (missing.size > 0) {
    console.error(
      "\n✗ Build verification failed: the production bundle references modules\n" +
        "  that were NOT bundled and will be missing at runtime (node_modules is\n" +
        "  stripped from the deploy image). Either let esbuild bundle them, or add\n" +
        "  genuinely-native modules to `nativeExternals` in script/build.ts:\n",
    );
    for (const m of [...missing].sort()) console.error(`    - ${m}`);
    console.error("");
    throw new Error(
      `Bundle verification failed: ${missing.size} unbundled module(s) would crash in production.`,
    );
  }
  console.log(
    `bundle verified: no unbundled runtime modules (checked ${outfile}).`,
  );
}

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  console.log("building server...");
  const outfile = "dist/index.cjs";

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile,
    define: {
      "process.env.NODE_ENV": '"production"',
      // Bundle target is cjs, where `import.meta` is empty. Map the only
      // property we use (`import.meta.dirname`) to the cjs-native `__dirname`
      // so `path.resolve(import.meta.dirname, "..", "public")` keeps working
      // at runtime instead of throwing ERR_INVALID_ARG_TYPE on startup.
      "import.meta.dirname": "__dirname",
    },
    minify: true,
    // Keep only genuinely-native modules external; node built-ins are
    // auto-externalized by `platform: "node"`. Everything the server imports is
    // bundled automatically — no hand-maintained allowlist to fall out of date.
    external: nativeExternals,
    // `info` makes esbuild-wasm's stdio service stream a large summary payload
    // back over a SyncWriteStream, which throws `RangeError: Invalid array
    // length` on big bundles and surfaces as an unhandled 'error' event that
    // stricter deploy builders treat as a failure. `warning` keeps real
    // diagnostics while avoiding the oversized write.
    logLevel: "warning",
  });

  await verifyBundle(outfile);
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
