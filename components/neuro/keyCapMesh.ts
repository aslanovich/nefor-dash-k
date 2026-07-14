import * as THREE from "three";

/* Загрузка и «запекание» раскраски 3D-клавиши «АИ» — чистая (без React) часть
   AiKeyButton: разбор GLB вручную (без GLTFLoader) и покраска вершин по позиции/
   нормали. Две палитры: светлая (розово-малиновый верх, красно-золотая боковина)
   и тёмная (чёрный keycap) — переключаются тумблером «Оформление» без перезагрузки
   GLB (меняется только атрибут color, см. applyKeyTheme). */

const LABEL_URL = "/assets/alfa-ai-button/ai-letter.svg";

export type KeyMeshTheme = "light" | "dark";

interface Palette {
  topA: string;      // верхняя грань, дальний край
  topB: string;      // верхняя грань, ближний край
  sideTop: string;   // боковина у верха
  sideMid: string;   // боковина в середине
  sideBottom: string;// боковина у низа
  highlight: string; // блик на верхней грани
  highlightK: number;// сила блика
}
const PALETTES: Record<KeyMeshTheme, Palette> = {
  light: {
    topA: "#d8004e",
    topB: "#ff5f9f",
    sideTop: "#c60038",
    sideMid: "#ff315f",
    sideBottom: "#f2bc1f",
    highlight: "#ffffff",
    highlightK: 0.08,
  },
  // чёрный keycap: графитовый градиент верх→низ, тонкий белый блик сверху
  dark: {
    topA: "#191920",
    topB: "#34343d",
    sideTop: "#101014",
    sideMid: "#1c1c22",
    sideBottom: "#050507",
    highlight: "#ffffff",
    highlightK: 0.12,
  },
};

/* Обновить цвет keycap под тему без перезагрузки GLB — свап атрибута color на
   заранее посчитанный набор (обе палитры лежат в KeyMeshData.colors). */
export function applyKeyTheme(data: KeyMeshData, theme: KeyMeshTheme) {
  data.mesh.geometry.setAttribute("color", new THREE.BufferAttribute(data.colors[theme], 3));
}

export interface KeyMeshData {
  mesh: THREE.Mesh;
  colors: Record<KeyMeshTheme, Float32Array>;
}

// надпись «аи✦» на верхней грани — canvas-текстура (SVG → 2D-canvas → THREE)
export function makeLabelTexture(
  renderer: THREE.WebGLRenderer,
  disposables: Array<{ dispose: () => void }>
) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  disposables.push(texture);

  const draw = (img: HTMLImageElement | null) => {
    ctx.clearRect(0, 0, c.width, c.height);
    if (img) ctx.drawImage(img, 34, 22, 444, 202);
    texture.needsUpdate = true;
  };
  draw(null);

  const img = new Image();
  img.onload = () => draw(img);
  img.src = LABEL_URL;
  return texture;
}

export async function loadKeyCapMesh(url: string, theme: KeyMeshTheme = "light"): Promise<KeyMeshData> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GLB request failed: ${response.status}`);
  const buffer = await response.arrayBuffer();
  const { json, bin } = parseGlb(buffer);
  const primitive = json.meshes?.[0]?.primitives?.[0];
  if (primitive?.attributes?.POSITION == null) throw new Error("GLB has no POSITION attribute");

  const positionSource = readAccessor(json, bin, primitive.attributes.POSITION);
  const normalSource =
    primitive.attributes.NORMAL == null ? null : readAccessor(json, bin, primitive.attributes.NORMAL);
  const indexSource = primitive.indices == null ? null : readAccessor(json, bin, primitive.indices);

  const sourcePos = positionSource.array as Float32Array;
  const count = positionSource.count;
  const bounds = getBounds(sourcePos);
  const sizeX = bounds.max[0] - bounds.min[0] || 1;
  const sizeY = bounds.max[1] - bounds.min[1] || 1;
  const centerX = (bounds.min[0] + bounds.max[0]) / 2;
  const centerY = (bounds.min[1] + bounds.max[1]) / 2;

  const scale = 210 / Math.max(sizeX, sizeY); // единый масштаб по всем осям
  const dims = {
    width: sizeX * scale,
    depth: sizeY * scale,
    height: (bounds.max[2] - bounds.min[2] || 1) * scale,
  };

  // геометрия (позиции/нормали, GLB Y-up → сцена Z-up) считается один раз;
  // раскраска — по разу на палитру поверх готовых позиций/нормалей
  const positions = new Float32Array(count * 3);
  const normals = normalSource ? new Float32Array(count * 3) : null;
  for (let i = 0; i < count; i++) {
    const sx = sourcePos[i * 3];
    const sy = sourcePos[i * 3 + 1];
    const sz = sourcePos[i * 3 + 2];
    positions[i * 3] = (sx - centerX) * scale;
    positions[i * 3 + 1] = (sz - bounds.min[2]) * scale;
    positions[i * 3 + 2] = -(sy - centerY) * scale;

    if (normalSource) {
      const n = normalSource.array as Float32Array;
      // масштаб одинаков по осям → нормали лишь переставляются и ре-нормализуются
      let nx = n[i * 3];
      let ny = n[i * 3 + 2];
      let nz = -n[i * 3 + 1];
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normals![i * 3] = nx;
      normals![i * 3 + 1] = ny;
      normals![i * 3 + 2] = nz;
    }
  }

  const colors: Record<KeyMeshTheme, Float32Array> = {
    light: buildColors(positions, normals, dims, PALETTES.light),
    dark: buildColors(positions, normals, dims, PALETTES.dark),
  };

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors[theme], 3));
  if (normals) {
    geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  if (indexSource) {
    const indexArray =
      indexSource.array instanceof Uint32Array
        ? new Uint32Array(indexSource.array)
        : new Uint16Array(indexSource.array as ArrayLike<number>);
    geometry.setIndex(new THREE.BufferAttribute(indexArray, 1));
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.44,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
  return { mesh, colors };
}

// вершинные цвета для одной палитры: градиент верх/боковина по позиции+нормали
function buildColors(
  positions: Float32Array,
  normals: Float32Array | null,
  dims: { width: number; depth: number; height: number },
  palette: Palette
): Float32Array {
  const count = positions.length / 3;
  const out = new Float32Array(count * 3);
  const topA = new THREE.Color(palette.topA);
  const topB = new THREE.Color(palette.topB);
  const sideTop = new THREE.Color(palette.sideTop);
  const sideMid = new THREE.Color(palette.sideMid);
  const sideBottom = new THREE.Color(palette.sideBottom);
  const highlight = new THREE.Color(palette.highlight);
  const color = new THREE.Color();
  const top = new THREE.Color();
  const side = new THREE.Color();
  const lower = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const ny = normals ? normals[i * 3 + 1] : 1;

    const height = THREE.MathUtils.clamp(y / dims.height, 0, 1);
    const topMix = THREE.MathUtils.clamp((x / dims.width + 0.5) * 0.52 + (z / dims.depth + 0.5) * 0.48, 0, 1);
    const upness = THREE.MathUtils.clamp((ny - 0.1) / 0.76, 0, 1);
    const frontness = THREE.MathUtils.clamp((z - dims.depth * 0.08) / (dims.depth * 0.42), 0, 1);

    top.lerpColors(topA, topB, topMix);
    lower.lerpColors(sideBottom, sideMid, height);
    side.lerpColors(lower, sideTop, Math.max(0, height - 0.45) / 0.55);
    side.lerp(sideBottom, Math.pow(frontness, 1.05) * (1 - upness) * 0.48);
    color.lerpColors(side, top, upness);

    const glow = Math.max(
      0,
      1 - Math.hypot((x - dims.width * 0.2) / (dims.width * 0.42), (z + dims.depth * 0.03) / (dims.depth * 0.38))
    );
    if (upness > 0.62 && glow > 0) {
      color.lerp(highlight, glow * palette.highlightK * upness);
    }

    out[i * 3] = color.r;
    out[i * 3 + 1] = color.g;
    out[i * 3 + 2] = color.b;
  }
  return out;
}

interface GlbJson {
  meshes?: Array<{ primitives?: Array<{ attributes: Record<string, number>; indices?: number }> }>;
  accessors: Array<{
    bufferView: number;
    byteOffset?: number;
    componentType: number;
    count: number;
    type: string;
  }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number; byteStride?: number }>;
}

function parseGlb(buffer: ArrayBuffer): { json: GlbJson; bin: ArrayBuffer } {
  const view = new DataView(buffer);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("Invalid GLB magic");
  if (view.getUint32(4, true) !== 2) throw new Error("Only glTF 2.0 GLB is supported");

  let offset = 12;
  let json: GlbJson | null = null;
  let bin: ArrayBuffer | null = null;
  const decoder = new TextDecoder();
  while (offset < buffer.byteLength) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (type === 0x4e4f534a) {
      json = JSON.parse(decoder.decode(new Uint8Array(buffer, start, length)));
    } else if (type === 0x004e4942) {
      bin = buffer.slice(start, start + length);
    }
    offset = start + length;
  }
  if (!json || !bin) throw new Error("GLB must contain JSON and BIN chunks");
  return { json, bin };
}

const GLB_COMPONENT: Record<number, { Type: TypedArrayCtor; bytes: number; getter: GlbGetter }> = {
  5121: { Type: Uint8Array, bytes: 1, getter: "getUint8" },
  5123: { Type: Uint16Array, bytes: 2, getter: "getUint16" },
  5125: { Type: Uint32Array, bytes: 4, getter: "getUint32" },
  5126: { Type: Float32Array, bytes: 4, getter: "getFloat32" },
};
const GLB_TYPE_SIZE: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
type TypedArrayCtor =
  | Uint8ArrayConstructor
  | Uint16ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor;
type GlbGetter = "getUint8" | "getUint16" | "getUint32" | "getFloat32";

function readAccessor(json: GlbJson, bin: ArrayBuffer, accessorIndex: number) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const componentCount = GLB_TYPE_SIZE[accessor.type];
  const componentInfo = GLB_COMPONENT[accessor.componentType];
  if (!componentCount || !componentInfo) throw new Error("Unsupported accessor type");

  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const packedStride = componentCount * componentInfo.bytes;
  const stride = view.byteStride || packedStride;
  const length = accessor.count * componentCount;

  if (stride === packedStride) {
    return { array: new componentInfo.Type(bin, byteOffset, length), count: accessor.count };
  }

  // интерливнутый bufferView — распаковываем поэлементно через DataView
  const array = new componentInfo.Type(length);
  const source = new DataView(bin, byteOffset, view.byteLength - (accessor.byteOffset || 0));
  for (let i = 0; i < accessor.count; i++) {
    for (let k = 0; k < componentCount; k++) {
      array[i * componentCount + k] = source[componentInfo.getter](
        i * stride + k * componentInfo.bytes,
        true
      );
    }
  }
  return { array, count: accessor.count };
}

function getBounds(pos: Float32Array) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = pos[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}
