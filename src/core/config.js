(function () {
  window.Plano3D = window.Plano3D || {};

  const STORAGE_KEY = "plano-3d-home-gym-v2";
  const LEGACY_STORAGE_KEY = "plano-3d-home-gym-v1";
  const THEME_KEY = "plano-3d-theme";

  const TAGS = [
    { id: "tag-base", name: "Modelo", visible: true },
    { id: "tag-equipment", name: "Equipos", visible: true },
    { id: "tag-guides", name: "Guias", visible: true }
  ];

  const MATERIALS = [
    { id: "mat-green", name: "Verde", color: "#3e9b84", transparent: false },
    { id: "mat-wood", name: "Madera", color: "#b8a783", transparent: false },
    { id: "mat-graphite", name: "Grafito", color: "#344a47", transparent: false },
    { id: "mat-bronze", name: "Bronce", color: "#806b4b", transparent: false },
    { id: "mat-zone", name: "Zona", color: "#dce9df", transparent: true }
  ];

  const presets = {
    rack: {
      name: "Rack",
      width: 120,
      depth: 60,
      height: 210,
      color: "#3e9b84",
      tagId: "tag-equipment",
      materialId: "mat-green"
    },
    bench: {
      name: "Banca",
      width: 120,
      depth: 50,
      height: 45,
      color: "#b8a783",
      tagId: "tag-equipment",
      materialId: "mat-wood"
    },
    treadmill: {
      name: "Caminadora",
      width: 160,
      depth: 75,
      height: 120,
      color: "#344a47",
      tagId: "tag-equipment",
      materialId: "mat-graphite"
    },
    dumbbells: {
      name: "Mancuernas",
      width: 100,
      depth: 45,
      height: 90,
      color: "#806b4b",
      tagId: "tag-equipment",
      materialId: "mat-bronze"
    },
    bike: {
      name: "Bicicleta",
      width: 110,
      depth: 55,
      height: 130,
      color: "#4f7b67",
      tagId: "tag-equipment",
      materialId: "mat-green"
    },
    free: {
      name: "Zona libre",
      width: 100,
      depth: 100,
      height: 3,
      color: "#dce9df",
      transparent: true,
      tagId: "tag-base",
      materialId: "mat-zone"
    }
  };

  window.Plano3D.config = {
    STORAGE_KEY,
    LEGACY_STORAGE_KEY,
    THEME_KEY,
    TAGS,
    MATERIALS,
    presets
  };
}());
