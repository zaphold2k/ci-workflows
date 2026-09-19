## Why

Hoy cada repositorio reescribe su CI desde cero y el resultado es desparejo: `giftlist` tiene un pipeline completo con coverage ratchet y build multi-arch, un servicio en Go tiene lint y umbral fijo de cobertura pero no publica arm64, `duplexalmar` no tiene CI a pesar de tener Dockerfile y suite de tests, y `omni` todavía construye sus imágenes con un `build.sh` manual que mantiene un `Dockerfile` y un `DockerfileARM` separados. Cada arreglo o mejora del pipeline hay que portarlo a mano de un repo a otro, y en la práctica no se porta.

El problema que urge más: casi todo el código de estos repos lo escribe un agente de IA. Un pipeline que solo responde "verde o rojo" no alcanza, porque la forma más rápida de poner algo en verde es borrar el test que molesta, marcarlo `skip` o silenciar el linter — y eso pasa el CI mientras empeora el producto. El CI necesita medir la dirección del cambio, no solo su estado.

## What Changes

- Se crea el repositorio `zaphold2k/ci-workflows`, que expone workflows reutilizables de GitHub Actions (`workflow_call`) que cualquier repo puede importar con unas quince líneas en lugar de mantener su propio pipeline.
- **Un único workflow de CI** con input `language` (`node`, `go`, `python`, `make`) y pasos condicionales, en vez de un workflow por lenguaje: instala el toolchain, corre lint, typecheck, tests y build con comandos sobreescribibles por repo.
- **Puerta de calidad incremental (ratchet multi-métrica)**: cada corrida normaliza tests y cobertura a un archivo único de métricas y lo compara contra la última corrida verde de la rama base. La rama se bloquea si baja la cobertura, si baja la cantidad de tests que pasan, si sube la cantidad de tests skippeados o si sube la cantidad de supresiones de linter. La ausencia de baseline informa sin bloquear; un umbral fijo inventado sobre la cobertura de hoy sería un número arbitrario.
- **Build Docker multi-arquitectura** `linux/amd64` + `linux/arm64` (arm64 emulado con QEMU) con push a `ghcr.io`, caché `type=gha`, smoke test opcional del contenedor antes de publicar, y soporte para varios targets del mismo Dockerfile.
- **Dos modelos de ramas elegibles por el repositorio consumidor**: un flujo simple de `main` más ramas de trabajo para los repos chicos, y un flujo completo que agrega `develop` en el medio para los complejos. El modelo se declara explícitamente y los nombres de rama son configurables.
- **Una versión distinta por rama**: cada push a una rama de trabajo crea automáticamente un tag de prerelease `alpha` que lleva el nombre de la rama en su identificador, de modo que varias ramas vivas a la vez no compitan por el mismo número; `develop` produce candidatos `rc`; `main` produce la versión estable. La precedencia de SemVer queda alineada con la dirección de promoción.
- **Promoción por digest**: en el flujo completo, `main` no reconstruye la imagen sino que le agrega los tags de release al mismo digest que ya pasó por `develop`, de modo que lo que se probó es exactamente lo que sale, sin volver a pagar la compilación emulada de arm64.
- **Regla de versionado unificada** donde la fuente de verdad es el tag de git y no el archivo de versión del lenguaje, lo que la hace idéntica en Node, Go, Python y Ansible. Los tags de imagen se derivan del tag de git con reglas explícitas para `0.x` y para prereleases.
- **Changelog y release automáticos** con release-please: conventional commits en la rama principal abren un PR de release que, al mergearse, crea el tag y dispara la publicación de imágenes.
- **Plantillas listas para copiar** por lenguaje y documentación de migración para los repos que ya existen, más la configuración de branch protection necesaria para que la puerta sea realmente bloqueante.
- **Documentación del flujo instalada en cada repo consumidor**, tanto en su README como en sus documentos de agente, describiendo el flujo concreto de ese repositorio: de qué rama partir, contra cuál abrir el pull request, qué verificaciones van a correr y cuáles bloquean, qué produce cada integración, cómo cortar un paquete, y por qué la puerta de calidad no es algo que un agente deba eludir. El bloque se genera a partir de la configuración del repositorio y su propia verificación falla si queda desactualizado.
- **Modo de ejecución sin efectos**, que corre el pipeline completo pero reporta lo que publicaría, taggearía o comentaría en lugar de hacerlo, para poder ejercitar cambios del componente y ensayar su adopción en un repositorio sin consecuencias externas.

No es un objetivo de este cambio migrar los repos existentes; eso se hace después, repo por repo, con las plantillas y la guía que este cambio produce.

## Capabilities

### New Capabilities
- `ci-pipeline`: workflow reutilizable que ejecuta la verificación de un repo (instalación del toolchain, lint, typecheck, tests y build) para Node, Go, Python o un Makefile genérico, con comandos sobreescribibles.
- `quality-ratchet`: recolección normalizada de métricas de tests, cobertura y supresiones de linter, y comparación contra la baseline de la rama base para bloquear ramas que empeoran el estado del repo.
- `docker-multiarch-build`: construcción y publicación de imágenes para `linux/amd64` y `linux/arm64` en `ghcr.io`, con smoke test previo, caché compartida y soporte de múltiples targets.
- `release-versioning`: modelos de ramas soportados, regla de versionado SemVer por tag de git común a todos los lenguajes, derivación de los tags de imagen y de los prereleases de cada rama, y generación automática de changelog y releases a partir de conventional commits.
- `agent-playbook`: documentación del flujo instalada en cada repositorio, que permite a una persona o a un agente saber cómo se trabaja en él —de qué rama partir, contra cuál abrir el pull request, qué verificaciones bloquean, qué produce cada integración y cómo cortar un paquete— y que le deja claro a un agente que la puerta de calidad es un límite y no un obstáculo a sortear.
- `dry-run`: modo de ejecución que corre el pipeline completo sin producir efectos fuera de la ejecución, reportando lo que habría publicado, taggeado o comentado, para poder verificar el componente y ensayar su adopción sin consecuencias.

### Modified Capabilities

Ninguna: el proyecto no tiene specs previas.

## Impact

Este repositorio es público, así que los artefactos de planificación nombran solo repositorios públicos; los privados se describen por su perfil técnico, que es lo único que aporta a las decisiones de diseño.

- **Repositorio nuevo**: `zaphold2k/ci-workflows` (público, ya creado y vacío). Público a propósito, porque un workflow reutilizable alojado en un repo privado no puede ser invocado desde un repo público como `duplexalmar` o `giftlist`.
- **Superficie de contrato**: los inputs del workflow reutilizable pasan a ser API pública. Cambiarlos de forma incompatible es un cambio mayor para todos los repos consumidores, que pinean el tag mayor móvil `v1`.
- **Repos consumidores (a futuro, fuera de este cambio)**: `giftlist` reemplaza su `ci.yml` y su `scripts/coverage-ratchet.ts`; `duplexalmar` incorpora CI por primera vez; el servicio en Go gana arm64 y cambia el umbral fijo por el ratchet; `omni` reemplaza `build.sh` y su `DockerfileARM`.
- **Modelo de ramas de los consumidores**: un repositorio que adopte el flujo completo necesita crear `develop` y dirigir sus pull requests de trabajo hacia ella. Un repositorio que adopte el flujo simple no cambia su estructura de ramas actual.
- **Archivos de los consumidores**: adoptar el componente agrega a cada repositorio un bloque delimitado en su README y en sus documentos de agente, regenerable desde la configuración del pipeline. El resto del contenido de esos archivos queda intacto.
- **Permisos y secretos**: los repos consumidores necesitan `packages: write` para publicar en GHCR, `pull-requests: write` para el comentario de métricas y `contents: write` para crear los tags de prerelease; alcanza con el `GITHUB_TOKEN` por defecto.
- **Dependencias externas**: `actions/checkout`, `actions/setup-node|setup-go|setup-python`, `docker/setup-qemu-action`, `docker/setup-buildx-action`, `docker/login-action`, `docker/metadata-action`, `docker/build-push-action`, `actions/upload-artifact`, `googleapis/release-please-action`, y el CLI `gh` preinstalado en los runners.
- **Costo de CI**: la construcción de arm64 por emulación es sensiblemente más lenta que la de amd64. Se mitiga construyendo una sola arquitectura en los pull requests y reservando la construcción multi-arquitectura para los push.
