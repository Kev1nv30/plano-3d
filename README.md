# Plano 3D

Modelador web simple para planificar espacios 3D. La app esta enfocada en escritorio web y toma como referencia el flujo base tipo SketchUp: dibujar, seleccionar, empujar/tirar, transformar, organizar y exportar.

## Funciones principales

- Vista 3D y vista superior con orbit, pan, zoom y ajustar vista.
- Seleccion, movimiento con snapping, rotacion, escala, offset, flip y matrices.
- Dibujo de rectangulos sobre el piso con altura configurable.
- Push/Pull para cambiar la altura de un volumen.
- Caja de medidas para aplicar dimensiones, altura, rotacion o escala numerica.
- Inferencias simples de grid, ejes, centros, esquinas y puntos medios.
- Cinta metrica, guias visuales y limpieza de guias.
- Objetos predefinidos y objeto personalizado.
- Inspector con medidas, posicion, rotacion, color, material, tag, bloqueo y visibilidad.
- Tags con visibilidad, materiales basicos, grupos y componentes.
- Escenas con snapshot de camara, visibilidad, grilla, muros y section plane.
- Section plane visual por eje X/Z.
- Guardado local en navegador.
- Importacion/exportacion JSON y exportacion de malla OBJ/STL.
- Undo/redo para operaciones principales.

## Estructura

```text
index.html
styles.css
src/
  core/
    config.js        # presets, tags, materiales y claves
    utils.js         # helpers generales
    geometry.js      # snapping, bounds, clamps y calculos
    state.js         # estado inicial y sanitizacion
    commands.js      # undo/redo por snapshots
  io/
    storage.js       # localStorage
    exporters.js     # JSON, OBJ y STL
  view/
    dom.js           # referencias DOM
    scene-renderer.js# Three.js, camara, guias, previews y cortes
    tool-controller.js# herramientas de modelado e interaccion
  app-controller.js  # orquestacion de UI, estado y comandos
  main.js            # bootstrap
```

## Como ejecutarlo

Sirve la carpeta con un servidor local:

```bash
python -m http.server 4174 --bind 127.0.0.1
```

Luego entra a:

```text
http://127.0.0.1:4174/
```

La app usa Three.js desde CDN y no necesita build.
