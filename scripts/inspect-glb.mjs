// Pure-Node GLB inspector — validates structure and reports a rough bbox.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = new URL('../public/models/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

function inspect(path) {
  const buf = readFileSync(path);
  const magic = buf.readUInt32LE(0);
  if (magic !== 0x46546c67) return { ok: false, reason: 'bad magic' };
  const version = buf.readUInt32LE(4);
  // first chunk = JSON
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.readUInt32LE(16);
  if (chunkType !== 0x4e4f534a) return { ok: false, reason: 'first chunk not JSON' };
  const json = JSON.parse(buf.toString('utf8', 20, 20 + chunkLen));

  // Rough local bbox from POSITION accessor min/max (ignores node transforms).
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const m of json.meshes ?? []) {
    for (const p of m.primitives ?? []) {
      const ai = p.attributes?.POSITION;
      if (ai == null) continue;
      const acc = json.accessors[ai];
      if (acc?.min && acc?.max) {
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], acc.min[i]);
          max[i] = Math.max(max[i], acc.max[i]);
        }
      }
    }
  }
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]].map((v) => +v.toFixed(3));
  const axes = ['X', 'Y', 'Z'];
  const thinnest = axes[size.indexOf(Math.min(...size))];

  return {
    ok: true,
    version,
    meshes: json.meshes?.length ?? 0,
    materials: json.materials?.length ?? 0,
    nodes: json.nodes?.length ?? 0,
    accessors: json.accessors?.length ?? 0,
    extensions: json.extensionsUsed ?? [],
    size,
    thinnestAxis: thinnest,
  };
}

for (const f of readdirSync(dir).filter((f) => f.endsWith('.glb'))) {
  try {
    const r = inspect(join(dir, f));
    console.log(`\n${f}`);
    console.log(JSON.stringify(r));
  } catch (e) {
    console.log(`\n${f}\n  ERROR: ${e.message}`);
  }
}
