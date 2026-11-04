import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const canvas = document.querySelector("#model-viewer");
const stage = document.querySelector(".stage");
const status = document.querySelector(".model-status");
const stageLabel = document.querySelector(".stage-label");
const spinToggle = document.querySelector(".spin-toggle");
const swatches = document.querySelectorAll(".swatch");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.5, 6);

let renderer;
let model;
let autoRotate = !reducedMotion;
let dragging = false;
let previousX = 0;
let previousY = 0;
let animationFrame;
let cameraDistance = camera.position.length();
const baseColors = [];

function setStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle("is-error", isError);
  status.hidden = !message;
}

function resizeRenderer() {
  if (!renderer) return;
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function tintModel(hexColor) {
  const tint = new THREE.Color(hexColor);
  for (const { material, color } of baseColors) {
    if (material.color) material.color.copy(color).multiply(tint);
  }
}

function prepareModel(loadedModel) {
  model = loadedModel;

  model.traverse((node) => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    const clonedMaterials = materials.map((original) => {
      const material = original.clone();
      if (material.color) baseColors.push({ material, color: material.color.clone() });
      return material;
    });
    node.material = Array.isArray(node.material) ? clonedMaterials : clonedMaterials[0];
  });

  const bounds = new THREE.Box3().setFromObject(model);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const largestDimension = Math.max(size.x, size.y, size.z);

  if (!Number.isFinite(largestDimension) || largestDimension <= 0) {
    throw new Error("El archivo plazaCasco.glb no contiene geometría visible.");
  }

  const scale = 3.2 / largestDimension;
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
  scene.add(model);
  tintModel("#a7f36a");
  setStatus("");
  stageLabel.innerHTML = "<span>01</span> — Modelo interactivo";
}

function animate() {
  animationFrame = requestAnimationFrame(animate);
  if (model && autoRotate && !dragging) model.rotation.y += 0.003;
  renderer.render(scene, camera);
}

function stopDragging() {
  if (!dragging) return;
  dragging = false;
  stageLabel.innerHTML = "<span>01</span> — Modelo interactivo";
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  scene.add(new THREE.HemisphereLight(0xe4f0ff, 0x273128, 2.2));

  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0xa7f36a, 2);
  rimLight.position.set(-4, 2, -3);
  scene.add(rimLight);

  resizeRenderer();
  window.addEventListener("resize", resizeRenderer);
  animationFrame = requestAnimationFrame(animate);

  new GLTFLoader().load(
    "./plazaCasco.glb",
    (gltf) => {
      try {
        prepareModel(gltf.scene);
      } catch (error) {
        console.error("No se pudo preparar plazaCasco.glb:", error);
        setStatus("No se pudo mostrar el modelo 3D.", true);
        stageLabel.innerHTML = "<span>01</span> — Error al cargar";
      }
    },
    (event) => {
      if (event.total) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setStatus(`Cargando plazaCasco.glb… ${progress}%`);
      }
    },
    (error) => {
      console.error("No se pudo cargar plazaCasco.glb:", error);
      setStatus("No se pudo cargar plazaCasco.glb. Comprueba que el archivo esté junto a index.html y abre la página desde un servidor local.", true);
      stageLabel.innerHTML = "<span>01</span> — Error al cargar";
    }
  );
} catch (error) {
  console.error("No se pudo iniciar el visor 3D:", error);
  setStatus("No se pudo iniciar el visor 3D en este navegador.", true);
  stageLabel.innerHTML = "<span>01</span> — Error al iniciar";
}

canvas.addEventListener("pointerdown", (event) => {
  if (!model) return;
  dragging = true;
  previousX = event.clientX;
  previousY = event.clientY;
  canvas.setPointerCapture(event.pointerId);
  stageLabel.innerHTML = "<span>01</span> — Explorando";
});

canvas.addEventListener("pointermove", (event) => {
  if (!dragging || !model) return;
  model.rotation.y += (event.clientX - previousX) * 0.008;
  model.rotation.x = Math.max(
    -1.1,
    Math.min(1.1, model.rotation.x + (event.clientY - previousY) * 0.006)
  );
  previousX = event.clientX;
  previousY = event.clientY;
});

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);
canvas.addEventListener("lostpointercapture", stopDragging);

canvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  cameraDistance = THREE.MathUtils.clamp(cameraDistance + event.deltaY * 0.004, 3, 10);
  camera.position.setLength(cameraDistance);
  camera.lookAt(0, 0, 0);
}, { passive: false });

swatches.forEach((swatch) => {
  swatch.addEventListener("click", () => {
    const color = swatch.dataset.color;
    document.documentElement.style.setProperty("--accent", color);
    const rgb = new THREE.Color(color);
    document.documentElement.style.setProperty(
      "--accent-rgb",
      `${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)}`
    );
    if (model) tintModel(color);
    swatches.forEach((item) => item.setAttribute("aria-pressed", String(item === swatch)));
  });
});

spinToggle.addEventListener("click", () => {
  autoRotate = !autoRotate;
  spinToggle.setAttribute("aria-pressed", String(autoRotate));
});

if (reducedMotion) spinToggle.setAttribute("aria-pressed", "false");

window.addEventListener("beforeunload", () => {
  cancelAnimationFrame(animationFrame);
  renderer?.dispose();
});