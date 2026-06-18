# Publicar en GitHub

El repositorio local ya esta inicializado en `main` y tiene configurado este remoto:

```text
https://github.com/Kev1nv30/plano-3d.git
```

## Opcion recomendada con GitHub CLI

Desde esta carpeta:

```bash
gh auth login
gh repo create Kev1nv30/plano-3d --public --source=. --remote=origin --push
```

Si el repositorio ya fue creado desde la web:

```bash
git push -u origin main
```

## Opcion desde la web

1. Entra a GitHub y crea un repositorio nuevo llamado `plano-3d`.
2. No agregues README, `.gitignore` ni licencia desde GitHub.
3. Vuelve a esta carpeta y ejecuta:

```bash
git push -u origin main
```

## Si quieres que sea privado

Cambia `--public` por `--private` en el comando de GitHub CLI:

```bash
gh repo create Kev1nv30/plano-3d --private --source=. --remote=origin --push
```
