const STORAGE_KEY = "plano-3d-home-gym-v1";
const THEME_KEY = "plano-3d-theme";

const presets = {
  rack: { name: "Rack", width: 120, depth: 60, height: 210, color: "#2f6f80" },
  bench: { name: "Banca", width: 120, depth: 50, height: 45, color: "#424a52" },
  treadmill: { name: "Caminadora", width: 160, depth: 75, height: 120, color: "#30343b" },
  dumbbells: { name: "Mancuernas", width: 100, depth: 45, height: 90, color: "#6f5b43" },
  bike: { name: "Bicicleta", width: 110, depth: 55, height: 130, color: "#8a4a3d" },
  free: { name: "Zona libre", width: 100, depth: 100, height: 3, color: "#84c9aa", transparent: true }
};

let state = loadState();
let selectedId = state.objects[0]?.id || null;
let dirty = false;
let viewMode = "3d";

const canvas = document.getElementById("sceneCanvas");
const viewport = document.getElementById("viewport");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xeef2f0);

const camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.maxPolarAngle = Math.PI * 0.48;
controls.minDistance = 180;
controls.maxDistance = 900;

const ambient = new THREE.HemisphereLight(0xffffff, 0xb8c2bd, 1.5);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(220, 420, 160);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const root = new THREE.Group();
scene.add(root);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const floorHit = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const meshById = new Map();
let dragObject = null;
let pointerMoved = false;

const els = {
  roomWidth: document.getElementById("roomWidth"),
  roomLength: document.getElementById("roomLength"),
  roomHeight: document.getElementById("roomHeight"),
  showWalls: document.getElementById("showWalls"),
  showGrid: document.getElementById("showGrid"),
  roomBadge: document.getElementById("roomBadge"),
  objectBadge: document.getElementById("objectBadge"),
  areaMetric: document.getElementById("areaMetric"),
  objectList: document.getElementById("objectList"),
  emptyInspector: document.getElementById("emptyInspector"),
  inspectorForm: document.getElementById("inspectorForm"),
  deleteBtn: document.getElementById("deleteBtn"),
  duplicateBtn: document.getElementById("duplicateBtn"),
  saveStatus: document.getElementById("saveStatus"),
  view3dBtn: document.getElementById("view3dBtn"),
  viewTopBtn: document.getElementById("viewTopBtn"),
  themeBtn: document.getElementById("themeBtn"),
  themeIcon: document.getElementById("themeIcon")
};

const inspectorInputs = {
  name: document.getElementById("objName"),
  width: document.getElementById("objWidth"),
  depth: document.getElementById("objDepth"),
  height: document.getElementById("objHeight"),
  left: document.getElementById("objLeft"),
  front: document.getElementById("objFront"),
  rotation: document.getElementById("objRotation"),
  color: document.getElementById("objColor")
};

init();

function init() {
  initTheme();
  bindEvents();
  syncRoomControls();
  setCameraMode("3d");
  renderScene();
  updateUi();
  resize();
  animate();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.room && Array.isArray(saved.objects)) {
      return sanitizeState(saved);
    }
  } catch (error) {
    console.warn("No se pudo cargar el plano guardado.", error);
  }

  return sanitizeState({
    room: { width: 220, length: 360, height: 240, showWalls: true, showGrid: true },
    objects: [
      { ...presets.rack, id: makeId(), x: -35, z: -105, rotation: 0 },
      { ...presets.bench, id: makeId(), x: -30, z: -25, rotation: 0 },
      { ...presets.dumbbells, id: makeId(), x: 45, z: 115, rotation: 90 }
    ]
  });
}

function sanitizeState(next) {
  const room = {
    width: clampNumber(next.room?.width, 50, 1000, 220),
    length: clampNumber(next.room?.length, 50, 1000, 360),
    height: clampNumber(next.room?.height, 100, 400, 240),
    showWalls: next.room?.showWalls !== false,
    showGrid: next.room?.showGrid !== false
  };

  const objects = (next.objects || []).map((object) => {
    const clean = {
      id: object.id || makeId(),
      name: String(object.name || "Objeto").slice(0, 32),
      width: clampNumber(object.width, 1, 1000, 60),
      depth: clampNumber(object.depth, 1, 1000, 60),
      height: clampNumber(object.height, 1, 400, 45),
      x: clampNumber(object.x, -1000, 1000, 0),
      z: clampNumber(object.z, -1000, 1000, 0),
      rotation: normalizeRotation(object.rotation || 0),
      color: /^#[0-9a-f]{6}$/i.test(object.color) ? object.color : "#2f7d63",
      transparent: Boolean(object.transparent)
    };
    return clampObjectToRoom(clean, room);
  });

  return { room, objects };
}

function bindEvents() {
  window.addEventListener("resize", resize);

  document.getElementById("presetGrid").addEventListener("click", (event) => {
    const button = event.target.closest("[data-preset]");
    if (!button) return;
    addObject(presets[button.dataset.preset]);
  });

  document.getElementById("customForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addObject({
      name: document.getElementById("customName").value || "Objeto nuevo",
      width: Number(document.getElementById("customWidth").value),
      depth: Number(document.getElementById("customDepth").value),
      height: Number(document.getElementById("customHeight").value),
      color: document.getElementById("customColor").value
    });
  });

  [els.roomWidth, els.roomLength, els.roomHeight].forEach((input) => {
    input.addEventListener("change", updateRoomFromControls);
  });
  els.showWalls.addEventListener("change", updateRoomFromControls);
  els.showGrid.addEventListener("change", updateRoomFromControls);

  Object.values(inspectorInputs).forEach((input) => {
    input.addEventListener("input", updateSelectedFromInspector);
    input.addEventListener("change", updateSelectedFromInspector);
  });

  els.deleteBtn.addEventListener("click", deleteSelected);
  els.duplicateBtn.addEventListener("click", duplicateSelected);
  document.getElementById("saveBtn").addEventListener("click", saveNow);
  document.getElementById("exportBtn").addEventListener("click", exportJson);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", importJson);
  document.getElementById("clearBtn").addEventListener("click", clearPlan);
  els.view3dBtn.addEventListener("click", () => setCameraMode("3d"));
  els.viewTopBtn.addEventListener("click", () => setCameraMode("top"));
  els.themeBtn.addEventListener("click", toggleTheme);

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function addObject(template) {
  const object = clampObjectToRoom({
    id: makeId(),
    name: template.name || "Objeto",
    width: clampNumber(template.width, 1, 1000, 60),
    depth: clampNumber(template.depth, 1, 1000, 60),
    height: clampNumber(template.height, 1, 400, 45),
    x: 0,
    z: 0,
    rotation: 0,
    color: template.color || "#2f7d63",
    transparent: Boolean(template.transparent)
  }, state.room);

  const slot = findOpenSlot(object);
  object.x = slot.x;
  object.z = slot.z;
  state.objects.push(object);
  selectedId = object.id;
  markDirty();
  renderScene();
  updateUi();
}

function findOpenSlot(object) {
  const step = 20;
  const minX = -state.room.width / 2 + object.width / 2;
  const maxX = state.room.width / 2 - object.width / 2;
  const minZ = -state.room.length / 2 + object.depth / 2;
  const maxZ = state.room.length / 2 - object.depth / 2;

  for (let z = minZ; z <= maxZ; z += step) {
    for (let x = minX; x <= maxX; x += step) {
      const candidate = { ...object, x, z };
      if (!state.objects.some((other) => rectanglesOverlap(candidate, other))) {
        return { x, z };
      }
    }
  }

  return { x: object.x, z: object.z };
}

function rectanglesOverlap(a, b) {
  const gap = 6;
  return Math.abs(a.x - b.x) * 2 < a.width + b.width + gap &&
    Math.abs(a.z - b.z) * 2 < a.depth + b.depth + gap;
}

function updateRoomFromControls() {
  state.room.width = clampNumber(els.roomWidth.value, 50, 1000, 220);
  state.room.length = clampNumber(els.roomLength.value, 50, 1000, 360);
  state.room.height = clampNumber(els.roomHeight.value, 100, 400, 240);
  state.room.showWalls = els.showWalls.checked;
  state.room.showGrid = els.showGrid.checked;
  state.objects = state.objects.map((object) => clampObjectToRoom(object, state.room));
  markDirty();
  syncRoomControls();
  renderScene();
  updateUi();
}

function updateSelectedFromInspector() {
  const object = getSelected();
  if (!object) return;

  object.name = inspectorInputs.name.value || "Objeto";
  object.width = clampNumber(inspectorInputs.width.value, 1, 1000, object.width);
  object.depth = clampNumber(inspectorInputs.depth.value, 1, 1000, object.depth);
  object.height = clampNumber(inspectorInputs.height.value, 1, 400, object.height);
  object.rotation = normalizeRotation(Number(inspectorInputs.rotation.value) || 0);
  object.color = inspectorInputs.color.value;

  const left = clampNumber(inspectorInputs.left.value, 0, state.room.width, 0);
  const front = clampNumber(inspectorInputs.front.value, 0, state.room.length, 0);
  object.x = -state.room.width / 2 + left + object.width / 2;
  object.z = -state.room.length / 2 + front + object.depth / 2;

  clampObjectToRoom(object, state.room);
  markDirty();
  renderScene();
  updateUi();
}

function duplicateSelected() {
  const object = getSelected();
  if (!object) return;
  const copy = clampObjectToRoom({
    ...object,
    id: makeId(),
    name: `${object.name} copia`,
    x: object.x + 20,
    z: object.z + 20
  }, state.room);
  state.objects.push(copy);
  selectedId = copy.id;
  markDirty();
  renderScene();
  updateUi();
}

function deleteSelected() {
  if (!selectedId) return;
  state.objects = state.objects.filter((object) => object.id !== selectedId);
  selectedId = state.objects[0]?.id || null;
  markDirty();
  renderScene();
  updateUi();
}

function clearPlan() {
  if (!window.confirm("Eliminar todos los objetos del plano?")) return;
  state.objects = [];
  selectedId = null;
  markDirty();
  renderScene();
  updateUi();
}

function renderScene() {
  while (root.children.length) root.remove(root.children[0]);
  meshById.clear();

  addFloor();
  if (state.room.showGrid) addGrid();
  if (state.room.showWalls) addWalls();
  state.objects.forEach(addObjectMesh);
}

function addFloor() {
  const floorGeometry = new THREE.PlaneGeometry(state.room.width, state.room.length);
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: document.body.dataset.theme === "dark" ? 0x8f7650 : 0xc5a46f,
    roughness: 0.72,
    metalness: 0.02
  });
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  root.add(floor);

  const border = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(state.room.width, 2, state.room.length)),
    new THREE.LineBasicMaterial({ color: 0x42514b, linewidth: 2 })
  );
  border.position.y = 1;
  root.add(border);
}

function addGrid() {
  const size = Math.max(state.room.width, state.room.length);
  const divisions = Math.max(4, Math.round(size / 20));
  const grid = new THREE.GridHelper(
    size,
    divisions,
    document.body.dataset.theme === "dark" ? 0x6e817a : 0x9aa7a2,
    document.body.dataset.theme === "dark" ? 0x364640 : 0xcdd5d1
  );
  grid.position.y = 1.2;
  root.add(grid);
}

function addWalls() {
  const material = new THREE.MeshStandardMaterial({
    color: document.body.dataset.theme === "dark" ? 0x26322f : 0xffffff,
    transparent: true,
    opacity: 0.48,
    roughness: 0.9
  });
  const thickness = 4;
  const back = new THREE.Mesh(new THREE.BoxGeometry(state.room.width, state.room.height, thickness), material);
  back.position.set(0, state.room.height / 2, -state.room.length / 2);
  const left = new THREE.Mesh(new THREE.BoxGeometry(thickness, state.room.height, state.room.length), material);
  left.position.set(-state.room.width / 2, state.room.height / 2, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(thickness, state.room.height, state.room.length), material);
  right.position.set(state.room.width / 2, state.room.height / 2, 0);
  root.add(back, left, right);
}

function addObjectMesh(object) {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(object.color),
    roughness: 0.62,
    metalness: 0.04,
    transparent: object.transparent,
    opacity: object.transparent ? 0.55 : 1
  });

  if (object.id === selectedId) {
    material.emissive = new THREE.Color(0x0f7d5f);
    material.emissiveIntensity = 0.12;
  }

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(object.width, object.height, object.depth), material);
  mesh.position.set(object.x, object.height / 2, object.z);
  mesh.rotation.y = THREE.MathUtils.degToRad(object.rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.id = object.id;
  root.add(mesh);
  meshById.set(object.id, mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: object.id === selectedId ? 0x0b5c45 : 0x25332e })
  );
  edges.position.copy(mesh.position);
  edges.rotation.copy(mesh.rotation);
  root.add(edges);
}

function updateUi() {
  els.roomBadge.textContent = `${state.room.width} x ${state.room.length} cm`;
  els.objectBadge.textContent = `${state.objects.length} ${state.objects.length === 1 ? "objeto" : "objetos"}`;

  const usedArea = state.objects.reduce((sum, object) => sum + object.width * object.depth, 0);
  const roomArea = state.room.width * state.room.length;
  els.areaMetric.textContent = `${Math.round((usedArea / roomArea) * 100)}%`;

  updateObjectList();
  updateInspector();
}

function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));
}

function toggleTheme() {
  applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
  localStorage.setItem(THEME_KEY, document.body.dataset.theme);
  renderScene();
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.body.dataset.theme = nextTheme;
  els.themeIcon.textContent = nextTheme === "dark" ? "☀" : "☾";
  els.themeBtn.title = nextTheme === "dark" ? "Modo claro" : "Modo oscuro";
  els.themeBtn.setAttribute("aria-label", nextTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  scene.background = new THREE.Color(nextTheme === "dark" ? 0x0f1514 : 0xeef2f0);
}

function updateObjectList() {
  els.objectList.innerHTML = "";
  if (!state.objects.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No hay objetos en el plano.";
    els.objectList.appendChild(empty);
    return;
  }

  state.objects.forEach((object) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `object-row${object.id === selectedId ? " active" : ""}`;
    button.innerHTML = `
      <span class="color-dot" style="background:${object.color}"></span>
      <span>
        <strong></strong>
        <span>${object.width} x ${object.depth} x ${object.height} cm</span>
      </span>
    `;
    button.querySelector("strong").textContent = object.name;
    button.addEventListener("click", () => {
      selectedId = object.id;
      renderScene();
      updateUi();
    });
    els.objectList.appendChild(button);
  });
}

function updateInspector() {
  const object = getSelected();
  els.deleteBtn.disabled = !object;
  els.emptyInspector.classList.toggle("hidden", Boolean(object));
  els.inspectorForm.classList.toggle("hidden", !object);
  if (!object) return;

  const left = Math.round(object.x + state.room.width / 2 - object.width / 2);
  const front = Math.round(object.z + state.room.length / 2 - object.depth / 2);

  inspectorInputs.name.value = object.name;
  inspectorInputs.width.value = Math.round(object.width);
  inspectorInputs.depth.value = Math.round(object.depth);
  inspectorInputs.height.value = Math.round(object.height);
  inspectorInputs.left.value = left;
  inspectorInputs.front.value = front;
  inspectorInputs.rotation.value = Math.round(object.rotation);
  inspectorInputs.color.value = object.color;
}

function syncRoomControls() {
  els.roomWidth.value = state.room.width;
  els.roomLength.value = state.room.length;
  els.roomHeight.value = state.room.height;
  els.showWalls.checked = state.room.showWalls;
  els.showGrid.checked = state.room.showGrid;
}

function getSelected() {
  return state.objects.find((object) => object.id === selectedId) || null;
}

function onPointerDown(event) {
  pointerMoved = false;
  const object = hitTestObject(event);
  if (!object) return;

  selectedId = object.id;
  dragObject = object;
  controls.enabled = false;

  const mesh = meshById.get(object.id);
  if (intersectFloor(event)) {
    dragOffset.copy(floorHit).sub(mesh.position);
  } else {
    dragOffset.set(0, 0, 0);
  }

  renderScene();
  updateUi();
}

function onPointerMove(event) {
  if (!dragObject) return;
  pointerMoved = true;
  if (!intersectFloor(event)) return;
  dragObject.x = floorHit.x - dragOffset.x;
  dragObject.z = floorHit.z - dragOffset.z;
  clampObjectToRoom(dragObject, state.room);
  markDirty();
  renderScene();
  updateUi();
}

function onPointerUp() {
  if (dragObject && !pointerMoved) {
    renderScene();
    updateUi();
  }
  dragObject = null;
  controls.enabled = true;
}

function hitTestObject(event) {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects([...meshById.values()], false);
  const hit = hits[0];
  return hit ? state.objects.find((object) => object.id === hit.object.userData.id) : null;
}

function intersectFloor(event) {
  setPointer(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.ray.intersectPlane(floorPlane, floorHit);
}

function setPointer(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function setCameraMode(mode) {
  viewMode = mode;
  const maxSize = Math.max(state.room.width, state.room.length);
  if (mode === "top") {
    camera.position.set(0, maxSize * 1.35, 0.01);
    controls.target.set(0, 0, 0);
    controls.enableRotate = false;
  } else {
    camera.position.set(state.room.width * 0.95, 300, state.room.length * 0.95);
    controls.target.set(0, 40, 0);
    controls.enableRotate = true;
  }
  camera.near = 1;
  camera.far = 5000;
  camera.updateProjectionMatrix();
  controls.update();
  els.view3dBtn.classList.toggle("active", mode === "3d");
  els.viewTopBtn.classList.toggle("active", mode === "top");
}

function resize() {
  const rect = viewport.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

function saveNow() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
  dirty = false;
  els.saveStatus.textContent = "Guardado";
}

function markDirty() {
  dirty = true;
  els.saveStatus.textContent = "Cambios sin guardar";
}

function exportJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plano-3d-gimnasio.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importJson(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      state = sanitizeState(JSON.parse(reader.result));
      selectedId = state.objects[0]?.id || null;
      syncRoomControls();
      markDirty();
      setCameraMode(viewMode);
      renderScene();
      updateUi();
    } catch (error) {
      window.alert("El archivo no parece ser un plano valido.");
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function clampObjectToRoom(object, room) {
  object.width = Math.min(object.width, room.width);
  object.depth = Math.min(object.depth, room.length);
  const minX = -room.width / 2 + object.width / 2;
  const maxX = room.width / 2 - object.width / 2;
  const minZ = -room.length / 2 + object.depth / 2;
  const maxZ = room.length / 2 - object.depth / 2;
  object.x = clampNumber(object.x, minX, maxX, 0);
  object.z = clampNumber(object.z, minZ, maxZ, 0);
  return object;
}

function normalizeRotation(value) {
  const rotation = Number(value) || 0;
  return ((rotation % 360) + 360) % 360;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function makeId() {
  return `obj-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
