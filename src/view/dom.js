(function () {
  window.Plano3D = window.Plano3D || {};

  function getDom() {
    const ids = [
      "sceneCanvas",
      "viewport",
      "roomWidth",
      "roomLength",
      "roomHeight",
      "showWalls",
      "showGrid",
      "roomBadge",
      "objectBadge",
      "areaMetric",
      "objectList",
      "emptyInspector",
      "inspectorForm",
      "deleteBtn",
      "duplicateBtn",
      "saveStatus",
      "view3dBtn",
      "viewTopBtn",
      "themeBtn",
      "themeIcon",
      "fitBtn",
      "navModeBadge",
      "presetGrid",
      "customForm",
      "customName",
      "customWidth",
      "customDepth",
      "customHeight",
      "customColor",
      "saveBtn",
      "exportJsonBtn",
      "exportObjBtn",
      "exportStlBtn",
      "importBtn",
      "importFile",
      "clearBtn",
      "toolset",
      "measurementInput",
      "snapSize",
      "drawHeight",
      "offsetDistance",
      "arrayCount",
      "undoBtn",
      "redoBtn",
      "groupBtn",
      "componentBtn",
      "arrayBtn",
      "flipBtn",
      "addSceneBtn",
      "sceneList",
      "tagList",
      "materialList",
      "guideList",
      "clearGuidesBtn",
      "sectionEnabled",
      "sectionAxis",
      "sectionOffset",
      "sectionInvert",
      "toolHint",
      "inferenceBadge"
    ];

    const dom = {};
    ids.forEach((id) => {
      dom[id] = document.getElementById(id);
    });

    dom.inspectorInputs = {
      name: document.getElementById("objName"),
      width: document.getElementById("objWidth"),
      depth: document.getElementById("objDepth"),
      height: document.getElementById("objHeight"),
      left: document.getElementById("objLeft"),
      front: document.getElementById("objFront"),
      rotation: document.getElementById("objRotation"),
      color: document.getElementById("objColor"),
      tagId: document.getElementById("objTag"),
      materialId: document.getElementById("objMaterial"),
      locked: document.getElementById("objLocked"),
      visible: document.getElementById("objVisible")
    };

    return dom;
  }

  window.Plano3D.dom = { getDom };
}());
