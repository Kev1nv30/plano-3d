(function () {
  window.Plano3D = window.Plano3D || {};

  const { MATERIALS, TAGS, presets } = window.Plano3D.config;
  const { clampNumber, makeId, normalizeRotation } = window.Plano3D.utils;
  const { clampObjectToRoom } = window.Plano3D.geometry;

  function createDefaultState() {
    const state = {
      room: {
        width: 220,
        length: 360,
        height: 240,
        showWalls: true,
        showGrid: true,
        sectionEnabled: false,
        sectionAxis: "x",
        sectionOffset: 0,
        sectionInvert: false
      },
      settings: {
        snapSize: 10,
        drawHeight: 45,
        offsetDistance: 10,
        arrayCount: 3,
        activeMaterialId: "mat-green",
        activeTagId: "tag-equipment"
      },
      objects: [
        createObject({ ...presets.rack, x: -35, z: -105, rotation: 0 }),
        createObject({ ...presets.bench, x: -30, z: -25, rotation: 0 }),
        createObject({ ...presets.dumbbells, x: 45, z: 115, rotation: 90 })
      ],
      tags: TAGS.map((tag) => ({ ...tag })),
      materials: MATERIALS.map((material) => ({ ...material })),
      guides: [],
      scenes: [],
      groups: [],
      components: []
    };

    state.objects = state.objects.map((object) => clampObjectToRoom(object, state.room));
    return state;
  }

  function createObject(input) {
    return {
      id: input.id || makeId("obj"),
      type: input.type || "box",
      name: String(input.name || "Objeto").slice(0, 32),
      width: clampNumber(input.width, 1, 1000, 60),
      depth: clampNumber(input.depth, 1, 1000, 60),
      height: clampNumber(input.height, 1, 600, 45),
      x: clampNumber(input.x, -1000, 1000, 0),
      z: clampNumber(input.z, -1000, 1000, 0),
      rotation: normalizeRotation(input.rotation),
      color: /^#[0-9a-f]{6}$/i.test(input.color) ? input.color : "#2f7d63",
      transparent: Boolean(input.transparent),
      tagId: input.tagId || "tag-equipment",
      materialId: input.materialId || null,
      groupId: input.groupId || null,
      componentId: input.componentId || null,
      locked: Boolean(input.locked),
      visible: input.visible !== false
    };
  }

  function sanitizeState(input) {
    const fallback = createDefaultState();
    const source = input && typeof input === "object" ? input : fallback;
    const room = {
      width: clampNumber(source.room?.width, 50, 1000, fallback.room.width),
      length: clampNumber(source.room?.length, 50, 1000, fallback.room.length),
      height: clampNumber(source.room?.height, 100, 600, fallback.room.height),
      showWalls: source.room?.showWalls !== false,
      showGrid: source.room?.showGrid !== false,
      sectionEnabled: Boolean(source.room?.sectionEnabled),
      sectionAxis: source.room?.sectionAxis === "z" ? "z" : "x",
      sectionOffset: clampNumber(source.room?.sectionOffset, -1000, 1000, 0),
      sectionInvert: Boolean(source.room?.sectionInvert)
    };

    const materials = mergeById(MATERIALS, source.materials).map((material) => ({
      id: material.id || makeId("mat"),
      name: String(material.name || "Material").slice(0, 32),
      color: /^#[0-9a-f]{6}$/i.test(material.color) ? material.color : "#2f7d63",
      transparent: Boolean(material.transparent)
    }));

    const tags = mergeById(TAGS, source.tags).map((tag) => ({
      id: tag.id || makeId("tag"),
      name: String(tag.name || "Tag").slice(0, 32),
      visible: tag.visible !== false
    }));

    const settings = {
      snapSize: clampNumber(source.settings?.snapSize, 1, 100, 10),
      drawHeight: clampNumber(source.settings?.drawHeight, 1, 600, 45),
      offsetDistance: clampNumber(source.settings?.offsetDistance, 1, 200, 10),
      arrayCount: clampNumber(source.settings?.arrayCount, 2, 20, 3),
      activeMaterialId: source.settings?.activeMaterialId || materials[0]?.id || "mat-green",
      activeTagId: source.settings?.activeTagId || tags[1]?.id || tags[0]?.id || "tag-base"
    };

    const objects = (source.objects || []).map((object) => {
      const clean = createObject(object);
      if (!tags.some((tag) => tag.id === clean.tagId)) clean.tagId = tags[0].id;
      const material = materials.find((item) => item.id === clean.materialId);
      if (material) {
        clean.color = material.color;
        clean.transparent = material.transparent;
      }
      return clampObjectToRoom(clean, room);
    });

    return {
      room,
      settings,
      objects,
      tags,
      materials,
      guides: sanitizeGuides(source.guides || []),
      scenes: sanitizeScenes(source.scenes || []),
      groups: sanitizeNamedCollection(source.groups || [], "Grupo"),
      components: sanitizeNamedCollection(source.components || [], "Componente")
    };
  }

  function mergeById(defaults, source) {
    const result = defaults.map((item) => ({ ...item }));
    (source || []).forEach((item) => {
      const index = result.findIndex((existing) => existing.id === item.id);
      if (index >= 0) {
        result[index] = { ...result[index], ...item };
      } else {
        result.push({ ...item });
      }
    });
    return result;
  }

  function sanitizeGuides(guides) {
    return guides.map((guide) => ({
      id: guide.id || makeId("guide"),
      type: guide.type === "measure" ? "measure" : "line",
      axis: guide.axis === "z" ? "z" : "x",
      value: clampNumber(guide.value, -2000, 2000, 0),
      start: guide.start || null,
      end: guide.end || null,
      label: String(guide.label || "Guia").slice(0, 48)
    }));
  }

  function sanitizeScenes(scenes) {
    return scenes.map((scene, index) => ({
      id: scene.id || makeId("scene"),
      name: String(scene.name || `Escena ${index + 1}`).slice(0, 32),
      snapshot: scene.snapshot || {}
    }));
  }

  function sanitizeNamedCollection(collection, fallbackName) {
    return collection.map((item, index) => ({
      id: item.id || makeId(fallbackName.toLowerCase()),
      name: String(item.name || `${fallbackName} ${index + 1}`).slice(0, 32)
    }));
  }

  window.Plano3D.state = {
    createDefaultState,
    createObject,
    sanitizeState
  };
}());
