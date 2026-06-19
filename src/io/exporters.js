(function () {
  window.Plano3D = window.Plano3D || {};

  const { downloadText } = window.Plano3D.utils;

  function exportJson(state) {
    downloadText("plano-3d.json", JSON.stringify(state, null, 2), "application/json");
  }

  function exportObj(state) {
    const lines = [
      "# Plano 3D OBJ",
      "mtllib plano-3d.mtl"
    ];
    let vertexOffset = 1;
    visibleObjects(state).forEach((object) => {
      const mesh = boxMesh(object);
      lines.push(`o ${safeName(object.name)}`);
      lines.push(`usemtl ${safeName(object.materialId || object.id)}`);
      mesh.vertices.forEach((v) => lines.push(`v ${format(v.x)} ${format(v.y)} ${format(v.z)}`));
      mesh.faces.forEach((face) => {
        lines.push(`f ${face.map((index) => index + vertexOffset).join(" ")}`);
      });
      vertexOffset += mesh.vertices.length;
    });
    downloadText("plano-3d.obj", `${lines.join("\n")}\n`, "model/obj");
  }

  function exportStl(state) {
    const lines = ["solid plano_3d"];
    visibleObjects(state).forEach((object) => {
      const mesh = boxMesh(object);
      mesh.triangles.forEach((triangle) => {
        const normal = triangleNormal(
          mesh.vertices[triangle[0]],
          mesh.vertices[triangle[1]],
          mesh.vertices[triangle[2]]
        );
        lines.push(`  facet normal ${format(normal.x)} ${format(normal.y)} ${format(normal.z)}`);
        lines.push("    outer loop");
        triangle.forEach((index) => {
          const vertex = mesh.vertices[index];
          lines.push(`      vertex ${format(vertex.x)} ${format(vertex.y)} ${format(vertex.z)}`);
        });
        lines.push("    endloop");
        lines.push("  endfacet");
      });
    });
    lines.push("endsolid plano_3d");
    downloadText("plano-3d.stl", `${lines.join("\n")}\n`, "model/stl");
  }

  function visibleObjects(state) {
    return state.objects.filter((object) => {
      const tag = state.tags.find((item) => item.id === object.tagId);
      return object.visible !== false && tag?.visible !== false;
    });
  }

  function boxMesh(object) {
    const hw = object.width / 2;
    const hd = object.depth / 2;
    const h = object.height;
    const local = [
      { x: -hw, y: 0, z: -hd },
      { x: hw, y: 0, z: -hd },
      { x: hw, y: 0, z: hd },
      { x: -hw, y: 0, z: hd },
      { x: -hw, y: h, z: -hd },
      { x: hw, y: h, z: -hd },
      { x: hw, y: h, z: hd },
      { x: -hw, y: h, z: hd }
    ];
    const angle = (object.rotation || 0) * Math.PI / 180;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const vertices = local.map((vertex) => ({
      x: object.x + vertex.x * cos - vertex.z * sin,
      y: vertex.y,
      z: object.z + vertex.x * sin + vertex.z * cos
    }));
    const faces = [
      [1, 2, 3, 4],
      [5, 8, 7, 6],
      [1, 5, 6, 2],
      [2, 6, 7, 3],
      [3, 7, 8, 4],
      [4, 8, 5, 1]
    ];
    const triangles = [
      [0, 1, 2], [0, 2, 3],
      [4, 6, 5], [4, 7, 6],
      [0, 4, 5], [0, 5, 1],
      [1, 5, 6], [1, 6, 2],
      [2, 6, 7], [2, 7, 3],
      [3, 7, 4], [3, 4, 0]
    ];
    return { vertices, faces, triangles };
  }

  function triangleNormal(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const ac = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    const normal = {
      x: ab.y * ac.z - ab.z * ac.y,
      y: ab.z * ac.x - ab.x * ac.z,
      z: ab.x * ac.y - ab.y * ac.x
    };
    const length = Math.hypot(normal.x, normal.y, normal.z) || 1;
    return {
      x: normal.x / length,
      y: normal.y / length,
      z: normal.z / length
    };
  }

  function format(number) {
    return Number(number).toFixed(4).replace(/\.?0+$/, "");
  }

  function safeName(name) {
    return String(name || "item").replace(/[^a-z0-9_-]+/gi, "_");
  }

  window.Plano3D.exporters = {
    exportJson,
    exportObj,
    exportStl
  };
}());
