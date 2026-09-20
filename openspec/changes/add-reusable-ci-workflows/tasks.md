> **Estado (2026-09-20):** el componente está publicado y en uso real.
> `main` tiene la primera versión estable, `zaphold2k/ci-workflows` es
> público con `v1` apuntando a ella, y `self-check.yml`/`release-please.yml`
> corren en verde en GitHub, no solo localmente.
>
> El ciclo de versionado se verificó de punta a punta dos veces, en vivo:
> aceptar la propuesta de release-please cortó `v1.0.0` con su changelog
> categorizado correctamente en español; un segundo commit `fix:` generó y
> aceptó la propuesta de `v1.0.1`, y ese ciclo encontró un bug real en el
> job que reapunta el tag mayor (el checkout superficial no traía el tag
> recién creado) que se corrigió y quedó verificado en la segunda vuelta.
> La versión inicial terminó siendo `v1.0.0` y no `v0.1.0` como asumía este
> archivo originalmente: el propio README y las plantillas documentan fijar
> `@v1`, que solo puede existir una vez que hay una serie mayor estable —
> partir de `0.1.0` habría dejado ese ejemplo roto desde el primer commit.
> Esto también se validó en vivo contra un pull request real (el que abre
> release-please): el ratchet publicó su comentario con el marcador de
> identidad, sin baseline en la primera corrida, contando 8 supresiones
> reales del árbol.
>
> Antes de eso, una auditoría completa contra las 87 tareas encontró y
> corrigió cuatro fallas reales que no tenían ninguna prueba cubriéndolas:
> la rama de integración faltante no hacía fallar la ejecución (5.2), un
> fallo al instalar `golangci-lint` tumbaba lint/typecheck/test/build
> enteros en vez de que cada etapa corriera independiente (parte de 4.6),
> no existía grupo de concurrencia por rama (5.7), y `docker_targets`
> —builds de varios binarios desde un mismo Dockerfile— estaba en el
> diseño pero nunca se había implementado (6.8). Los cuatro lenguajes
> (Node, Go, Python, Make) se ejercitaron en vivo contra la ejecución real
> del `verify` job vía [`act`](https://github.com/nektos/act), sin depender
> de GitHub (documentado en `AGENTS.md`).
>
> Adoptar el componente en un consumidor real (`duplexalmar`, node,
> `branch_model: simple`) encontró un bug real que ninguna auto-verificación
> local podía exponer: el paso que resuelve el repo/ref propio del
> componente para checkoutear sus scripts leía `$GITHUB_WORKFLOW_REF`, que
> dentro de un reusable workflow siempre nombra al workflow que llama, no al
> que es llamado — cuando caller y callee viven en el mismo repositorio (el
> propio dogfooding de `self-check.yml`) esa resolución acertaba por
> casualidad, y solo un consumidor externo real lo exponía. Se corrigió
> reemplazando la inferencia por un input requerido, `ci_workflows_ref`
> (commit `7ebf926` en `main`), ya que no existe ningún valor de contexto
> que un reusable workflow pueda leer para conocer su propio repo/ref
> (`github.job_workflow_ref` no existe pese a pedirse recurrentemente).
> Con el fix, una corrida real en `duplexalmar` con `dry_run: true` (rama
> `feature/ci-cd-release-deploy`,
> https://github.com/zaphold2k/duplexalmar/actions/runs/35488855755)
> completó el checkout, install/lint/typecheck/test/build, métricas,
> ratchet y el job de Docker completo (build multi-plataforma, smoke test,
> composición de la lista de tags, reporte de qué publicaría) sin publicar
> nada — eso satisface 12.4. El job `verify` de esa corrida sigue en rojo
> por un cuelgue real de la aplicación de `duplexalmar` al subir un HEIC en
> sus pruebas e2e, ajeno a este componente; ese `fix!` disparó el bump a
> `v2.0.0` en release-please, sin que hiciera falta nada manual.
>
> Con `@v2` + `ci_workflows_ref: v2`, `duplexalmar` repitió la corrida real
> (no dry-run) varias veces, de forma consistente: todo lo que depende del
> componente pasa limpio — lint, typecheck, test, build, `collect-metrics`,
> ratchet, el check de documentación generada, y el job de Docker completo
> con smoke test. Lo único en rojo sigue siendo el mismo cuelgue de e2e de
> la aplicación (descartaron timeout insuficiente y "browser frío" con
> evidencia real; quedó pausado para una sesión dedicada a la app de
> `duplexalmar`, no a este componente). 12.5 pide explícitamente que "su
> pipeline pase de punta a punta", y ese job todavía no lo hace por ese
> motivo ajeno — se deja sin marcar a propósito, con esta evidencia como
> registro de que la parte que le compete al componente ya está verificada
> en un consumidor externo real. Por la misma razón (nunca se llegó a
> publicar una imagen real) 6.3 y 6.7 tampoco se marcan todavía.
>
> Lo que sigue sin marcar ya no es infraestructura inalcanzable sino
> trabajo de continuación normal: la matriz completa de auto-verificación
> con historial de baseline real por rama y modelo (10.3–10.7), la
> promoción por digest contra un registro real con una imagen publicada
> (6.3 parcial, 6.4, 6.5, 6.7, 6.9, 6.10, ya que este repositorio no tiene
> Dockerfile propio para ejercitarlo), y que el pipeline de `duplexalmar`
> pase de punta a punta una vez resuelto el cuelgue de su propia suite e2e
> (12.5).

## 1. Bootstrap del repositorio

- [x] 1.1 Inicializar el repositorio local en `main`, con un `.gitignore` que excluya las skills de herramienta copiadas en `.claude/`, `LICENSE` y un `README.md` que describa el componente y muestre el ejemplo mínimo de invocación; verificar que `git status` quede limpio tras el primer commit y que el remoto `zaphold2k/ci-workflows` esté configurado
- [x] 1.2 Crear la estructura de directorios `.github/workflows/`, `scripts/`, `templates/`, `docs/` y `tests/fixtures/`, y verificar que el árbol quede como lo describe `design.md`
- [x] 1.3 Configurar el versionado del propio repositorio con `release-please` en modo simple, con las secciones del changelog en español, y verificar que la configuración valide contra su esquema

## 2. Recolección de métricas

- [x] 2.1 Completar `scripts/collect-metrics.mjs` (ya existe un borrador sin commitear) para que emita el archivo de métricas normalizado con cobertura, conteo de tests y supresiones, y verificar contra un caso de cada formato en `tests/fixtures/`
- [x] 2.2 Implementar la lectura de cobertura desde resumen de istanbul, lcov, salida de `go tool cover -func` y JSON de coverage.py, y verificar que cada formato produzca los mismos cuatro campos, con ausencia explícita donde el formato no reporta la métrica
- [x] 2.3 Implementar el conteo de tests desde JUnit XML y desde `go test -json`, contando elementos de caso y no atributos de totales, y verificar que un reporte con tests omitidos los separe de los que pasan
- [x] 2.4 Implementar el conteo de supresiones de linter y de chequeo de tipos excluyendo dependencias, artefactos de build y reportes, y verificar con un fixture que incluya supresiones dentro de un directorio excluido que no deben contarse
- [x] 2.5 Escribir las pruebas unitarias de los tres recolectores, ejecutables con el runner de pruebas nativo de Node, y verificar que cubran métrica ausente, reporte vacío y reporte malformado

## 3. Puerta de calidad incremental

- [x] 3.1 Implementar en `scripts/ratchet.mjs` la resolución de la rama de destino —la rama destino del pull request, o la rama de integración del modelo declarado en un push directo— y verificar que un pull request hacia la rama intermedia no tome como baseline la rama estable
- [x] 3.2 Implementar la descarga de la baseline desde la última ejecución exitosa del mismo workflow sobre esa rama, y verificar que la ausencia de baseline informe sin bloquear
- [x] 3.3 Implementar la comparación de cobertura con tolerancia configurable por defecto en cero, y verificar con fixtures los casos de caída, mejora y caída dentro de la tolerancia
- [x] 3.4 Implementar el bloqueo por caída en la cantidad de tests que pasan y por aumento de tests omitidos, y verificar el caso en que se borran tests sin que la cobertura se mueva
- [x] 3.5 Implementar el bloqueo por aumento de supresiones, y verificar que una rama que quita supresiones pase informando la mejora
- [x] 3.6 Implementar el reporte en el resumen de la ejecución y el comentario fijo en el pull request con marcador de identidad, y verificar que dos ejecuciones sucesivas actualicen el mismo comentario en lugar de agregar uno nuevo
- [x] 3.7 Implementar la etiqueta de override del pull request, y verificar que con ella presente una regresión se informe como excepción aceptada sin hacer fallar la ejecución
- [x] 3.8 Implementar el piso absoluto opcional de cobertura, y verificar que bloquee aunque la métrica haya mejorado respecto de la baseline
- [ ] 3.9 Hacer que la falta de permiso para comentar no altere el resultado, y verificar simulando una respuesta denegada del API

## 4. Workflow reutilizable de verificación

- [x] 4.1 Definir el contrato de entradas de `.github/workflows/ci.yml`, incluyendo el modelo de ramas y los nombres de rama configurables, y documentar cada una en `docs/INPUTS.md`, verificando que el workflow declare explícitamente los permisos que necesita
- [ ] 4.2 Implementar el paso que resuelve el repositorio y la referencia propios desde `github.workflow_ref` y hace el segundo checkout, y verificar invocando el workflow desde un repositorio de prueba con una referencia de rama y con una de tag
- [x] 4.3 Implementar la instalación del toolchain y la caché de dependencias para `node`, `go` y `python`, y verificar que cada proyecto de prueba instale sus dependencias en una ejecución limpia
- [x] 4.4 Implementar el modo `make`, delegando cada etapa a su objetivo homónimo sin instalar toolchain, y verificar contra un proyecto de prueba con Makefile
- [x] 4.5 Implementar las etapas de lint, typecheck, test, build y pruebas de extremo a extremo con comandos sobreescribibles, tratando la cadena vacía como omisión, y verificar que omitir el typecheck no haga fallar la ejecución
- [x] 4.6 Hacer que las etapas de verificación independientes se ejecuten aunque una anterior falle y que el resumen identifique cada etapa fallida, verificando con un proyecto de prueba que falle en lint y en test a la vez
- [x] 4.7 Rechazar un lenguaje no soportado antes de ejecutar cualquier paso, con un mensaje que enumere los valores aceptados, y verificar que la ejecución falle de inmediato
- [ ] 4.8 Integrar la recolección de métricas, la subida del artefacto y la ejecución del ratchet dentro del workflow, y verificar de punta a punta que un pull request de prueba que borra un test quede bloqueado

## 5. Modelo de ramas y prereleases por rama

- [x] 5.1 Implementar la resolución del rol de la rama actual dentro del modelo declarado, y verificar que una rama sin rol ejecute las verificaciones sin crear tags ni publicar imágenes
- [x] 5.2 Hacer fallar la ejecución cuando se declara el modelo completo y la rama de integración no existe, y verificar que el mensaje nombre la rama faltante
- [x] 5.3 Implementar el cálculo de la próxima versión base desde el último tag estable según conventional commits, y verificar los casos de corrección, funcionalidad y cambio incompatible en la serie cero y fuera de ella
- [x] 5.4 Implementar la sanitización del nombre de rama a un identificador válido en SemVer y como tag de imagen, y verificar que `feature/login-oauth` y `feature-login-oauth` produzcan el mismo identificador
- [x] 5.5 Implementar el contador por rama derivado del mayor tag existente para esa versión base y ese identificador, y verificar que dos ramas en paralelo mantengan series independientes
- [ ] 5.6 Implementar la creación del tag de prerelease en cada push a una rama de trabajo y del tag candidato en cada push a la rama de integración, y verificar que los tags creados no disparen una nueva ejecución del pipeline
- [x] 5.7 Agregar el grupo de concurrencia por rama que serializa los pushes sucesivos, y verificar que dos pushes seguidos no calculen el mismo contador
- [ ] 5.8 Verificar que la precedencia SemVer de los tags producidos por las tres ramas coincida con la dirección de promoción

## 6. Construcción y publicación de imágenes

- [x] 6.1 Implementar la generación de tags de imagen a partir del rol de la rama y del evento, con la regla que omite la versión mayor sola en la serie cero, la que impide que un prerelease mueva `latest` y el tag móvil con el nombre de la rama de trabajo, y verificar cada escenario de `specs/release-versioning`
- [x] 6.2 Implementar la construcción de una sola arquitectura con carga local y la prueba de humo opcional con endpoint, puerto, variables y tiempo límite configurables, volcando los logs del contenedor ante un fallo, y verificar con una imagen de prueba que arranca y otra que no
- [ ] 6.3 Implementar la construcción multi-plataforma y su publicación condicionada al rol de la rama, con la lista de plataformas configurable y la publicación desactivable, y verificar que un pull request construya sin publicar y que una rama fuera del modelo tampoco publique
- [ ] 6.4 Implementar la promoción por digest de la rama de integración a la estable, componiendo la lista de manifiestos sobre los mismos blobs sin reconstruir, y verificar que el digest publicado como versión estable sea idéntico al del candidato
- [ ] 6.5 Hacer fallar la promoción cuando el digest del candidato no existe en el registro, y verificar que informe qué digest buscaba y que no reconstruya
- [x] 6.6 Hacer que el modelo simple construya la versión estable en lugar de promoverla, y verificar que un repositorio con modelo simple publique correctamente sin rama de integración
- [ ] 6.7 Verificar que la imagen promovida siga sirviendo cada arquitectura publicada, haciendo pull desde una plataforma emulada de cada una
- [ ] 6.8 Implementar la matriz de targets del mismo Dockerfile con caché separada por target, y verificar con un proyecto de prueba de dos targets que se publiquen dos imágenes independientes
- [ ] 6.9 Implementar la autenticación con el registro, con credenciales propias opcionales, y verificar que ningún valor secreto aparezca en los logs de la ejecución
- [ ] 6.10 Hacer que un fallo de lectura o escritura de la caché no haga fallar la ejecución, y verificar forzando una clave de caché inválida

## 7. Versionado y changelog de los repositorios consumidores

- [x] 7.1 Implementar `.github/workflows/release.yml` como workflow reutilizable que ejecuta `release-please` con el tipo de release según el lenguaje, y verificar que un repositorio de prueba genere su pull request de release
- [x] 7.2 Definir las secciones del changelog en español y verificar que un commit de funcionalidad, uno de corrección y uno incompatible caigan cada uno en su sección y que el incompatible quede destacado
- [x] 7.3 Verificar el cálculo del incremento en la serie cero, comprobando que un cambio marcado como incompatible produzca un incremento menor y no mayor
- [x] 7.4 Verificar que el tag creado al aceptar la propuesta dispare la publicación o la promoción de imágenes con los tags esperados, según el modelo declarado
- [ ] 7.5 Implementar la inyección de la versión efectiva por entorno y su etiqueta OCI, y verificar que una imagen promovida reporte la versión de su tag y no la del manifiesto anterior al bump

## 8. Modo de ejecución sin efectos

- [x] 8.1 Agregar la entrada que activa el modo sin efectos, desactivada por defecto, y verificar que un repositorio que no la declara siga produciendo todos sus efectos
- [x] 8.2 Suprimir en ese modo la publicación de imágenes, la creación y el movimiento de tags de git, la promoción de digests, la creación de releases y la escritura de comentarios, verificando que tras una ejecución el registro, los tags del repositorio y el pull request queden intactos
- [x] 8.3 Verificar que las etapas de instalación, lint, typecheck, tests, cobertura, métricas, construcción y prueba de humo se ejecuten igual que en el modo normal, comprobando que un repositorio con tests fallidos falle también en este modo
- [ ] 8.4 Implementar el reporte de efectos suprimidos en el resumen de la ejecución, con los tags e imágenes, el digest que se habría promovido y el contenido del comentario, y verificar que distinga lo ejecutado de lo reportado
- [ ] 8.5 Hacer que el reporte se emita aunque una etapa de verificación haya fallado, y verificar forzando un fallo temprano de lint
- [x] 8.6 Hacer que la comparación de métricas se ejecute e informe sin bloquear en este modo, indicando si habría bloqueado, y verificar con una rama que baja la cobertura
- [ ] 8.7 Verificar que el cálculo de tags y la resolución del digest se ejecuten y se impriman en lugar de saltearse, comprobando que un error deliberado en la derivación de tags falle también en este modo
- [ ] 8.8 Hacer que el encabezado del resumen indique que el modo está activo, y verificar que la lista de efectos suprimidos aparezca aun cuando esté vacía

## 9. Documentación de flujo generada por repositorio

- [x] 9.1 Implementar `scripts/render-docs.mjs`, que produce el bloque de flujo a partir de la configuración del pipeline de un repositorio, y verificar que el bloque generado refleje el modelo de ramas, los nombres de rama, el lenguaje y la imagen declarados
- [x] 9.2 Implementar la escritura delimitada por marcadores en el README y en los documentos de agente, y verificar que el contenido fuera de los marcadores quede intacto
- [x] 9.3 Verificar la idempotencia: regenerar el bloque de un repositorio cuya configuración no cambió no modifica ningún archivo
- [x] 9.4 Implementar la inserción de los marcadores cuando el archivo todavía no los tiene, y verificar que el contenido previo se conserve
- [x] 9.5 Hacer que la generación se niegue a escribir cuando no encuentra exactamente un par de marcadores bien formado, y verificar los casos de marcador faltante, duplicado y desordenado, comprobando que el mensaje indique qué encontró
- [x] 9.6 Generar el mismo contenido en la voz explicativa para el README y en la voz prescriptiva para los documentos de agente, y verificar que ambas describan el mismo modelo y las mismas transiciones
- [x] 9.7 Incluir en el bloque prescriptivo las acciones que no corresponden ante un bloqueo y la aclaración de que la etiqueta de override es una decisión humana, y verificar contra los escenarios de `specs/agent-playbook`
- [x] 9.8 Agregar al workflow reutilizable la verificación de que el bloque corresponde a la configuración vigente, y verificar que un cambio de modelo de ramas sin regenerar haga fallar la ejecución
- [x] 9.9 Verificar que el bloque permita responder, sin salir del repositorio, de qué rama partir, contra cuál abrir el pull request, qué verificaciones bloquean, qué produce cada integración y qué acción corta cada tipo de paquete

## 10. Verificación del propio componente

- [x] 10.1 Crear los proyectos de prueba mínimos por lenguaje en `tests/fixtures/`, cada uno con Dockerfile, tests y una supresión de linter deliberada, y verificar que cada uno construya y pase sus tests localmente
- [x] 10.2 Agregar el workflow propio del repositorio que ejecuta el análisis sintáctico de todos los workflows y las pruebas unitarias de los scripts, y verificar que falle ante un workflow con una entrada mal declarada
- [ ] 10.3 Armar la matriz de verificación como combinación de lenguaje, rol de rama y modelo, ejecutada en modo sin efectos, y verificar que cubra los cuatro lenguajes, los roles de ambos modelos, la rama sin rol y la promoción por digest
- [ ] 10.4 Agregar la comprobación de que todo camino del componente está cubierto por la matriz, y verificar que agregar una entrada o un paso nuevo sin cubrirlo haga fallar la verificación
- [ ] 10.5 Ejecutar la matriz también en modo normal contra los proyectos de prueba, donde publicar es inofensivo, y verificar que ambos modos recorran los mismos caminos
- [ ] 10.6 Verificar el ciclo completo del ratchet en el repositorio: una ejecución de la rama de destino que deja baseline, una rama que mejora y pasa, y una rama que regresa y queda bloqueada
- [ ] 10.7 Verificar el ciclo completo de ramas en un repositorio de prueba con modelo completo: un push a una rama de trabajo que deja su prerelease, la integración que deja el candidato, y el corte de versión que promueve ese mismo digest

## 11. Documentación del componente y plantillas

- [x] 11.1 Escribir `docs/VERSIONING.md` con los dos modelos de ramas, la tabla de qué produce cada rama y la de derivación de tags de imagen, y verificar que cada fila corresponda a un escenario de la spec
- [x] 11.2 Escribir `docs/BRANCHING.md` con los dos modelos, el criterio para elegir uno, cómo nombrar las ramas de trabajo y cómo se cierra una rama incluyendo la limpieza de sus tags de prerelease, y verificar que el criterio de elección sea aplicable sin conocer el componente
- [x] 11.3 Escribir `docs/QUALITY-GATES.md` explicando cada métrica, por qué bloquea y cómo se usa la etiqueta de override, y verificar que incluya qué hacer ante cada tipo de fallo
- [x] 11.4 Escribir `docs/BRANCH-PROTECTION.md` con la configuración necesaria para que la puerta sea bloqueante en cada modelo, incluyendo los comandos para aplicarla, y verificar aplicándola sobre el propio repositorio
- [x] 11.5 Escribir `docs/DRY-RUN.md` con cuándo y cómo usar el modo sin efectos para ejercitar un cambio del componente o ensayar una adopción, y verificar que el procedimiento sea seguible sin conocimiento previo del repositorio
- [x] 11.6 Escribir `AGENTS.md` y `CLAUDE.md` del propio repositorio, y verificar que un agente sin contexto previo pueda determinar a partir de ellos cómo modificar el componente, cómo ejercitarlo en modo sin efectos y qué debe cubrir antes de publicar un camino nuevo
- [x] 11.7 Crear las plantillas de `templates/node`, `templates/go`, `templates/python` y `templates/make`, cada una con el workflow de CI, el de release y la configuración de release-please, para los dos modelos de ramas; verificar que copiar una plantilla a un proyecto de prueba y generar su bloque de documentación produzca un pipeline funcional sin ediciones más allá del nombre de la imagen
- [x] 11.8 Escribir `docs/MIGRATION.md` con la guía de migración por perfil de repositorio —el que ya tiene pipeline propio, el que no tiene CI, el que publica varios binarios de un mismo Dockerfile y el que construye con un script manual y un Dockerfile por arquitectura— indicando para cada uno qué modelo de ramas le corresponde, qué archivos se reemplazan, qué comportamiento queda cubierto por qué entrada del componente y el paso de generar su documentación de flujo; verificar que cada perfil sea seguible sin conocer el repositorio concreto
- [x] 11.9 Verificar que ningún archivo publicado en este repositorio nombre un repositorio privado ni exponga su estructura interna, y dejar esa convención escrita en el `AGENTS.md` del componente para que valga también en los cambios futuros
- [x] 11.10 Completar el `README.md` con la tabla de entradas, la tabla de modelos de ramas, los ejemplos por lenguaje y el enlace a cada documento, y verificar que el ejemplo mínimo sea copiable y funcione tal cual

## 12. Primera versión publicada

- [x] 12.1 Verificar que toda la verificación propia del repositorio esté en verde y que el ratchet del propio repositorio tenga baseline en su rama de destino
- [x] 12.2 Cortar la versión `v0.1.0` aceptando la propuesta de release, y verificar que el tag y el changelog queden publicados
- [x] 12.3 Implementar y verificar el reapuntado del tag de serie mayor con cada versión estable, comprobando que un prerelease no lo mueva
- [x] 12.4 Ensayar la adopción en `duplexalmar` en modo sin efectos y verificar que el reporte enumere lo que publicaría, sin haber publicado nada
- [ ] 12.5 Verificar la adopción real invocando el componente desde `duplexalmar` con el modelo simple y la referencia de serie mayor, comprobando que su pipeline pase de punta a punta y que su documentación de flujo quede generada
