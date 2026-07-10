import * as THREE from "three";

/* Загрузка и «запекание» раскраски 3D-клавиши «АИ» — чистая (без React) часть
   AiKeyButton: разбор GLB вручную (без GLTFLoader) и покраска вершин по позиции/
   нормали (розово-малиновый верх, красно-золотая боковина). Вынесено из компонента,
   т.к. это самодостаточная геометрия/парсинг, а не UI-логика. */

const LABEL_URL = "/assets/alfa-ai-button/ai-letter.svg";

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

export async function loadKeyCapMesh(url: string): Promise<THREE.Mesh> {
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
  const modelWidth = sizeX * scale;
  const modelDepth = sizeY * scale;
  const modelHeight = (bounds.max[2] - bounds.min[2] || 1) * scale;

  const positions = new Float32Array(count * 3);
  const normals = normalSource ? new Float32Array(count * 3) : null;
  const colors = new Float32Array(count * 3);
  const topA = new THREE.Color("#d8004e");
  const topB = new THREE.Color("#ff5f9f");
  const sideTop = new THREE.Color("#c60038");
  const sideMid = new THREE.Color("#ff315f");
  const sideBottom = new THREE.Color("#f2bc1f");
  const white = new THREE.Color("#ffffff");
  const color = new THREE.Color();
  const top = new THREE.Color();
  const side = new THREE.Color();
  const lower = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const sx = sourcePos[i * 3];
    const sy = sourcePos[i * 3 + 1];
    const sz = sourcePos[i * 3 + 2];
    const x = (sx - centerX) * scale;
    const y = (sz - bounds.min[2]) * scale;
    const z = -(sy - centerY) * scale;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    let nx = 0;
    let ny = 1;
    let nz = 0;
    if (normalSource) {
      const normalArray = normalSource.array as Float32Array;
      // GLB Y-up → сцена Z-up (те же оси, что у позиций выше); масштаб одинаков,
      // поэтому нормали лишь переставляются/инвертируются и ре-нормализуются
      nx = normalArray[i * 3];
      ny = normalArray[i * 3 + 2];
      nz = -normalArray[i * 3 + 1];
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      normals![i * 3] = nx;
      normals![i * 3 + 1] = ny;
      normals![i * 3 + 2] = nz;
    }

    const height = THREE.MathUtils.clamp(y / modelHeight, 0, 1);
    const topMix = THREE.MathUtils.clamp((x / modelWidth + 0.5) * 0.52 + (z / modelDepth + 0.5) * 0.48, 0, 1);
    const upness = THREE.MathUtils.clamp((ny - 0.1) / 0.76, 0, 1);
    const frontness = THREE.MathUtils.clamp((z - modelDepth * 0.08) / (modelDepth * 0.42), 0, 1);

    top.lerpColors(topA, topB, topMix);
    lower.lerpColors(sideBottom, sideMid, height);
    side.lerpColors(lower, sideTop, Math.max(0, height - 0.45) / 0.55);
    side.lerp(sideBottom, Math.pow(frontness, 1.05) * (1 - upness) * 0.48);
    color.lerpColors(side, top, upness);

    const glow = Math.max(
      0,
      1 -
        Math.hypot(
          (x - modelWidth * 0.2) / (modelWidth * 0.42),
          (z + modelDepth * 0.03) / (modelDepth * 0.38)
        )
    );
    if (upness > 0.62 && glow > 0) {
      color.lerp(white, glow * 0.08 * upness);
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
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

  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.44,
      metalness: 0,
      side: THREE.DoubleSide,
    })
  );
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
