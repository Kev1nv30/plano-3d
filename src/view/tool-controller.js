(function () {
  window.Plano3D = window.Plano3D || {};

  const { boundsFromPoints, getNearestInference } = window.Plano3D.geometry;
  const { clampNumber, isTextInput, roundTo } = window.Plano3D.utils;

  const TOOL_HINTS = {
    select: "Selecciona, mueve y edita objetos.",
    rectangle: "Dibuja un rectangulo sobre el piso; se crea una cara/volumen con la altura indicada.",
    pushpull: "Arrastra sobre un objeto para empujar/tirar su altura.",
    move: "Mueve el objeto con snapping; usa X o Z para bloquear eje.",
    rotate: "Arrastra horizontalmente para rotar.",
    scale: "Arrastra horizontalmente para escalar ancho y largo.",
    offset: "Crea un contorno paralelo desde el objeto seleccionado.",
    tape: "Mide entre dos puntos y deja una guia de medicion.",
    guide: "Haz clic para crear una guia vertical u horizontal.",
    orbit: "Orbita con arrastre; rueda para zoom."
  };

  class ToolController {
    constructor(app, renderer, dom) {
      this.app = app;
      this.renderer = renderer;
      this.dom = dom;
      this.THREE = window.THREE;
      this.activeTool = "select";
      this.axisLock = null;
      this.drag = null;
      this.dragStart = new this.THREE.Vector2();
      this.panAnchor = new this.THREE.Vector3();
      this.rotateStart = new this.THREE.Vector2();
      this.rotateStartSpherical = new this.THREE.Spherical();
      this.pointerMoved = false;
      this.bindEvents();
      this.setTool("select");
    }

    bindEvents() {
      const canvas = this.renderer.canvas;
      canvas.addEventListener("contextmenu", (event) => event.preventDefault());
      canvas.addEventListener("wheel", (event) => this.onWheel(event), { passive: false });
      canvas.addEventListener("pointerdown", (event) => this.onPointerDown(event), true);
      window.addEventListener("pointermove", (event) => this.onPointerMove(event), true);
      window.addEventListener("pointerup", (event) => this.onPointerUp(event), true);
      window.addEventListener("pointercancel", (event) => this.onPointerUp(event), true);
      window.addEventListener("keydown", (event) => this.onKeyDown(event));
      window.addEventListener("keyup", (event) => this.onKeyUp(event));
    }

    setTool(tool) {
      this.activeTool = tool || "select";
      this.dom.toolHint.textContent = TOOL_HINTS[this.activeTool] || "";
      this.dom.navModeBadge.textContent = this.activeTool === "select" ? "Vista editable" : this.labelForTool(this.activeTool);
      this.dom.toolset.querySelectorAll("[data-tool]").forEach((button) => {
        button.classList.toggle("active", button.dataset.tool === this.activeTool);
      });
      this.renderer.clearPreview();
    }

    labelForTool(tool) {
      return {
        select: "Seleccion",
        rectangle: "Rectangulo",
        pushpull: "Push/Pull",
        move: "Mover",
        rotate: "Rotar",
        scale: "Escalar",
        offset: "Offset",
        tape: "Cinta metrica",
        guide: "Guia",
        orbit: "Orbitar"
      }[tool] || tool;
    }

    onPointerDown(event) {
      if (event.button === 2 || this.activeTool === "orbit" || (event.button === 0 && event.altKey)) {
        this.stop(event);
        this.startOrbit(event);
        return;
      }

      if (event.button === 1 || (event.button === 0 && event.code === "Space") || (event.button === 0 && this.app.isSpaceDown)) {
        this.stop(event);
        this.startPan(event);
        return;
      }

      if (event.button !== 0) return;

      const objectId = this.renderer.hitTestObject(event);
      const object = objectId ? this.app.getObject(objectId) : null;
      const floor = this.getFloorPoint(event);

      if (this.activeTool === "rectangle") {
        if (!floor) return;
        this.stop(event);
        this.startRectangle(event, floor);
        return;
      }

      if (this.activeTool === "tape") {
        if (!floor) return;
        this.stop(event);
        this.startMeasure(event, floor);
        return;
      }

      if (this.activeTool === "guide") {
        if (!floor) return;
        this.stop(event);
        this.app.addGuideFromPoint(floor, event.shiftKey ? "z" : "x");
        return;
      }

      if (this.activeTool === "offset") {
        this.stop(event);
        if (object) this.app.selectObject(object.id);
        this.app.offsetSelected();
        return;
      }

      if (object) {
        this.stop(event);
        this.app.selectObject(object.id);
        if (object.locked) {
          this.app.updateStatus("Objeto bloqueado");
          return;
        }
        if (this.activeTool === "pushpull") {
          this.startPushPull(event, object);
        } else if (this.activeTool === "rotate") {
          this.startRotateObject(event, object);
        } else if (this.activeTool === "scale") {
          this.startScaleObject(event, object);
        } else {
          this.startMoveObject(event, object, floor);
        }
        return;
      }

      this.app.selectObject(null);
      this.stop(event);
      this.startPan(event);
    }

    onPointerMove(event) {
      if (!this.drag || this.drag.pointerId !== event.pointerId) {
        if (!this.drag) this.updateHoverInference(event);
        return;
      }
      this.stop(event);
      const moved = this.dragStart.distanceTo(new this.THREE.Vector2(event.clientX, event.clientY));
      this.pointerMoved = this.pointerMoved || moved > 2;

      if (this.drag.type === "rectangle") this.updateRectangle(event);
      if (this.drag.type === "measure") this.updateMeasure(event);
      if (this.drag.type === "move") this.updateMoveObject(event);
      if (this.drag.type === "pushpull") this.updatePushPull(event);
      if (this.drag.type === "rotate-object") this.updateRotateObject(event);
      if (this.drag.type === "scale-object") this.updateScaleObject(event);
      if (this.drag.type === "pan") this.updatePan(event);
      if (this.drag.type === "orbit") this.updateOrbit(event);
    }

    onPointerUp(event) {
      if (!this.drag || this.drag.pointerId !== event.pointerId) return;
      this.stop(event);
      if (this.drag.type === "rectangle") this.finishRectangle(event);
      if (this.drag.type === "measure") this.finishMeasure(event);
      if (["move", "pushpull", "rotate-object", "scale-object"].includes(this.drag.type)) {
        this.app.commandStack.closeSnapshot(this.labelForTool(this.activeTool));
        this.app.afterModelChange();
      }
      this.endDrag();
    }

    startRectangle(event, point) {
      this.dragStart.set(event.clientX, event.clientY);
      this.pointerMoved = false;
      this.drag = {
        type: "rectangle",
        pointerId: event.pointerId,
        start: this.snap(point)
      };
      this.app.updateStatus("Dibujando rectangulo");
    }

    updateRectangle(event) {
      const point = this.getFloorPoint(event);
      if (!point) return;
      const end = this.snap(point);
      const bounds = boundsFromPoints(this.drag.start, end, this.app.state.settings.snapSize);
      this.renderer.showBoxPreview(bounds, this.app.state.settings.drawHeight, this.app.activeMaterial().color);
      this.app.setMeasurement(`${Math.round(bounds.width)} x ${Math.round(bounds.depth)}`);
    }

    finishRectangle(event) {
      const point = this.getFloorPoint(event);
      if (!point) return;
      const end = this.snap(point);
      const bounds = boundsFromPoints(this.drag.start, end, this.app.state.settings.snapSize);
      if (bounds.width < 2 || bounds.depth < 2) return;
      this.app.addDrawnBox(bounds);
    }

    startMeasure(event, point) {
      this.dragStart.set(event.clientX, event.clientY);
      this.drag = {
        type: "measure",
        pointerId: event.pointerId,
        start: this.snap(point),
        end: this.snap(point)
      };
      this.app.updateStatus("Midiendo");
    }

    updateMeasure(event) {
      const point = this.getFloorPoint(event);
      if (!point) return;
      this.drag.end = this.snap(point);
      const distance = Math.hypot(this.drag.end.x - this.drag.start.x, this.drag.end.z - this.drag.start.z);
      const label = `${Math.round(distance)} cm`;
      this.renderer.showMeasurePreview(this.drag.start, this.drag.end, label);
      this.app.setMeasurement(label);
    }

    finishMeasure(event) {
      this.updateMeasure(event);
      this.app.addMeasureGuide(this.drag.start, this.drag.end);
    }

    startMoveObject(event, object, floorPoint) {
      this.dragStart.set(event.clientX, event.clientY);
      this.pointerMoved = false;
      this.app.commandStack.snapshot("Mover");
      const floor = floorPoint || { x: object.x, z: object.z };
      this.drag = {
        type: "move",
        pointerId: event.pointerId,
        objectId: object.id,
        startObject: { x: object.x, z: object.z },
        offset: { x: floor.x - object.x, z: floor.z - object.z }
      };
      this.renderer.viewport.classList.add("is-dragging");
      this.app.updateStatus("Moviendo objeto");
    }

    updateMoveObject(event) {
      const point = this.getFloorPoint(event);
      const object = this.app.getObject(this.drag.objectId);
      if (!point || !object) return;
      const snapped = this.snap({
        x: point.x - this.drag.offset.x,
        z: point.z - this.drag.offset.z
      });
      if (this.axisLock === "x") {
        object.x = snapped.x;
        object.z = this.drag.startObject.z;
      } else if (this.axisLock === "z") {
        object.x = this.drag.startObject.x;
        object.z = snapped.z;
      } else {
        object.x = snapped.x;
        object.z = snapped.z;
      }
      this.app.clampObject(object);
      this.renderer.updateObjectNode(object);
      this.app.syncInspectorPosition(object);
      this.app.markDirty();
    }

    startPushPull(event, object) {
      this.dragStart.set(event.clientX, event.clientY);
      this.app.commandStack.snapshot("Push/Pull");
      this.drag = {
        type: "pushpull",
        pointerId: event.pointerId,
        objectId: object.id,
        startHeight: object.height,
        startY: event.clientY
      };
      this.renderer.viewport.classList.add("is-scaling");
      this.app.updateStatus("Push/Pull");
    }

    updatePushPull(event) {
      const object = this.app.getObject(this.drag.objectId);
      if (!object) return;
      const delta = (this.drag.startY - event.clientY) * 0.8;
      object.height = clampNumber(this.drag.startHeight + delta, 1, 600, this.drag.startHeight);
      this.renderer.updateObjectNode(object);
      this.app.syncInspectorDimensions(object);
      this.app.setMeasurement(`${Math.round(object.height)} cm`);
      this.app.markDirty();
    }

    startRotateObject(event, object) {
      this.dragStart.set(event.clientX, event.clientY);
      this.app.commandStack.snapshot("Rotar");
      this.drag = {
        type: "rotate-object",
        pointerId: event.pointerId,
        objectId: object.id,
        startRotation: object.rotation,
        startX: event.clientX
      };
      this.renderer.viewport.classList.add("is-rotating");
      this.app.updateStatus("Rotando objeto");
    }

    updateRotateObject(event) {
      const object = this.app.getObject(this.drag.objectId);
      if (!object) return;
      object.rotation = (this.drag.startRotation + (event.clientX - this.drag.startX) * 0.45 + 360) % 360;
      this.renderer.updateObjectNode(object);
      this.app.syncInspectorRotation(object);
      this.app.setMeasurement(`${Math.round(object.rotation)} deg`);
      this.app.markDirty();
    }

    startScaleObject(event, object) {
      this.dragStart.set(event.clientX, event.clientY);
      this.app.commandStack.snapshot("Escalar");
      this.drag = {
        type: "scale-object",
        pointerId: event.pointerId,
        objectId: object.id,
        startWidth: object.width,
        startDepth: object.depth,
        startX: event.clientX
      };
      this.renderer.viewport.classList.add("is-scaling");
      this.app.updateStatus("Escalando objeto");
    }

    updateScaleObject(event) {
      const object = this.app.getObject(this.drag.objectId);
      if (!object) return;
      const factor = clampNumber(1 + (event.clientX - this.drag.startX) / 220, 0.1, 5, 1);
      object.width = Math.max(1, this.drag.startWidth * factor);
      object.depth = Math.max(1, this.drag.startDepth * factor);
      this.app.clampObject(object);
      this.renderer.updateObjectNode(object);
      this.app.syncInspectorDimensions(object);
      this.app.setMeasurement(`${Math.round(factor * 100)}%`);
      this.app.markDirty();
    }

    startPan(event) {
      this.dragStart.set(event.clientX, event.clientY);
      this.drag = { type: "pan", pointerId: event.pointerId };
      this.renderer.viewport.classList.add("is-panning");
      this.setPanAnchor(event.clientX, event.clientY);
      this.app.updateStatus("Moviendo vista");
    }

    updatePan(event) {
      const target = new this.THREE.Vector3();
      if (!this.renderer.intersectFloorAt(event.clientX, event.clientY, target)) return;
      const delta = this.panAnchor.clone().sub(target);
      this.renderer.camera.position.add(delta);
      this.renderer.controls.target.add(delta);
      this.renderer.camera.updateMatrixWorld();
    }

    startOrbit(event) {
      this.dragStart.set(event.clientX, event.clientY);
      this.rotateStart.set(event.clientX, event.clientY);
      this.rotateStartSpherical.setFromVector3(this.renderer.camera.position.clone().sub(this.renderer.controls.target));
      this.drag = { type: "orbit", pointerId: event.pointerId };
      this.renderer.viewport.classList.add("is-panning");
      this.app.updateStatus("Orbitando");
    }

    updateOrbit(event) {
      if (this.renderer.viewMode !== "3d") return;
      const dx = event.clientX - this.rotateStart.x;
      const dy = event.clientY - this.rotateStart.y;
      const spherical = this.rotateStartSpherical.clone();
      spherical.theta -= dx * 0.006;
      spherical.phi = clampNumber(spherical.phi + dy * 0.0045, 0.22, Math.PI * 0.48, spherical.phi);
      this.renderer.applySphericalCamera(spherical, this.app.state);
    }

    onWheel(event) {
      event.preventDefault();
      const selected = this.app.getSelected();
      const hoveredId = this.renderer.hitTestObject(event);
      if (selected && (event.shiftKey || hoveredId === selected.id)) {
        selected.rotation = (selected.rotation + (event.deltaY > 0 ? 5 : -5) + 360) % 360;
        this.renderer.updateObjectNode(selected);
        this.app.syncInspectorRotation(selected);
        this.app.markDirty();
        return;
      }
      this.renderer.zoomAtPoint(event.clientX, event.clientY, Math.exp(event.deltaY * 0.00125), this.app.state);
    }

    onKeyDown(event) {
      if (isTextInput(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        this.app.isSpaceDown = true;
      }
      if (event.key.toLowerCase() === "x") this.axisLock = "x";
      if (event.key.toLowerCase() === "z") this.axisLock = "z";
      if (event.key === "Escape") this.setTool("select");
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        this.app.undo();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        this.app.redo();
      }
      const shortcut = {
        v: "select",
        r: "rectangle",
        p: "pushpull",
        m: "move",
        q: "rotate",
        s: "scale",
        o: "offset",
        t: "tape",
        g: "guide"
      }[event.key.toLowerCase()];
      if (shortcut && !event.ctrlKey && !event.metaKey) this.setTool(shortcut);
    }

    onKeyUp(event) {
      if (event.code === "Space") this.app.isSpaceDown = false;
      if (["x", "z"].includes(event.key.toLowerCase())) this.axisLock = null;
    }

    updateHoverInference(event) {
      const point = this.getFloorPoint(event);
      if (!point) return;
      const snap = this.snap(point);
      const isGridSnap = snap.label === "Grid";
      this.renderer.showInference(snap, isGridSnap ? "" : snap.label);
      this.dom.inferenceBadge.textContent = isGridSnap ? "Snap" : snap.label || "Snap";
    }

    getFloorPoint(event) {
      const point = new this.THREE.Vector3();
      if (!this.renderer.intersectFloor(event, point)) return null;
      return { x: point.x, z: point.z };
    }

    snap(point) {
      return getNearestInference(point, this.app.state);
    }

    setPanAnchor(clientX, clientY) {
      if (this.renderer.intersectFloorAt(clientX, clientY, this.panAnchor)) return;
      this.panAnchor.copy(this.renderer.controls.target);
    }

    endDrag() {
      this.drag = null;
      this.renderer.viewport.classList.remove("is-dragging", "is-panning", "is-rotating", "is-scaling");
      this.renderer.clearPreview();
      this.dom.navModeBadge.textContent = this.labelForTool(this.activeTool);
    }

    stop(event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }

  window.Plano3D.ToolController = ToolController;
}());
