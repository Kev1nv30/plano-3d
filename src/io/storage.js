(function () {
  window.Plano3D = window.Plano3D || {};

  const { STORAGE_KEY, LEGACY_STORAGE_KEY } = window.Plano3D.config;
  const { sanitizeState } = window.Plano3D.state;

  function loadState() {
    const keys = [STORAGE_KEY, LEGACY_STORAGE_KEY];
    for (const key of keys) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        return sanitizeState(JSON.parse(raw));
      } catch (error) {
        console.warn("No se pudo cargar el plano guardado.", error);
      }
    }
    return sanitizeState(null);
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state, null, 2));
  }

  window.Plano3D.storage = {
    loadState,
    saveState
  };
}());
