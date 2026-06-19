(function () {
  window.Plano3D = window.Plano3D || {};

  const { clampNumber, normalizeRotation, roundTo } = window.Plano3D.utils;

  function objectFootprintSize(object) {
    const rotation = normalizeRotation(object.rotation);
    const radians = rotation * Math.PI / 180;
    let cos = Math.abs(Math.cos(radians));
    let sin = Math.abs(Math.sin(radians));
    if (cos < 1e-10) cos = 0;
    if (sin < 1e-10) sin = 0;
    if (Math.abs(cos - 1) < 1e-10) cos = 1;
    if (Math.abs(sin - 1) < 1e-10) sin = 1;
    return {
      width: object.width * cos + object.depth * sin,
      depth: object.width * sin + object.depth * cos
    };
  }

  function clampObjectToRoom(object, room) {
    object.width = Math.max(1, Number(object.width) || 1);
    object.depth = Math.max(1, Number(object.depth) || 1);
    object.height = clampNumber(object.height, 1, Math.max(400, room.height * 2), 45);
    object.rotation = normalizeRotation(object.rotation);

    let footprint = objectFootprintSize(object);
    const fitScale = Math.min(
      1,
      room.width / Math.max(1, footprint.width),
      room.length / Math.max(1, footprint.depth)
    );
    if (fitScale < 1 - 1e-9) {
      object.width = Math.max(1, object.width * fitScale);
      object.depth = Math.max(1, object.depth * fitScale);
      footprint = objectFootprintSize(object);
    }

    const minX = -room.width / 2 + footprint.width / 2;
    const maxX = room.width / 2 - footprint.width / 2;
    const minZ = -room.length / 2 + footprint.depth / 2;
    const maxZ = room.length / 2 - footprint.depth / 2;
    object.x = clampNumber(object.x, minX, maxX, 0);
    object.z = clampNumber(object.z, minZ, maxZ, 0);
    return object;
  }

  function rectanglesOverlap(a, b, gap) {
    const safeGap = Number(gap) || 0;
    const aFootprint = objectFootprintSize(a);
    const bFootprint = objectFootprintSize(b);
    return Math.abs(a.x - b.x) * 2 < aFootprint.width + bFootprint.width + safeGap &&
      Math.abs(a.z - b.z) * 2 < aFootprint.depth + bFootprint.depth + safeGap;
  }

  function findOpenSlot(object, state) {
    const step = Math.max(10, state.settings.snapSize || 10);
    const footprint = objectFootprintSize(object);
    const minX = -state.room.width / 2 + footprint.width / 2;
    const maxX = state.room.width / 2 - footprint.width / 2;
    const minZ = -state.room.length / 2 + footprint.depth / 2;
    const maxZ = state.room.length / 2 - footprint.depth / 2;

    for (let z = minZ; z <= maxZ; z += step) {
      for (let x = minX; x <= maxX; x += step) {
        const candidate = { ...object, x, z };
        if (!state.objects.some((other) => rectanglesOverlap(candidate, other, 6))) {
          return { x, z };
        }
      }
    }

    return { x: object.x, z: object.z };
  }

  function boundsFromPoints(a, b, snapSize) {
    const x1 = roundTo(a.x, snapSize);
    const z1 = roundTo(a.z, snapSize);
    const x2 = roundTo(b.x, snapSize);
    const z2 = roundTo(b.z, snapSize);
    const width = Math.max(1, Math.abs(x2 - x1));
    const depth = Math.max(1, Math.abs(z2 - z1));
    return {
      x: (x1 + x2) / 2,
      z: (z1 + z2) / 2,
      width,
      depth
    };
  }

  function objectFootprint(object) {
    const footprint = objectFootprintSize(object);
    return {
      minX: object.x - footprint.width / 2,
      maxX: object.x + footprint.width / 2,
      minZ: object.z - footprint.depth / 2,
      maxZ: object.z + footprint.depth / 2
    };
  }

  function getObjectVolume(object) {
    return object.width * object.depth * object.height;
  }

  function getRoomArea(room) {
    return room.width * room.length;
  }

  function getNearestInference(point, state) {
    const snapSize = state.settings.snapSize || 10;
    const candidates = [
      { x: roundTo(point.x, snapSize), z: roundTo(point.z, snapSize), label: "Grid" },
      { x: 0, z: roundTo(point.z, snapSize), label: "Eje X" },
      { x: roundTo(point.x, snapSize), z: 0, label: "Eje Z" }
    ];

    state.objects.forEach((object) => {
      const bounds = objectFootprint(object);
      candidates.push(
        { x: object.x, z: object.z, label: "Centro" },
        { x: bounds.minX, z: bounds.minZ, label: "Esquina" },
        { x: bounds.maxX, z: bounds.minZ, label: "Esquina" },
        { x: bounds.minX, z: bounds.maxZ, label: "Esquina" },
        { x: bounds.maxX, z: bounds.maxZ, label: "Esquina" },
        { x: object.x, z: bounds.minZ, label: "Medio borde" },
        { x: object.x, z: bounds.maxZ, label: "Medio borde" },
        { x: bounds.minX, z: object.z, label: "Medio borde" },
        { x: bounds.maxX, z: object.z, label: "Medio borde" }
      );
    });

    let best = candidates[0];
    let bestDistance = Infinity;
    candidates.forEach((candidate) => {
      const distance = Math.hypot(candidate.x - point.x, candidate.z - point.z);
      if (distance < bestDistance) {
        best = candidate;
        bestDistance = distance;
      }
    });

    return bestDistance <= Math.max(8, snapSize * 0.75) ? best : candidates[0];
  }

  window.Plano3D.geometry = {
    boundsFromPoints,
    clampObjectToRoom,
    findOpenSlot,
    getNearestInference,
    getObjectVolume,
    getRoomArea,
    objectFootprint,
    objectFootprintSize,
    rectanglesOverlap
  };
}());
