/**
 * Builds the lighter phone variant of M from the original V6 model (assets/m-v6-web/part-*.bin,
 * the verified source asset the tests pin by hash). Desktop keeps loading the original parts.
 *
 * Output: assets/m-v7-web/m-mobile.bin (a GLB; the .bin name lets GitHub Pages serve it gzipped)
 *  - the body is simplified with meshoptimizer (open borders and UV seams locked);
 *  - every vertex keeps its 4 strongest joint influences, renormalised, in JOINTS_0 / WEIGHTS_0;
 *  - positions, normals, tangents and UVs are quantized (KHR_mesh_quantization) and all buffers are
 *    compressed with EXT_meshopt_compression. Bones (31), morph targets, clips and materials stay.
 *
 * Measured on 2026-11-19: desktop meshopt + quantization was no smaller than the original parts once
 * GitHub Pages' gzip is applied (~9.6 MB vs ~9.7 MB transferred), so it is not shipped.
 *
 * Run:  cd tools/m-assets && npm install && npm run build
 */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {quantize, compactPrimitive} from '@gltf-transform/functions';
import {MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier} from 'meshoptimizer';

const root = new URL('../../', import.meta.url);
const SOURCE_PARTS = 19;
const MOBILE_BODY_RATIO = 0.35;
const MOBILE_BODY_ERROR = 0.01;

await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'meshopt.decoder': MeshoptDecoder,
});

const source = Buffer.concat(Array.from({length: SOURCE_PARTS}, (_, i) =>
  readFileSync(new URL('assets/m-v6-web/part-' + String(i).padStart(2, '0') + '.bin', root))));

function bodyPrimitive(document) {
  const mesh = document.getRoot().listMeshes().find(m => m.getName() === 'M_Body_BilateralEyes_V6');
  if (!mesh) throw new Error('Body mesh not found');
  return mesh.listPrimitives()[0];
}

/** Keep the 4 strongest joint influences per vertex, renormalised, in JOINTS_0 / WEIGHTS_0. */
function limitInfluences(document, primitive) {
  const sets = [];
  for (let s = 0; primitive.getAttribute('JOINTS_' + s); s++) {
    sets.push({joints: primitive.getAttribute('JOINTS_' + s), weights: primitive.getAttribute('WEIGHTS_' + s)});
  }
  if (sets.length <= 1) return;
  const count = sets[0].joints.getCount();
  const joints = new Uint8Array(count * 4), weights = new Float32Array(count * 4);
  const j = [0, 0, 0, 0], w = [0, 0, 0, 0];
  for (let i = 0; i < count; i++) {
    const pairs = [];
    for (const set of sets) {
      set.joints.getElement(i, j);
      set.weights.getElement(i, w);
      for (let c = 0; c < 4; c++) if (w[c] > 0) pairs.push([j[c], w[c]]);
    }
    pairs.sort((a, b) => b[1] - a[1]);
    const top = pairs.slice(0, 4), sum = top.reduce((total, pair) => total + pair[1], 0) || 1;
    top.forEach(([joint, weight], c) => { joints[i * 4 + c] = joint; weights[i * 4 + c] = weight / sum; });
  }
  const buffer = document.getRoot().listBuffers()[0];
  primitive.setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(joints).setBuffer(buffer));
  primitive.setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(weights).setBuffer(buffer));
  for (let s = 1; s < sets.length; s++) {
    primitive.setAttribute('JOINTS_' + s, null);
    primitive.setAttribute('WEIGHTS_' + s, null);
  }
  for (const set of sets) { set.joints.dispose(); set.weights.dispose(); }
}

/** Simplify a primitive's triangles (borders and seams locked) and drop the vertices no longer used. */
function simplify(primitive, ratio) {
  const indicesAccessor = primitive.getIndices();
  const indices = new Uint32Array(indicesAccessor.getArray());
  const position = primitive.getAttribute('POSITION');
  const positions = new Float32Array(position.getCount() * 3), p = [0, 0, 0];
  for (let i = 0; i < position.getCount(); i++) { position.getElement(i, p); positions.set(p, i * 3); }
  const target = Math.floor(indices.length * ratio / 3) * 3;
  const [simplified, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, MOBILE_BODY_ERROR, ['LockBorder']);
  indicesAccessor.setArray(new Uint32Array(simplified));
  compactPrimitive(primitive);
  return {before: indices.length / 3, after: simplified.length / 3, error};
}

const mobile = await io.readBinary(new Uint8Array(source));
for (const mesh of mobile.getRoot().listMeshes()) {
  for (const primitive of mesh.listPrimitives()) limitInfluences(mobile, primitive);
}
const reduction = simplify(bodyPrimitive(mobile), MOBILE_BODY_RATIO);
await mobile.transform(quantize({
  pattern: /^(POSITION|NORMAL|TANGENT|TEXCOORD_\d+)$/,
  patternTargets: /^$/,
  quantizePosition: 16,
  quantizeNormal: 12,
  quantizeTexcoord: 14,
  cleanup: false,
}));
mobile.createExtension(EXTMeshoptCompression).setRequired(true)
  .setEncoderOptions({method: EXTMeshoptCompression.EncoderMethod.FILTER});
const bytes = await io.writeBinary(mobile);

const outDir = new URL('assets/m-v7-web/', root);
mkdirSync(outDir, {recursive: true});
writeFileSync(new URL('m-mobile.bin', outDir), bytes);

console.log(JSON.stringify({
  source: {bytes: source.byteLength, gzip: gzipSync(source, {level: 9}).byteLength},
  mobile: {bytes: bytes.byteLength, gzip: gzipSync(bytes, {level: 9}).byteLength},
  bodyTriangles: reduction,
}, null, 1));
