(function () {
  window.Plano3D = window.Plano3D || {};

  const { clampNumber } = window.Plano3D.utils;

  class SceneRenderer {
    constructor(canvas, viewport) {
      this.canvas = canvas;
      this.viewport = viewport;
      this.THREE = window.THREE;
      this.renderer = new this.THREE.WebGLRenderer({ canvas, antialias: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.outputEncoding = this.THREE.sRGBEncoding;
      this.renderer.localClippingEnabled = true;

      this.scene = new this.THREE.Scene();
      this.camera = new this.THREE.PerspectiveCamera(45, 1, 1, 5000);
      this.controls = new this.THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.12;
      this.controls.enabled = false;

      this.root = new this.THREE.Group();
      this.previewRoot = new this.THREE.Group();
      this.scene.add(this.root, this.previewRoot);

      this.raycaster = new this.THREE.Raycaster();
      this.pointer = new this.THREE.Vector2();
      this.floorPlane = new this.THREE.Plane(new this.THREE.Vector3(0, 1, 0), 0);
      this.floorHit = new this.THREE.Vector3();
      this.meshById = new Map();
      this.nodeById = new Map();
      this.viewMode = "3d";
      this.theme = "dark";
      this.selectedId = null;

      this.addLights();
      this.setTheme("dark");
    }

    addLights() {
      const ambient = new this.THREE.HemisphereLight(0xffffff, 0xb8c2bd, 1.5);
      const sun = new this.THREE.DirectionalLight(0xffffff, 1.2);
      sun.position.set(220, 420, 160);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      this.scene.add(ambient, sun);
    }

    renderModel(state, selectedId) {
      this.selectedId = selectedId;
      this.clearGroup(this.root);
      this.meshById.clear();
      this.nodeById.clear();

      this.addFloor(state);
      if (state.room.showGrid) this.addGrid(state);
      if (state.room.showWalls) this.addWalls(state);
      this.addGuides(state);
      state.objects.forEach((object) => this.addObjectMesh(object, state));
      this.applySection(state);
    }

    setTheme(theme) {
      this.theme = theme === "dark" ? "dark" : "light";
      this.scene.background = new this.THREE.Color(this.theme === "dark" ? 0x0f1514 : 0xeef2f0);
    }

    clearPreview() {
      this.clearGroup(this.previewRoot);
    }

    showBoxPreview(bounds, height, color) {
      this.clearPreview();
      if (!bounds) return;
      const material = new this.THREE.MeshStandardMaterial({
        color: new this.THREE.Color(color || "#45c295"),
        transparent: true,
        opacity: 0.42,
        roughness: 0.7
      });
      const mesh = new this.THREE.Mesh(
        new this.THREE.BoxGeometry(Math.max(1, bounds.width), Math.max(1, height), Math.max(1, bounds.depth)),
        material
      );
      mesh.position.set(bounds.x, Math.max(1, height) / 2, bounds.z);
      this.previewRoot.add(mesh);
      this.previewRoot.add(this.createEdges(mesh, 0x45c295));
    }

    showMeasurePreview(start, end, label) {
      this.clearPreview();
      if (!start || !end) return;
      const geometry = new this.THREE.BufferGeometry().setFromPoints([
        new this.THREE.Vector3(start.x, 2, start.z),
        new this.THREE.Vector3(end.x, 2, end.z)
      ]);
      const line = new this.THREE.Line(geometry, new this.THREE.LineBasicMaterial({ color: 0xffcf5a }));
      this.previewRoot.add(line);
      this.addMarker(start, 0xffcf5a);
      this.addMarker(end, 0xffcf5a);
      if (label) this.addTextSprite(label, end.x, 8, end.z, 0xffcf5a);
    }

    showInference(point, label) {
      const old = this.previewRoot.getObjectByName("inference");
      if (old) this.previewRoot.remove(old);
      const group = new this.THREE.Group();
      group.name = "inference";
      const geometry = new this.THREE.RingGeometry(3.5, 5.5, 24);
      const material = new this.THREE.MeshBasicMaterial({
        color: 0x45c295,
        side: this.THREE.DoubleSide,
        transparent: true,
        opacity: 0.9
      });
      const marker = new this.THREE.Mesh(geometry, material);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(point.x, 2.4, point.z);
      group.add(marker);
      if (label) group.add(this.createTextSprite(label, 0x45c295, point.x, 13, point.z));
      this.previewRoot.add(group);
    }

    addMarker(point, color) {
      const geometry = new this.THREE.SphereGeometry(3, 16, 12);
      const material = new this.THREE.MeshBasicMaterial({ color });
      const marker = new this.THREE.Mesh(geometry, material);
      marker.position.set(point.x, 3, point.z);
      this.previewRoot.add(marker);
    }

    addTextSprite(text, x, y, z, color) {
      this.previewRoot.add(this.createTextSprite(text, color, x, y, z));
    }

    createTextSprite(text, color, x, y, z) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 64;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(12, 18, 16, 0.86)";
      ctx.strokeStyle = "#45c295";
      ctx.lineWidth = 2;
      roundedRect(ctx, 8, 8, 240, 48, 12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
      ctx.font = "700 22px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, 128, 32);
      const texture = new this.THREE.CanvasTexture(canvas);
      const material = new this.THREE.SpriteMaterial({ map: texture, transparent: true });
      const sprite = new this.THREE.Sprite(material);
      sprite.scale.set(70, 18, 1);
      sprite.position.set(x, y, z);
      return sprite;
    }

    addFloor(state) {
      const floorGeometry = new this.THREE.PlaneGeometry(state.room.width, state.room.length);
      const floorMaterial = new this.THREE.MeshStandardMaterial({
        color: this.theme === "dark" ? 0x2b3532 : 0xc5a46f,
        roughness: 0.72,
        metalness: 0.02
      });
      const floor = new this.THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      this.root.add(floor);

      const border = new this.THREE.LineSegments(
        new this.THREE.EdgesGeometry(new this.THREE.BoxGeometry(state.room.width, 2, state.room.length)),
        new this.THREE.LineBasicMaterial({ color: this.theme === "dark" ? 0x6e817a : 0x42514b })
      );
      border.position.y = 1;
      this.root.add(border);
    }

    addGrid(state) {
      const size = Math.max(state.room.width, state.room.length);
      const divisions = Math.max(4, Math.round(size / Math.max(5, state.settings.snapSize || 10)));
      const grid = new this.THREE.GridHelper(
        size,
        divisions,
        this.theme === "dark" ? 0x6e817a : 0x9aa7a2,
        this.theme === "dark" ? 0x27342f : 0xcdd5d1
      );
      grid.position.y = 1.2;
      this.root.add(grid);
    }

    addWalls(state) {
      const material = new this.THREE.MeshStandardMaterial({
        color: this.theme === "dark" ? 0x33413d : 0xffffff,
        transparent: true,
        opacity: this.theme === "dark" ? 0.34 : 0.48,
        roughness: 0.9
      });
      const thickness = 4;
      const back = new this.THREE.Mesh(new this.THREE.BoxGeometry(state.room.width, state.room.height, thickness), material);
      back.position.set(0, state.room.height / 2, -state.room.length / 2);
      const left = new this.THREE.Mesh(new this.THREE.BoxGeometry(thickness, state.room.height, state.room.length), material);
      left.position.set(-state.room.width / 2, state.room.height / 2, 0);
      const right = new this.THREE.Mesh(new this.THREE.BoxGeometry(thickness, state.room.height, state.room.length), material);
      right.position.set(state.room.width / 2, state.room.height / 2, 0);
      this.root.add(back, left, right);
    }

    addGuides(state) {
      const visible = state.tags.find((tag) => tag.id === "tag-guides")?.visible !== false;
      if (!visible) return;
      state.guides.forEach((guide) => {
        if (guide.type === "measure" && guide.start && guide.end) {
          const geometry = new this.THREE.BufferGeometry().setFromPoints([
            new this.THREE.Vector3(guide.start.x, 2.2, guide.start.z),
            new this.THREE.Vector3(guide.end.x, 2.2, guide.end.z)
          ]);
          this.root.add(new this.THREE.Line(geometry, new this.THREE.LineDashedMaterial({
            color: 0xffcf5a,
            dashSize: 6,
            gapSize: 4
          })));
          return;
        }
        const value = guide.value || 0;
        const points = guide.axis === "x"
          ? [
            new this.THREE.Vector3(value, 2, -state.room.length / 2),
            new this.THREE.Vector3(value, 2, state.room.length / 2)
          ]
          : [
            new this.THREE.Vector3(-state.room.width / 2, 2, value),
            new this.THREE.Vector3(state.room.width / 2, 2, value)
          ];
        const geometry = new this.THREE.BufferGeometry().setFromPoints(points);
        const line = new this.THREE.Line(geometry, new this.THREE.LineBasicMaterial({ color: 0x4eb3ff }));
        this.root.add(line);
      });
    }

    addObjectMesh(object, state) {
      const tag = state.tags.find((item) => item.id === object.tagId);
      if (object.visible === false || tag?.visible === false) return;
      const selected = object.id === this.selectedId;
      const locked = Boolean(object.locked);
      const material = new this.THREE.MeshStandardMaterial({
        color: new this.THREE.Color(object.color),
        roughness: 0.62,
        metalness: 0.04,
        transparent: object.transparent || locked,
        opacity: object.transparent ? 0.55 : locked ? 0.72 : 1
      });
      if (selected) {
        material.emissive = new this.THREE.Color(0x0f7d5f);
        material.emissiveIntensity = 0.08;
      }
      const mesh = new this.THREE.Mesh(new this.THREE.BoxGeometry(object.width, object.height, object.depth), material);
      mesh.position.set(object.x, object.height / 2, object.z);
      mesh.rotation.y = this.THREE.MathUtils.degToRad(object.rotation);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.id = object.id;
      this.root.add(mesh);
      this.meshById.set(object.id, mesh);

      const edgeColor = selected ? 0x45c295 : locked ? 0xffcf5a : 0x25332e;
      const edges = this.createEdges(mesh, edgeColor);
      this.root.add(edges);
      this.nodeById.set(object.id, { mesh, edges });
    }

    createEdges(mesh, color) {
      const edges = new this.THREE.LineSegments(
        new this.THREE.EdgesGeometry(mesh.geometry),
        new this.THREE.LineBasicMaterial({ color })
      );
      edges.position.copy(mesh.position);
      edges.rotation.copy(mesh.rotation);
      return edges;
    }

    updateObjectNode(object) {
      const node = this.nodeById.get(object.id);
      if (!node) return;
      node.mesh.geometry.dispose();
      node.mesh.geometry = new this.THREE.BoxGeometry(object.width, object.height, object.depth);
      node.mesh.position.set(object.x, object.height / 2, object.z);
      node.mesh.rotation.y = this.THREE.MathUtils.degToRad(object.rotation);
      node.edges.geometry.dispose();
      node.edges.geometry = new this.THREE.EdgesGeometry(node.mesh.geometry);
      node.edges.position.copy(node.mesh.position);
      node.edges.rotation.copy(node.mesh.rotation);
    }

    applySection(state) {
      const planes = [];
      if (state.room.sectionEnabled) {
        const direction = state.room.sectionInvert ? -1 : 1;
        const normal = state.room.sectionAxis === "z"
          ? new this.THREE.Vector3(0, 0, direction)
          : new this.THREE.Vector3(direction, 0, 0);
        planes.push(new this.THREE.Plane(normal, -state.room.sectionOffset * direction));
      }
      this.renderer.clippingPlanes = planes;
    }

    hitTestObject(event) {
      this.setPointer(event.clientX, event.clientY);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hits = this.raycaster.intersectObjects([...this.meshById.values()], false);
      const hit = hits[0];
      return hit ? hit.object.userData.id : null;
    }

    intersectFloor(event, target) {
      return this.intersectFloorAt(event.clientX, event.clientY, target);
    }

    intersectFloorAt(clientX, clientY, target) {
      this.setPointer(clientX, clientY);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.floorPlane, target || this.floorHit);
      return Boolean(hit);
    }

    setPointer(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    setCameraMode(mode, state) {
      this.viewMode = mode;
      this.fitView(state);
    }

    fitView(state) {
      const maxSize = Math.max(state.room.width, state.room.length, state.room.height);
      this.updateCameraClip(state);
      this.controls.target.set(0, this.viewMode === "top" ? 0 : Math.min(70, state.room.height * 0.22), 0);

      if (this.viewMode === "top") {
        this.camera.position.set(0, Math.max(maxSize * 1.7, 620), 0.01);
      } else {
        const radius = Math.max(maxSize * 2.15, 780);
        this.camera.position.set(radius * 0.62, radius * 0.7, radius * 0.88);
      }

      this.camera.lookAt(this.controls.target);
      this.controls.update();
    }

    updateCameraClip(state) {
      this.camera.near = 1;
      this.camera.far = Math.max(5000, this.getMaxCameraDistance(state) * 2);
      this.camera.updateProjectionMatrix();
    }

    getMinCameraDistance(state) {
      return Math.max(35, Math.min(state.room.width, state.room.length) * 0.18);
    }

    getMaxCameraDistance(state) {
      const diagonal = Math.hypot(state.room.width, state.room.length, state.room.height);
      return Math.max(2200, diagonal * 5.5);
    }

    zoomAtPoint(clientX, clientY, factor, state) {
      const anchor = new this.THREE.Vector3();
      if (!this.intersectFloorAt(clientX, clientY, anchor)) anchor.copy(this.controls.target);
      const currentDistance = this.camera.position.distanceTo(this.controls.target);
      const nextDistance = clampNumber(
        currentDistance * factor,
        this.getMinCameraDistance(state),
        this.getMaxCameraDistance(state),
        currentDistance
      );
      const actualFactor = nextDistance / currentDistance;
      const offset = this.camera.position.clone().sub(this.controls.target).multiplyScalar(actualFactor);
      this.camera.position.copy(this.controls.target).add(offset);
      this.camera.updateMatrixWorld();
      const hit = new this.THREE.Vector3();
      if (this.intersectFloorAt(clientX, clientY, hit)) {
        const delta = anchor.clone().sub(hit);
        this.camera.position.add(delta);
        this.controls.target.add(delta);
        this.camera.updateMatrixWorld();
      }
    }

    applySphericalCamera(spherical, state) {
      spherical.radius = clampNumber(
        spherical.radius,
        this.getMinCameraDistance(state),
        this.getMaxCameraDistance(state),
        spherical.radius
      );
      const offset = new this.THREE.Vector3().setFromSpherical(spherical);
      this.camera.position.copy(this.controls.target).add(offset);
      this.camera.lookAt(this.controls.target);
      this.camera.updateMatrixWorld();
    }

    resize() {
      const rect = this.viewport.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }

    animate() {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }

    clearGroup(group) {
      while (group.children.length) {
        const child = group.children.pop();
        child.traverse?.((node) => {
          node.geometry?.dispose?.();
          if (Array.isArray(node.material)) {
            node.material.forEach((material) => material.dispose?.());
          } else {
            node.material?.dispose?.();
          }
        });
      }
    }
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + width, y, x + width, y + height, radius);
    ctx.arcTo(x + width, y + height, x, y + height, radius);
    ctx.arcTo(x, y + height, x, y, radius);
    ctx.arcTo(x, y, x + width, y, radius);
    ctx.closePath();
  }

  window.Plano3D.SceneRenderer = SceneRenderer;
}());
