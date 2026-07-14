"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useTools } from "@/components/tools/ToolsProvider";
import { useClickSound } from "./useClickSound";
import { loadKeyCapMesh, makeLabelTexture, applyKeyTheme, KeyMeshData } from "./keyCapMesh";

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
  const { trailEnabled, keyTheme } = useTools();
  const trailEnabledRef = useRef(trailEnabled);
  trailEnabledRef.current = trailEnabled;
  const keyThemeRef = useRef(keyTheme);
  keyThemeRef.current = keyTheme;
  const playClickSound = useClickSound();
  const playClickSoundRef = useRef(playClickSound);
  playClickSoundRef.current = playClickSound;
  // загруженный меш + оба набора вершинных цветов — общий с эффектом смены темы ниже
  const meshDataRef = useRef<KeyMeshData | null>(null);

  // перекраска keycap под тему (light/dark) без перезагрузки GLB — свап атрибута color
  useEffect(() => {
    if (meshDataRef.current) applyKeyTheme(meshDataRef.current, keyTheme);
  }, [keyTheme]);

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
    loadKeyCapMesh(MODEL_URL, keyThemeRef.current)
      .then((data) => {
        if (cancelled) {
          data.mesh.geometry.dispose();
          (data.mesh.material as THREE.Material).dispose();
          return;
        }
        capMesh = data.mesh;
        meshDataRef.current = data;
        capGroup.add(capMesh);
        hitTargets.push(capMesh);
        disposables.push(data.mesh.geometry, data.mesh.material as THREE.Material);
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

    // лёгкий градиентный шлейф во время перетаскивания — непрерывный хвост из
    // капсул-сегментов между последовательными точками пути (не отдельные пятна:
    // концы соседних сегментов стыкуются), каждый сам тает и удаляется через ~2.4с
    const TRAIL_MIN_DIST = 7;
    let lastTrailPoint: { x: number; y: number } | null = null;
    const trailEls: HTMLElement[] = [];
    const spawnTrailSegment = (x1: number, y1: number, x2: number, y2: number) => {
      if (reducedMotion.matches || !trailEnabledRef.current) return;
      const dxSeg = x2 - x1;
      const dySeg = y2 - y1;
      const dist = Math.hypot(dxSeg, dySeg);
      const angle = (Math.atan2(dySeg, dxSeg) * 180) / Math.PI;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      const el = document.createElement("div");
      el.className = "aik-trail";
      el.style.width = `${dist + 20}px`;
      el.style.left = `${midX}px`;
      el.style.top = `${midY}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
      document.body.appendChild(el);
      trailEls.push(el);
      const cleanup = () => {
        el.remove();
        const idx = trailEls.indexOf(el);
        if (idx !== -1) trailEls.splice(idx, 1);
      };
      el.addEventListener("animationend", cleanup, { once: true });
      setTimeout(cleanup, 2600);
    };

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
      playClickSoundRef.current();
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
      playClickSoundRef.current();
      activate();
    };

    const onPointerMove = (event: PointerEvent) => {
      if (pressed) {
        const moveX = event.clientX - dragStartX;
        const moveY = event.clientY - dragStartY;
        if (!dragging && Math.hypot(moveX, moveY) > DRAG_THRESHOLD) {
          dragging = true;
          // сама кнопка при перетаскивании не проседает и не блюрится — это
          // визуальный эффект только клика/удержания на месте (см. .aik-pressed)
          stage?.classList.remove("aik-pressed");
          stage?.classList.add("aik-dragging");
          lastTrailPoint = { x: event.clientX, y: event.clientY };
        }
        if (dragging) {
          dx = dragStartDx + moveX;
          dy = dragStartDy + moveY;
          stage?.style.setProperty("--dx", `${dx}px`);
          stage?.style.setProperty("--dy", `${dy}px`);
          if (lastTrailPoint) {
            const d = Math.hypot(event.clientX - lastTrailPoint.x, event.clientY - lastTrailPoint.y);
            if (d > TRAIL_MIN_DIST) {
              spawnTrailSegment(lastTrailPoint.x, lastTrailPoint.y, event.clientX, event.clientY);
              lastTrailPoint = { x: event.clientX, y: event.clientY };
            }
          }
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
      lastTrailPoint = null;
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
      dragging = false;
      stage?.classList.remove("aik-pressed", "aik-dragging");
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
      meshDataRef.current = null;
      trailEls.forEach((el) => el.remove());
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
