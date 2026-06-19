(function () {
  window.Plano3D = window.Plano3D || {};

  function makeId(prefix) {
    return `${prefix || "id"}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizeRotation(value) {
    const rotation = Number(value) || 0;
    return ((rotation % 360) + 360) % 360;
  }

  function roundTo(value, step) {
    const safeStep = Math.max(0.01, Number(step) || 1);
    return Math.round(value / safeStep) * safeStep;
  }

  function snapPoint(point, snapSize) {
    return {
      x: roundTo(point.x, snapSize),
      z: roundTo(point.z, snapSize)
    };
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function downloadText(filename, text, type) {
    const blob = new Blob([text], { type: type || "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function isTextInput(target) {
    return target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement;
  }

  window.Plano3D.utils = {
    clampNumber,
    deepClone,
    downloadText,
    isTextInput,
    makeId,
    normalizeRotation,
    roundTo,
    snapPoint
  };
}());
