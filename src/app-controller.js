(function () {
  window.Plano3D = window.Plano3D || {};

  const { presets, THEME_KEY } = window.Plano3D.config;
  const { CommandStack } = window.Plano3D.commands;
  const {
    clampObjectToRoom,
    findOpenSlot,
    getObjectVolume,
    getRoomArea,
    objectFootprint,
    objectFootprintSize
  } = window.Plano3D.geometry;
  const { createObject, sanitizeState } = window.Plano3D.state;
  const { exportJson, exportObj, exportStl } = window.Plano3D.exporters;
  const { clampNumber, deepClone, makeId, normalizeRotation } = window.Plano3D.utils;

  class AppController {
    constructor() {
      this.dom = window.Plano3D.dom.getDom();
      this.state = window.Plano3D.storage.loadState();
      this.selectedId = this.state.objects[0]?.id || null;
      this.dirty = false;
      this.isSpaceDown = false;
      this.renderer = new window.Plano3D.SceneRenderer(this.dom.sceneCanvas, this.dom.viewport);
      this.commandStack = new CommandStack(
        () => this.state,
        (nextState) => this.replaceState(nextState),
        (label) => this.updateStatus(label || "Cambio aplicado")
      );
      this.tools = new window.Plano3D.ToolController(this, this.renderer, this.dom);
    }

    init() {
      this.initTheme();
      this.bindUi();
      this.syncControls();
      this.setCameraMode("3d");
      this.renderAll();
      this.resize();
      this.animate();
    }

    bindUi() {
      window.addEventListener("resize", () => this.resize());
      this.dom.presetGrid.addEventListener("click", (event) => {
        const button = event.target.closest("[data-preset]");
        if (button) this.addPreset(button.dataset.preset);
      });
      this.dom.customForm.addEventListener("submit", (event) => {
        event.preventDefault();
        this.addCustomObject();
      });
      [this.dom.roomWidth, this.dom.roomLength, this.dom.roomHeight].forEach((input) => {
        input.addEventListener("change", () => this.updateRoomFromControls());
      });
      this.dom.showWalls.addEventListener("change", () => this.updateRoomFromControls());
      this.dom.showGrid.addEventListener("change", () => this.updateRoomFromControls());

      Object.entries(this.dom.inspectorInputs).forEach(([, input]) => {
        input.addEventListener("input", () => this.updateSelectedFromInspector());
        input.addEventListener("change", () => this.updateSelectedFromInspector());
      });

      this.dom.toolset.addEventListener("click", (event) => {
        const button = event.target.closest("[data-tool]");
        if (button) this.tools.setTool(button.dataset.tool);
      });
      this.dom.measurementInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") this.applyMeasurement(event.target.value);
      });
      [this.dom.snapSize, this.dom.drawHeight, this.dom.offsetDistance, this.dom.arrayCount].forEach((input) => {
        input.addEventListener("change", () => this.updateSettingsFromControls());
      });

      this.dom.deleteBtn.addEventListener("click", () => this.deleteSelected());
      this.dom.duplicateBtn.addEventListener("click", () => this.duplicateSelected());
      this.dom.undoBtn.addEventListener("click", () => this.undo());
      this.dom.redoBtn.addEventListener("click", () => this.redo());
      this.dom.groupBtn.addEventListener("click", () => this.groupSelected());
      this.dom.componentBtn.addEventListener("click", () => this.makeComponentSelected());
      this.dom.arrayBtn.addEventListener("click", () => this.arraySelected());
      this.dom.flipBtn.addEventListener("click", () => this.flipSelected());
      this.dom.clearGuidesBtn.addEventListener("click", () => this.clearGuides());

      this.dom.saveBtn.addEventListener("click", () => this.saveNow());
      this.dom.exportJsonBtn.addEventListener("click", () => exportJson(this.state));
      this.dom.exportObjBtn.addEventListener("click", () => exportObj(this.state));
      this.dom.exportStlBtn.addEventListener("click", () => exportStl(this.state));
      this.dom.importBtn.addEventListener("click", () => this.dom.importFile.click());
      this.dom.importFile.addEventListener("change", (event) => this.importJson(event));
      this.dom.clearBtn.addEventListener("click", () => this.clearPlan());
      this.dom.view3dBtn.addEventListener("click", () => this.setCameraMode("3d"));
      this.dom.viewTopBtn.addEventListener("click", () => this.setCameraMode("top"));
      this.dom.themeBtn.addEventListener("click", () => this.toggleTheme());
      this.dom.fitBtn.addEventListener("click", () => this.fitView());
      this.dom.addSceneBtn.addEventListener("click", () => this.addScene());

      [this.dom.sectionEnabled, this.dom.sectionAxis, this.dom.sectionOffset, this.dom.sectionInvert].forEach((input) => {
        input.addEventListener("change", () => this.updateSectionFromControls());
        input.addEventListener("input", () => this.updateSectionFromControls());
      });
    }

    addPreset(key) {
      const template = presets[key];
      if (!template) return;
      this.addObjectFromTemplate(template);
    }

    addCustomObject() {
      this.addObjectFromTemplate({
        name: this.dom.customName.value || "Objeto nuevo",
        width: Number(this.dom.customWidth.value),
        depth: Number(this.dom.customDepth.value),
        height: Number(this.dom.customHeight.value),
        color: this.dom.customColor.value,
        materialId: null,
        tagId: this.state.settings.activeTagId
      });
    }

    addObjectFromTemplate(template) {
      this.mutate("Anadir objeto", () => {
        const object = createObject({
          ...template,
          tagId: template.tagId || this.state.settings.activeTagId,
          materialId: template.materialId || this.state.settings.activeMaterialId
        });
        const material = this.state.materials.find((item) => item.id === object.materialId);
        if (material) {
          object.color = material.color;
          object.transparent = material.transparent;
        }
        const slot = findOpenSlot(object, this.state);
        object.x = slot.x;
        object.z = slot.z;
        clampObjectToRoom(object, this.state.room);
        this.state.objects.push(object);
        this.selectedId = object.id;
      });
    }

    addDrawnBox(bounds) {
      this.mutate("Dibujar rectangulo", () => {
        const material = this.activeMaterial();
        const object = createObject({
          name: "Volumen",
          width: bounds.width,
          depth: bounds.depth,
          height: this.state.settings.drawHeight,
          x: bounds.x,
          z: bounds.z,
          color: material.color,
          transparent: material.transparent,
          materialId: material.id,
          tagId: this.state.settings.activeTagId
        });
        clampObjectToRoom(object, this.state.room);
        this.state.objects.push(object);
        this.selectedId = object.id;
      });
    }

    updateRoomFromControls() {
      this.mutate("Editar espacio", () => {
        this.state.room.width = clampNumber(this.dom.roomWidth.value, 50, 1000, 220);
        this.state.room.length = clampNumber(this.dom.roomLength.value, 50, 1000, 360);
        this.state.room.height = clampNumber(this.dom.roomHeight.value, 100, 600, 240);
        this.state.room.showWalls = this.dom.showWalls.checked;
        this.state.room.showGrid = this.dom.showGrid.checked;
        this.state.objects.forEach((object) => clampObjectToRoom(object, this.state.room));
      });
      this.syncControls();
      this.renderer.updateCameraClip(this.state);
    }

    updateSettingsFromControls() {
      this.state.settings.snapSize = clampNumber(this.dom.snapSize.value, 1, 100, 10);
      this.state.settings.drawHeight = clampNumber(this.dom.drawHeight.value, 1, 600, 45);
      this.state.settings.offsetDistance = clampNumber(this.dom.offsetDistance.value, 1, 200, 10);
      this.state.settings.arrayCount = clampNumber(this.dom.arrayCount.value, 2, 20, 3);
      this.markDirty();
      this.renderAll();
    }

    updateSectionFromControls() {
      this.state.room.sectionEnabled = this.dom.sectionEnabled.checked;
      this.state.room.sectionAxis = this.dom.sectionAxis.value === "z" ? "z" : "x";
      this.state.room.sectionOffset = clampNumber(this.dom.sectionOffset.value, -1000, 1000, 0);
      this.state.room.sectionInvert = this.dom.sectionInvert.checked;
      this.markDirty();
      this.renderAll();
    }

    updateSelectedFromInspector() {
      const object = this.getSelected();
      if (!object) return;
      object.name = this.dom.inspectorInputs.name.value || "Objeto";
      object.width = clampNumber(this.dom.inspectorInputs.width.value, 1, 1000, object.width);
      object.depth = clampNumber(this.dom.inspectorInputs.depth.value, 1, 1000, object.depth);
      object.height = clampNumber(this.dom.inspectorInputs.height.value, 1, 600, object.height);
      object.rotation = normalizeRotation(Number(this.dom.inspectorInputs.rotation.value) || 0);
      object.color = this.dom.inspectorInputs.color.value;
      object.tagId = this.dom.inspectorInputs.tagId.value;
      object.materialId = this.dom.inspectorInputs.materialId.value || null;
      object.locked = this.dom.inspectorInputs.locked.checked;
      object.visible = this.dom.inspectorInputs.visible.checked;

      const material = this.state.materials.find((item) => item.id === object.materialId);
      if (material) {
        object.color = material.color;
        object.transparent = material.transparent;
      }

      const footprint = objectFootprintSize(object);
      const left = clampNumber(this.dom.inspectorInputs.left.value, 0, Math.max(0, this.state.room.width - footprint.width), 0);
      const front = clampNumber(this.dom.inspectorInputs.front.value, 0, Math.max(0, this.state.room.length - footprint.depth), 0);
      object.x = -this.state.room.width / 2 + left + footprint.width / 2;
      object.z = -this.state.room.length / 2 + front + footprint.depth / 2;

      clampObjectToRoom(object, this.state.room);
      this.markDirty();
      this.renderAll();
    }

    duplicateSelected() {
      const object = this.getSelected();
      if (!object) return;
      this.mutate("Duplicar", () => {
        const copy = createObject({
          ...object,
          id: makeId("obj"),
          name: `${object.name} copia`,
          x: object.x + 20,
          z: object.z + 20
        });
        clampObjectToRoom(copy, this.state.room);
        this.state.objects.push(copy);
        this.selectedId = copy.id;
      });
    }

    deleteSelected() {
      if (!this.selectedId) return;
      this.mutate("Eliminar", () => {
        this.state.objects = this.state.objects.filter((object) => object.id !== this.selectedId);
        this.selectedId = this.state.objects[0]?.id || null;
      });
    }

    clearPlan() {
      if (!window.confirm("Eliminar todos los objetos y guias del plano?")) return;
      this.mutate("Limpiar plano", () => {
        this.state.objects = [];
        this.state.guides = [];
        this.selectedId = null;
      });
      this.renderer.clearPreview();
      this.setMeasurement("");
    }

    offsetSelected() {
      const object = this.getSelected();
      if (!object || object.locked) return;
      this.mutate("Offset", () => {
        const offset = this.state.settings.offsetDistance;
        const copy = createObject({
          ...object,
          id: makeId("obj"),
          name: `${object.name} offset`,
          width: object.width + offset * 2,
          depth: object.depth + offset * 2,
          height: Math.max(2, Math.min(object.height, 6)),
          transparent: true
        });
        clampObjectToRoom(copy, this.state.room);
        this.state.objects.push(copy);
        this.selectedId = copy.id;
      });
    }

    groupSelected() {
      const object = this.getSelected();
      if (!object) return;
      this.mutate("Agrupar", () => {
        const group = { id: makeId("grp"), name: `Grupo ${this.state.groups.length + 1}` };
        this.state.groups.push(group);
        object.groupId = group.id;
      });
    }

    makeComponentSelected() {
      const object = this.getSelected();
      if (!object) return;
      this.mutate("Crear componente", () => {
        const component = { id: makeId("cmp"), name: `${object.name} componente` };
        this.state.components.push(component);
        object.componentId = component.id;
      });
    }

    arraySelected() {
      const object = this.getSelected();
      if (!object) return;
      this.mutate("Matriz", () => {
        const count = this.state.settings.arrayCount;
        const gap = Math.max(10, this.state.settings.snapSize);
        for (let index = 1; index < count; index += 1) {
          const copy = createObject({
            ...object,
            id: makeId("obj"),
            name: `${object.name} ${index + 1}`,
            x: object.x + index * (object.width + gap),
            z: object.z,
            componentId: object.componentId
          });
          clampObjectToRoom(copy, this.state.room);
          this.state.objects.push(copy);
          this.selectedId = copy.id;
        }
      });
    }

    flipSelected() {
      const object = this.getSelected();
      if (!object) return;
      this.mutate("Voltear", () => {
        object.rotation = normalizeRotation(object.rotation + 180);
      });
    }

    addGuideFromPoint(point, axis) {
      this.mutate("Crear guia", () => {
        this.state.guides.push({
          id: makeId("guide"),
          type: "line",
          axis: axis === "z" ? "z" : "x",
          value: axis === "z" ? point.z : point.x,
          label: "Guia"
        });
      });
    }

    addMeasureGuide(start, end) {
      this.mutate("Cinta metrica", () => {
        const distance = Math.hypot(end.x - start.x, end.z - start.z);
        this.state.guides.push({
          id: makeId("guide"),
          type: "measure",
          axis: "x",
          value: 0,
          start,
          end,
          label: `${Math.round(distance)} cm`
        });
      });
    }

    clearGuides() {
      this.mutate("Limpiar guias", () => {
        this.state.guides = [];
      });
      this.renderer.clearPreview();
      this.setMeasurement("");
    }

    addScene() {
      this.mutate("Crear escena", () => {
        this.state.scenes.push({
          id: makeId("scene"),
          name: `Escena ${this.state.scenes.length + 1}`,
          snapshot: {
            camera: {
              position: this.renderer.camera.position.toArray(),
              target: this.renderer.controls.target.toArray(),
              viewMode: this.renderer.viewMode
            },
            room: {
              showGrid: this.state.room.showGrid,
              showWalls: this.state.room.showWalls,
              sectionEnabled: this.state.room.sectionEnabled,
              sectionAxis: this.state.room.sectionAxis,
              sectionOffset: this.state.room.sectionOffset,
              sectionInvert: this.state.room.sectionInvert
            },
            tags: Object.fromEntries(this.state.tags.map((tag) => [tag.id, tag.visible]))
          }
        });
      });
    }

    restoreScene(sceneId) {
      const scene = this.state.scenes.find((item) => item.id === sceneId);
      if (!scene) return;
      const snapshot = scene.snapshot || {};
      if (snapshot.room) {
        Object.assign(this.state.room, snapshot.room);
      }
      if (snapshot.tags) {
        this.state.tags.forEach((tag) => {
          if (Object.prototype.hasOwnProperty.call(snapshot.tags, tag.id)) tag.visible = snapshot.tags[tag.id];
        });
      }
      if (snapshot.camera?.position && snapshot.camera?.target) {
        this.renderer.viewMode = snapshot.camera.viewMode || "3d";
        this.renderer.camera.position.fromArray(snapshot.camera.position);
        this.renderer.controls.target.fromArray(snapshot.camera.target);
        this.renderer.camera.lookAt(this.renderer.controls.target);
        this.renderer.controls.update();
      }
      this.syncControls();
      this.renderAll();
      this.updateStatus(`Escena: ${scene.name}`);
    }

    applyMeasurement(value) {
      const object = this.getSelected();
      if (!object) return;
      const parts = String(value).toLowerCase().split(/[x, ]+/).map(Number).filter(Number.isFinite);
      this.mutate("Caja de medidas", () => {
        if (this.tools.activeTool === "pushpull" && parts[0]) object.height = parts[0];
        else if (this.tools.activeTool === "rotate" && parts[0]) object.rotation = normalizeRotation(parts[0]);
        else if (this.tools.activeTool === "scale" && parts[0]) {
          object.width *= parts[0] / 100;
          object.depth *= parts[0] / 100;
        } else if (parts.length >= 3) {
          object.width = parts[0];
          object.depth = parts[1];
          object.height = parts[2];
        } else if (parts.length >= 2) {
          object.width = parts[0];
          object.depth = parts[1];
        }
        clampObjectToRoom(object, this.state.room);
      });
      this.setMeasurement("");
    }

    updateObjectList() {
      this.dom.objectList.innerHTML = "";
      if (!this.state.objects.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No hay objetos en el plano.";
        this.dom.objectList.appendChild(empty);
        return;
      }
      this.state.objects.forEach((object) => {
        const tag = this.state.tags.find((item) => item.id === object.tagId);
        const button = document.createElement("button");
        button.type = "button";
        button.className = `object-row${object.id === this.selectedId ? " active" : ""}`;
        button.innerHTML = `
          <span class="color-dot" style="background:${object.color}"></span>
          <span>
            <strong></strong>
            <span>${Math.round(object.width)} x ${Math.round(object.depth)} x ${Math.round(object.height)} cm - ${tag?.name || "Sin tag"}</span>
          </span>
        `;
        button.querySelector("strong").textContent = `${object.visible === false ? "[oculto] " : ""}${object.name}`;
        button.addEventListener("click", () => this.selectObject(object.id));
        this.dom.objectList.appendChild(button);
      });
    }

    updateInspector() {
      const object = this.getSelected();
      this.dom.deleteBtn.disabled = !object;
      this.dom.duplicateBtn.disabled = !object;
      this.dom.groupBtn.disabled = !object;
      this.dom.componentBtn.disabled = !object;
      this.dom.arrayBtn.disabled = !object;
      this.dom.flipBtn.disabled = !object;
      this.dom.emptyInspector.classList.toggle("hidden", Boolean(object));
      this.dom.inspectorForm.classList.toggle("hidden", !object);
      this.populateSelects();
      if (!object) return;
      const footprint = objectFootprint(object);
      const left = Math.round(footprint.minX + this.state.room.width / 2);
      const front = Math.round(footprint.minZ + this.state.room.length / 2);
      this.dom.inspectorInputs.name.value = object.name;
      this.dom.inspectorInputs.width.value = Math.round(object.width);
      this.dom.inspectorInputs.depth.value = Math.round(object.depth);
      this.dom.inspectorInputs.height.value = Math.round(object.height);
      this.dom.inspectorInputs.left.value = left;
      this.dom.inspectorInputs.front.value = front;
      this.dom.inspectorInputs.rotation.value = Math.round(object.rotation);
      this.dom.inspectorInputs.color.value = object.color;
      this.dom.inspectorInputs.tagId.value = object.tagId;
      this.dom.inspectorInputs.materialId.value = object.materialId || "";
      this.dom.inspectorInputs.locked.checked = object.locked;
      this.dom.inspectorInputs.visible.checked = object.visible !== false;
    }

    updateTags() {
      this.dom.tagList.innerHTML = "";
      this.state.tags.forEach((tag) => {
        const label = document.createElement("label");
        label.className = "check-row tag-row";
        label.innerHTML = `<input type="checkbox" ${tag.visible ? "checked" : ""} /> <span></span>`;
        label.querySelector("span").textContent = tag.name;
        label.querySelector("input").addEventListener("change", (event) => {
          tag.visible = event.target.checked;
          this.markDirty();
          this.renderAll();
        });
        this.dom.tagList.appendChild(label);
      });
    }

    updateMaterials() {
      this.dom.materialList.innerHTML = "";
      this.state.materials.forEach((material) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `swatch${material.id === this.state.settings.activeMaterialId ? " active" : ""}`;
        button.title = material.name;
        button.style.background = material.color;
        button.addEventListener("click", () => {
          this.state.settings.activeMaterialId = material.id;
          const object = this.getSelected();
          if (object) {
            object.materialId = material.id;
            object.color = material.color;
            object.transparent = material.transparent;
          }
          this.markDirty();
          this.renderAll();
        });
        this.dom.materialList.appendChild(button);
      });
    }

    updateScenes() {
      this.dom.sceneList.innerHTML = "";
      if (!this.state.scenes.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state compact";
        empty.textContent = "Sin escenas.";
        this.dom.sceneList.appendChild(empty);
        return;
      }
      this.state.scenes.forEach((scene) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "scene-row";
        button.textContent = scene.name;
        button.addEventListener("click", () => this.restoreScene(scene.id));
        this.dom.sceneList.appendChild(button);
      });
    }

    updateGuides() {
      this.dom.guideList.innerHTML = "";
      if (!this.state.guides.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state compact";
        empty.textContent = "Sin guias.";
        this.dom.guideList.appendChild(empty);
        return;
      }
      this.state.guides.forEach((guide) => {
        const row = document.createElement("div");
        row.className = "guide-row";
        row.textContent = guide.label || `${guide.axis.toUpperCase()} ${Math.round(guide.value)}`;
        this.dom.guideList.appendChild(row);
      });
    }

    populateSelects() {
      const tagSelect = this.dom.inspectorInputs.tagId;
      const materialSelect = this.dom.inspectorInputs.materialId;
      tagSelect.innerHTML = this.state.tags.map((tag) => `<option value="${tag.id}">${tag.name}</option>`).join("");
      materialSelect.innerHTML = `<option value="">Color manual</option>` +
        this.state.materials.map((material) => `<option value="${material.id}">${material.name}</option>`).join("");
    }

    syncControls() {
      this.dom.roomWidth.value = this.state.room.width;
      this.dom.roomLength.value = this.state.room.length;
      this.dom.roomHeight.value = this.state.room.height;
      this.dom.showWalls.checked = this.state.room.showWalls;
      this.dom.showGrid.checked = this.state.room.showGrid;
      this.dom.snapSize.value = this.state.settings.snapSize;
      this.dom.drawHeight.value = this.state.settings.drawHeight;
      this.dom.offsetDistance.value = this.state.settings.offsetDistance;
      this.dom.arrayCount.value = this.state.settings.arrayCount;
      this.dom.sectionEnabled.checked = this.state.room.sectionEnabled;
      this.dom.sectionAxis.value = this.state.room.sectionAxis;
      this.dom.sectionOffset.value = this.state.room.sectionOffset;
      this.dom.sectionInvert.checked = this.state.room.sectionInvert;
    }

    updateUi() {
      this.dom.roomBadge.textContent = `${this.state.room.width} x ${this.state.room.length} cm`;
      this.dom.objectBadge.textContent = `${this.state.objects.length} ${this.state.objects.length === 1 ? "objeto" : "objetos"}`;
      const usedArea = this.state.objects.reduce((sum, object) => sum + object.width * object.depth, 0);
      this.dom.areaMetric.textContent = `${Math.round((usedArea / getRoomArea(this.state.room)) * 100)}%`;
      this.updateObjectList();
      this.updateInspector();
      this.updateTags();
      this.updateMaterials();
      this.updateScenes();
      this.updateGuides();
    }

    setCameraMode(mode) {
      this.renderer.setCameraMode(mode, this.state);
      this.dom.view3dBtn.classList.toggle("active", mode === "3d");
      this.dom.viewTopBtn.classList.toggle("active", mode === "top");
      this.updateStatus(mode === "top" ? "Vista superior" : "Vista 3D");
    }

    fitView() {
      this.renderer.fitView(this.state);
      this.updateStatus("Plano completo");
    }

    initTheme() {
      this.applyTheme(localStorage.getItem(THEME_KEY) || "dark");
    }

    toggleTheme() {
      this.applyTheme(document.body.dataset.theme === "dark" ? "light" : "dark");
      localStorage.setItem(THEME_KEY, document.body.dataset.theme);
      this.renderAll();
    }

    applyTheme(theme) {
      const nextTheme = theme === "dark" ? "dark" : "light";
      document.body.dataset.theme = nextTheme;
      this.dom.themeIcon.textContent = nextTheme === "dark" ? "☀" : "☾";
      this.dom.themeBtn.title = nextTheme === "dark" ? "Modo claro" : "Modo oscuro";
      this.dom.themeBtn.setAttribute("aria-label", nextTheme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
      this.renderer.setTheme(nextTheme);
    }

    saveNow() {
      window.Plano3D.storage.saveState(this.state);
      this.dirty = false;
      this.dom.saveStatus.textContent = "Guardado";
    }

    importJson(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          this.replaceState(sanitizeState(JSON.parse(reader.result)));
          this.commandStack.clear();
          this.markDirty();
        } catch (error) {
          window.alert("El archivo no parece ser un plano valido.");
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    }

    mutate(label, mutate) {
      this.commandStack.commit(label, mutate);
      this.afterModelChange();
    }

    afterModelChange() {
      this.markDirty();
      this.renderAll();
    }

    markDirty() {
      this.dirty = true;
      this.dom.saveStatus.textContent = "Cambios sin guardar";
    }

    renderAll() {
      this.renderer.renderModel(this.state, this.selectedId);
      this.updateUi();
    }

    replaceState(nextState) {
      this.state = sanitizeState(nextState);
      if (!this.state.objects.some((object) => object.id === this.selectedId)) {
        this.selectedId = this.state.objects[0]?.id || null;
      }
      this.syncControls();
      this.renderAll();
    }

    undo() {
      if (this.commandStack.undo()) this.renderAll();
    }

    redo() {
      if (this.commandStack.redo()) this.renderAll();
    }

    selectObject(id) {
      this.selectedId = id;
      this.renderAll();
    }

    getSelected() {
      return this.getObject(this.selectedId);
    }

    getObject(id) {
      return this.state.objects.find((object) => object.id === id) || null;
    }

    clampObject(object) {
      return clampObjectToRoom(object, this.state.room);
    }

    activeMaterial() {
      return this.state.materials.find((material) => material.id === this.state.settings.activeMaterialId) ||
        this.state.materials[0] ||
        { id: null, color: "#45c295", transparent: false };
    }

    syncInspectorPosition(object) {
      if (!object || object.id !== this.selectedId) return;
      const footprint = objectFootprint(object);
      this.dom.inspectorInputs.left.value = Math.round(footprint.minX + this.state.room.width / 2);
      this.dom.inspectorInputs.front.value = Math.round(footprint.minZ + this.state.room.length / 2);
    }

    syncInspectorRotation(object) {
      if (!object || object.id !== this.selectedId) return;
      this.dom.inspectorInputs.rotation.value = Math.round(object.rotation);
    }

    syncInspectorDimensions(object) {
      if (!object || object.id !== this.selectedId) return;
      this.dom.inspectorInputs.width.value = Math.round(object.width);
      this.dom.inspectorInputs.depth.value = Math.round(object.depth);
      this.dom.inspectorInputs.height.value = Math.round(object.height);
      this.syncInspectorPosition(object);
    }

    setMeasurement(value) {
      this.dom.measurementInput.value = value || "";
    }

    updateStatus(text) {
      this.dom.navModeBadge.textContent = text || "Vista editable";
    }

    resize() {
      this.renderer.resize();
    }

    animate() {
      requestAnimationFrame(() => this.animate());
      this.renderer.animate();
    }
  }

  window.Plano3D.AppController = AppController;
}());
