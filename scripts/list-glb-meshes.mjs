import { readFileSync } from 'fs';

function listMeshes(path) {
  const buf = readFileSync(path);
  if (buf[0] !== 0x67 || buf[1] !== 0x6c || buf[2] !== 0x54 || buf[3] !== 0x46) {
    throw new Error(`not glb: ${path}`);
  }
  const jsonLen = buf.readUInt32LE(12);
  const json = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const names = [];
  const walk = (nodes, i, prefix) => {
    const n = nodes[i];
    const name = n.name || `(node_${i})`;
    const mesh = n.mesh != null ? json.meshes[n.mesh]?.name || `mesh_${n.mesh}` : '';
    names.push({ node: prefix + name, mesh, children: (n.children || []).length });
    for (const c of n.children || []) walk(nodes, c, prefix + name + '/');
  };
  for (const s of json.scenes || []) {
    for (const r of s.nodes || []) walk(json.nodes, r, '');
  }
  return { path, nodeCount: json.nodes?.length ?? 0, meshCount: json.meshes?.length ?? 0, names };
}

const files = process.argv.slice(2);
for (const f of files) {
  const r = listMeshes(f);
  console.log('\n===', f.split('\\').pop(), 'nodes', r.nodeCount, 'meshes', r.meshCount);
  for (const n of r.names) {
    if (n.mesh || n.children === 0) console.log(`  ${n.node}${n.mesh ? '  [' + n.mesh + ']' : ''}`);
  }
}
