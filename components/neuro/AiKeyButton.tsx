"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/* 3D-клавиша «АИ» — порт alfa-ai-button-three.js (песочница /alfa-ai) на React.
   Сцена/физика те же (пружина нажатия, наклон к курсору через raycast, спарк-частицы);
   отличия только в обвязке под StrictMode-safe useEffect (dispose на cleanup, как в
   useNeuroBar/useV1Page/useV2Page) и проп onActivate (вызывается по release — ведёт
   в nbActivate() строки). Звук клика — порт setup из alfa-ai-button.js (отдельный
   файл в песочнице, сам three.js-модуль звука не проигрывал). Клик засчитывается по
   всему канвасу (не только по мешу) — иначе мимо реальной геометрии клавиши клик
   молча не срабатывал. Если между press/release курсор ушёл дальше порога — это
   перетаскивание (сдвигает клавишу через --dx/--dy), а не активация строки. */

const MODEL_URL = "/assets/alfa-ai-button/key_cap__template.glb";
const SPARKLE_URL = "/assets/alfa-ai-button/sparkle.svg";
const LABEL_URL = "/assets/alfa-ai-button/ai-letter.svg";
const SOUND_ROOT = "/assets/sounds/";
const KEY_SOUND_NAMES = ["key_sound_1", "key_sound_2", "key_sound_3", "key_sound_4"];
const DRAG_THRESHOLD = 3;

const WIDTH = 256;
const HEIGHT = 246;

interface AiKeyButtonProps {
  onActivate?: () => void;
  className?: string;
}

export default function AiKeyButton({ onActivate, className }: AiKeyButtonProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch {
      const stage = canvas.closest(".aik-stage");
      if (stage) stage.innerHTML = "";
      return;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // звук клика: пул Audio на вариант (чтобы быстрые клики не обрезали друг друга)
    const canOgg = document.createElement("audio").canPlayType('audio/ogg; codecs="vorbis"');
    const soundExt = canOgg ? "ogg" : "mp3";
    const soundBanks = KEY_SOUND_NAMES.map((name) => ({
      index: 0,
      pool: Array.from({ length: 3 }, () => {
        const audio = new Audio(`${SOUND_ROOT}${name}.${soundExt}`);
        audio.preload = "auto";
        return audio;
      }),
    }));
    const playRandomKeySound = () => {
      const bank = soundBanks[Math.floor(Math.random() * soundBanks.length)];
      const audio = bank.pool[bank.index];
      bank.index = (bank.index + 1) % bank.pool.length;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    };

    const scene = new THREE.Scene();
    const viewHeight = 270;
    const viewWidth = viewHeight * (WIDTH / HEIGHT);
    const camera = new THREE.OrthographicCamera(
      -viewWidth / 2,
      viewWidth / 2,
      viewHeight / 2,
      -viewHeight / 2,
      1,
      2000
    );
    camera.position.set(0, 320, 255);
    camera.lookAt(0, 18, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.08));
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
    keyLight.position.set(-120, 260, 210);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xffb7d1, 0.95);
    rimLight.position.set(150, 110, 220);
    scene.add(rimLight);
    const warmFill = new THREE.DirectionalLight(0xffbe3f, 0.62);
    warmFill.position.set(0, 30, 260);
    scene.add(warmFill);

    const keyGroup = new THREE.Group();
    scene.add(keyGroup);
    const capGroup = new THREE.Group();
    keyGroup.add(capGroup);

    const hitTargets: THREE.Object3D[] = [];
    let capMesh: THREE.Mesh | null = null;
    const disposables: Array<{ dispose: () => void }> = [];

    const labelTexture = makeLabelTexture(renderer, disposables);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(126, 58),
      new THREE.MeshBasicMaterial({
        map: labelTexture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
    );
    label.rotation.x = -Math.PI / 2;
    label.position.set(-2, 104, -7);
    capGroup.add(label);
    disposables.push(label.geometry, label.material as THREE.Material);

    const sparkleTexture = new THREE.Texture();
    sparkleTexture.colorSpace = THREE.SRGBColorSpace;
    const sparkleImg = new Image();
    sparkleImg.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = 128;
      c.getContext("2d")!.drawImage(sparkleImg, 0, 0, 128, 128);
      sparkleTexture.image = c;
      sparkleTexture.needsUpdate = true;
    };
    sparkleImg.src = SPARKLE_URL;

    const sparkleMaterial = new THREE.SpriteMaterial({
      map: sparkleTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const sparkle = new THREE.Sprite(sparkleMaterial);
    const SPARKLE_SCALE = 42;
    sparkle.scale.setScalar(SPARKLE_SCALE);
    sparkle.position.set(56, 112, -48);
    capGroup.add(sparkle);
    disposables.push(sparkleTexture, sparkleMaterial);

    const stage = canvas.closest<HTMLElement>(".aik-stage");
    let reboundTimer: ReturnType<typeof setTimeout> | undefined;

    let cancelled = false;
    loadKeyCapMesh(MODEL_URL)
      .then((mesh) => {
        if (cancelled) {
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
          return;
        }
        capMesh = mesh;
        capGroup.add(capMesh);
        hitTargets.push(capMesh);
        disposables.push(mesh.geometry, mesh.material as THREE.Material);
      })
      .catch((error) => {
        console.error("Key cap model failed to load", error);
      });

    const TRAVEL = 24;
    const REST = 0;
    let lift = REST;
    let liftVelocity = 0;
    let pressed = false;
    let hovered = false;
    let sparkleBurst = -1;

    // перетаскивание клавиши (свободное позиционирование): дельта копится в dx/dy
    // (--dx/--dy на .aik-stage), клик засчитывается только если сдвиг меньше порога
    let dx = 0;
    let dy = 0;
    let dragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartDx = 0;
    let dragStartDy = 0;

    const tiltTarget = { x: 0, z: 0 };
    const MAX_TILT = THREE.MathUtils.degToRad(9);
    const BASE_TOWARD_VIEWER = THREE.MathUtils.degToRad(14);
    const BASE_Z_ANGLE = THREE.MathUtils.degToRad(-5);
    keyGroup.rotation.x = BASE_TOWARD_VIEWER;
    keyGroup.rotation.z = BASE_Z_ANGLE;

    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();

    const pickKey = (event: PointerEvent) => {
      if (!hitTargets.length) return null;
      const rect = canvas.getBoundingClientRect();
      pointerNdc.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(hitTargets, false);
      return hits.length ? hits[0].point : null;
    };

    const press = () => {
      if (pressed) return;
      pressed = true;
      sparkleBurst = -1;
      clearTimeout(reboundTimer);
      stage?.classList.remove("aik-clicked");
      stage?.classList.add("aik-hovered", "aik-pressed");
      playRandomKeySound();
    };

    const particles: Array<{
      sprite: THREE.Sprite;
      vx: number;
      vy: number;
      vz: number;
      spin: number;
      life: number;
      ttl: number;
    }> = [];
    const burst = () => {
      if (reducedMotion.matches) return;
      const origin = capGroup.localToWorld(sparkle.position.clone());
      const count = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const material = sparkleMaterial.clone();
        const p = new THREE.Sprite(material);
        p.scale.setScalar(SPARKLE_SCALE);
        p.position.copy(origin);
        scene.add(p);
        const angle = THREE.MathUtils.degToRad(
          90 - (i - (count - 1) / 2) * 38 + (Math.random() * 12 - 6)
        );
        particles.push({
          sprite: p,
          vx: Math.cos(angle) * (110 + Math.random() * 90),
          vy: Math.sin(angle) * (170 + Math.random() * 120),
          vz: (Math.random() - 0.5) * 50,
          spin: (Math.random() - 0.5) * 6,
          life: 0,
          ttl: 0.55 + Math.random() * 0.2,
        });
      }
    };

    // помечаем, что этот клик уже обработан через pointerdown/pointerup — иначе
    // следующий следом нативный "click" (см. onClick ниже) активирует строку повторно
    let pointerHandledClick = false;
    const activate = () => {
      sparkleBurst = 0;
      burst();
      stage?.classList.add("aik-clicked");
      clearTimeout(reboundTimer);
      reboundTimer = setTimeout(() => stage?.classList.remove("aik-clicked"), 380);
      onActivateRef.current?.();
    };

    const release = () => {
      if (!pressed) return;
      pressed = false;
      const wasDragging = dragging;
      dragging = false;
      // помечаем как обработанное pointer-событиями в любом случае (в т.ч. drag) —
      // иначе последующий нативный click (см. onClick) активирует строку и после
      // перетаскивания, ведь браузер шлёт click после mouseup независимо от сдвига
      pointerHandledClick = true;
      stage?.classList.remove("aik-pressed", "aik-dragging");
      if (wasDragging) return; // сдвинули клавишу — не считаем это кликом
      activate();
    };
    // страховка на случай, если клик пришёл без pointerdown/pointerup вообще
    // (некоторые способы эмуляции клика шлют только событие click) — было и в
    // исходном демо (alfa-ai-button-rounded.html) ровно по этой причине
    const onClick = () => {
      if (pointerHandledClick) {
        pointerHandledClick = false;
        return;
      }
      playRandomKeySound();
      activate();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pressed) {
        const moveX = event.clientX - dragStartX;
        const moveY = event.clientY - dragStartY;
        if (!dragging && Math.hypot(moveX, moveY) > DRAG_THRESHOLD) {
          dragging = true;
          stage?.classList.add("aik-dragging");
        }
        if (dragging) {
          dx = dragStartDx + moveX;
          dy = dragStartDy + moveY;
          stage?.style.setProperty("--dx", `${dx}px`);
          stage?.style.setProperty("--dy", `${dy}px`);
        }
      }
      const hit = pickKey(event);
      hovered = !!hit;
      if (hit) {
        const nx = THREE.MathUtils.clamp(hit.x / 118, -1, 1);
        const nz = THREE.MathUtils.clamp(hit.z / 92, -1, 1);
        tiltTarget.x = nz * MAX_TILT;
        tiltTarget.z = -nx * MAX_TILT;
      } else {
        tiltTarget.x = 0;
        tiltTarget.z = 0;
      }
    };
    const onPointerLeave = () => {
      if (pressed) return; // не сбрасывать hover-класс во время захвата указателя (drag)
      hovered = false;
      tiltTarget.x = 0;
      tiltTarget.z = 0;
      stage?.classList.remove("aik-hovered");
    };
    // клик засчитывается по всему канвасу (не только по мешу key cap) — иначе
    // мимо реальной 3D-геометрии клик молча не активировал строку
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      canvas.setPointerCapture(event.pointerId);
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragStartDx = dx;
      dragStartDy = dy;
      dragging = false;
      press();
    };
    const onPointerUp = () => release();
    const onPointerCancel = () => release();
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.code === "Space" || event.code === "Enter") && !event.repeat) {
        event.preventDefault();
        press();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault();
        release();
      }
    };
    const onBlur = () => {
      pressed = false;
    };

    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("blur", onBlur);

    const clock = new THREE.Clock();
    let rafId = 0;

    const update = (dt: number) => {
      const target = pressed ? REST - TRAVEL : hovered ? REST - 4 : REST;
      if (reducedMotion.matches) {
        lift = target;
        liftVelocity = 0;
      } else {
        const stiffness = pressed ? 2600 : 850;
        const damping = pressed ? 40 : 20;
        liftVelocity += (target - lift) * stiffness * dt;
        liftVelocity *= Math.exp(-damping * dt);
        lift += liftVelocity * dt;
      }
      capGroup.position.y = lift;

      const ease = Math.min(1, dt * 14);
      keyGroup.rotation.x += (BASE_TOWARD_VIEWER + tiltTarget.x - keyGroup.rotation.x) * ease;
      keyGroup.rotation.z += (BASE_Z_ANGLE + tiltTarget.z - keyGroup.rotation.z) * ease;

      let sparkleScale = pressed ? 0.7 : hovered ? 1.12 : 1;
      if (sparkleBurst >= 0 && !reducedMotion.matches) {
        sparkleBurst += dt;
        const t = sparkleBurst;
        if (t < 0.14) {
          sparkleScale = 0.7 * (1 - t / 0.14);
        } else if (t < 0.6) {
          sparkleScale = 0;
        } else if (t < 0.95) {
          const k = (t - 0.6) / 0.35;
          const c1 = 1.70158;
          const c3 = c1 + 1;
          sparkleScale = 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
        } else {
          sparkleBurst = -1;
        }
      }
      sparkle.scale.setScalar(SPARKLE_SCALE * Math.max(0, sparkleScale));

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.ttl) {
          scene.remove(p.sprite);
          p.sprite.material.dispose();
          particles.splice(i, 1);
          continue;
        }
        p.vy -= 500 * dt;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        p.sprite.material.rotation += p.spin * dt;
        const fade = Math.max(0, (p.life / p.ttl - 0.4) / 0.6);
        p.sprite.material.opacity = 1 - fade * fade;
      }
    };

    const tick = () => {
      update(Math.min(clock.getDelta(), 1 / 30));
      renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      clearTimeout(reboundTimer);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerCancel);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("blur", onBlur);
      particles.forEach((p) => {
        scene.remove(p.sprite);
        p.sprite.material.dispose();
      });
      disposables.forEach((d) => d.dispose());
      soundBanks.forEach((bank) => bank.pool.forEach((audio) => audio.pause()));
      renderer.dispose();
    };
  }, []);

  return (
    <div className={`aik-stage${className ? ` ${className}` : ""}`}>
      <div className="aik-canvas-mask">
        <canvas ref={canvasRef} className="aik-canvas" tabIndex={0} aria-label="Открыть нейропомощника" />
      </div>
    </div>
  );
}

function makeLabelTexture(renderer: THREE.WebGLRenderer, disposables: Array<{ dispose: () => void }>) {
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

async function loadKeyCapMesh(url: string): Promise<THREE.Mesh> {
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

  const uniformScale = 210 / Math.max(sizeX, sizeY);
  const scaleX = uniformScale;
  const scaleZ = uniformScale;
  const scaleY = uniformScale;
  const modelWidth = sizeX * uniformScale;
  const modelDepth = sizeY * uniformScale;
  const modelHeight = (bounds.max[2] - bounds.min[2] || 1) * uniformScale;

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
    const x = (sx - centerX) * scaleX;
    const y = (sz - bounds.min[2]) * scaleY;
    const z = -(sy - centerY) * scaleZ;

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    let nx = 0;
    let ny = 1;
    let nz = 0;
    if (normalSource) {
      const normalArray = normalSource.array as Float32Array;
      const snx = normalArray[i * 3];
      const sny = normalArray[i * 3 + 1];
      const snz = normalArray[i * 3 + 2];
      nx = snx / scaleX;
      ny = snz / scaleY;
      nz = -sny / scaleZ;
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

function readAccessor(json: GlbJson, bin: ArrayBuffer, accessorIndex: number) {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type as "SCALAR" | "VEC2" | "VEC3" | "VEC4"];
  const componentInfo = {
    5121: { Type: Uint8Array, bytes: 1 },
    5123: { Type: Uint16Array, bytes: 2 },
    5125: { Type: Uint32Array, bytes: 4 },
    5126: { Type: Float32Array, bytes: 4 },
  }[accessor.componentType as 5121 | 5123 | 5125 | 5126];
  if (!componentCount || !componentInfo) throw new Error("Unsupported accessor type");

  const byteOffset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const packedStride = componentCount * componentInfo.bytes;
  const stride = view.byteStride || packedStride;
  const length = accessor.count * componentCount;

  if (stride === packedStride) {
    return {
      array: new componentInfo.Type(bin, byteOffset, length),
      count: accessor.count,
      itemSize: componentCount,
    };
  }

  const array = new componentInfo.Type(length);
  const source = new DataView(bin, byteOffset, view.byteLength - (accessor.byteOffset || 0));
  const getters = {
    5121: "getUint8",
    5123: "getUint16",
    5125: "getUint32",
    5126: "getFloat32",
  } as const;
  const getter = getters[accessor.componentType as 5121 | 5123 | 5125 | 5126];
  for (let i = 0; i < accessor.count; i++) {
    for (let k = 0; k < componentCount; k++) {
      array[i * componentCount + k] = source[getter](i * stride + k * componentInfo.bytes, true);
    }
  }
  return { array, count: accessor.count, itemSize: componentCount };
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
