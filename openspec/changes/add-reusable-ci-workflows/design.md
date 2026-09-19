## Context

Ver `proposal.md` — Why para la motivación. Lo que condiciona el diseño:

- **El componente corre en repos ajenos.** Un workflow reutilizable invocado desde otro repositorio se ejecuta con el contexto del repositorio llamador: `github.repository`, el checkout por defecto y los permisos son los del consumidor. Todo lo que el componente necesite de sí mismo tiene que traerlo explícitamente.
- **Los runners son amd64.** GitHub no ofrece runners arm64 gratuitos para repos públicos, así que `linux/arm64` se construye por emulación, que es entre tres y diez veces más lento según el proyecto. `giftlist` ya paga ese costo compilando `better-sqlite3` emulado.
- **Los repos son heterogéneos en herramientas pero homogéneos en forma.** Node con vitest, Go con `go test`, Python con pytest: distintas herramientas, mismo pipeline conceptual. Lo que varía es el toolchain y el formato de los reportes, no las etapas.
- **Hay un consumidor de referencia y uno de riesgo cero.** `giftlist` ya tiene a mano todo lo que el componente va a hacer, y sirve de contraste para verificar que no se pierde nada. `duplexalmar` no tiene CI, así que adoptarlo no puede romper nada.
- **Las entradas del componente son API pública.** Una vez que tres repos lo importan, renombrar una entrada es un cambio incompatible.
- **Este repositorio es público y algunos consumidores no lo son.** Los artefactos de planificación nombran repositorios públicos y describen a los privados por su perfil técnico, que es lo único que aporta a una decisión de diseño.
- **Los repos no comparten un mismo modelo de ramas.** Los chicos trabajan contra `main` directamente y los complejos necesitan una rama de integración intermedia. El componente tiene que servir a los dos sin que el simple pague la complejidad del completo.
- **Quien opera el componente suele ser un agente.** No alcanza con que el pipeline esté bien diseñado: tiene que poder deducirse desde la documentación qué rama usar, qué produce cada push y cómo cortar un paquete, sin preguntarle a nadie.

## Goals / Non-Goals

**Goals:**

- Que adoptar el CI en un repo nuevo cueste un archivo de unas quince líneas.
- Que la puerta de calidad sea incremental por defecto y difícil de eludir sin que quede registro.
- Que agregar un lenguaje no obligue a tocar los repos que ya usan el componente.
- Que el componente sea verificable en su propio repositorio, sin necesidad de romper un repo consumidor para descubrir un error.
- Que un agente pueda operar el componente de punta a punta leyendo su documentación, y que esa documentación le deje claro dónde termina su autonomía.

**Non-Goals:**

- Despliegue. El componente publica imágenes; quién las baja y cómo se actualiza el servidor es responsabilidad del repositorio de despliegue, que queda fuera de este alcance.
- Escaneo de vulnerabilidades y firma de imágenes. Son deseables y encajan naturalmente después, pero agregarlos ahora amplía la superficie antes de que el componente tenga un solo consumidor.
- Matrices de versiones del runtime. Los repos del usuario fijan una versión del toolchain; probar contra tres versiones de Node es un problema de librerías, no de aplicaciones dockerizadas.
- Migrar los repos existentes. Este cambio produce las plantillas y la guía; la migración es un cambio por repo.

## Decisions

### Un solo workflow con `language` como entrada, en vez de uno por lenguaje

Un workflow por lenguaje da archivos más cortos y legibles, pero cerca del setenta por ciento de cada uno sería idéntico: el bloque de Docker, el de métricas, el de ratchet y el de tags. Cuatro copias de ese bloque divergen en el primer arreglo que alguien aplique a una sola.

La alternativa de anidar workflows —un `ci.yml` por lenguaje que invoque un `docker.yml` común— no funciona de forma confiable: una referencia relativa a un workflow reutilizable se resuelve contra el repositorio llamador, no contra el que contiene el archivo, así que el `docker.yml` habría que referenciarlo con su ruta absoluta y su versión fija, y eso rompe poder probar una rama del componente de punta a punta.

Se elige un único `ci.yml` con pasos condicionados por `inputs.language`. El archivo es largo, pero cada etapa aparece una sola vez y la lógica compartida no se duplica. Las secciones específicas de cada lenguaje se mantienen contiguas y marcadas.

### El componente hace checkout de sí mismo parseando `github.workflow_ref`

Los scripts de métricas y ratchet son demasiado largos para incrustarlos como bloques `run` y necesitan ser legibles y testeables por separado. Para poder ejecutarlos, el workflow tiene que tener su propio repositorio en disco, y el checkout por defecto trae el del consumidor.

`github.workflow_ref` contiene `owner/repo/.github/workflows/ci.yml@refs/tags/v1`, de donde salen el repositorio y la referencia exacta con los que fue invocado. Las expresiones de Actions no tienen una función de corte de cadenas, así que el parseo se hace en un paso de shell que expone repositorio y referencia como salidas, y un segundo checkout los usa para traer el componente a un directorio propio.

La alternativa era publicar los scripts como paquete y descargarlos, lo que agrega una dependencia de publicación y desincroniza el código de los scripts respecto de la versión del workflow que los usa. Con el checkout, los scripts siempre son exactamente los de la versión invocada.

### Un único archivo de métricas normalizado, con ausencia explícita

Todas las herramientas producen su propio formato y ninguno cubre todas las métricas: istanbul da cuatro porcentajes, `go tool cover` da uno solo, coverage.py da ramas solo si se lo pide. Normalizar en el momento de la recolección, y no en el de la comparación, hace que la comparación sea trivial y que una baseline siga siendo comparable si el repositorio cambia de herramienta.

Las métricas que el lenguaje no reporta se emiten como ausentes y no como cero. Es la diferencia entre "Go no mide ramas" y "la cobertura de ramas cayó a cero": lo segundo bloquearía todos los repos Go en su segunda ejecución.

Los formatos de entrada soportados son los que las herramientas ya emiten sin plugins adicionales: resumen de istanbul y lcov para Node, `go tool cover -func` y `go test -json` para Go, el JSON de coverage.py y JUnit XML para Python, y JUnit XML o el archivo de métricas ya normalizado para el modo Makefile. JUnit XML es el denominador común para contar tests porque pytest lo emite de fábrica y vitest tiene un reporter nativo.

El conteo de tests se hace contando elementos de caso de prueba y no leyendo los atributos de totales del reporte, porque los reporters no coinciden en si un test omitido suma al total.

### La baseline es el artefacto del último run verde de la rama base

La alternativa obvia es un servicio externo de cobertura. Se descarta: agrega una cuenta, un token por repo y una dependencia de terceros para un dato que la propia ejecución ya produce, y solo cubre cobertura, no el conteo de tests ni las supresiones.

La baseline se resuelve consultando la última ejecución exitosa del mismo workflow sobre la rama base y descargando su artefacto de métricas. Si no hay ninguna, o si el artefacto expiró, la comparación informa y no bloquea: un umbral fijo inventado sobre la cobertura de hoy sería un número arbitrario, y es exactamente el razonamiento que ya está anotado en el `ci.yml` de `giftlist`.

Esto implica que la rama base tiene que haber corrido el pipeline al menos una vez para que la puerta empiece a morder. Es el comportamiento correcto para un repo que recién adopta el componente.

### Las supresiones se cuentan sobre el árbol, no sobre el diff

Contar supresiones en el diff del pull request sería más preciso en cuanto a autoría, pero no es comparable contra una baseline ni detecta el caso en que una rama agrega dos supresiones y quita una. Contar el total del árbol y compararlo contra el total de la baseline responde exactamente la pregunta que importa: si el repositorio, en conjunto, está silenciando más verificaciones que antes.

El conteo excluye directorios de dependencias, artefactos de build y reportes. Es un conteo por expresiones regulares sobre archivos de código: no pretende ser un parser, y no necesita serlo para detectar una tendencia.

### La tolerancia por defecto del ratchet es cero

El script actual de `giftlist` usa medio punto porcentual de tolerancia. Para el uso principal de estos repos —código escrito por un agente— esa tolerancia es justo el margen en el que cabe una regresión real sin que nadie la note. La tolerancia por defecto pasa a cero y queda configurable por repositorio para los casos donde la cobertura tenga ruido propio.

El conteo de tests y el de supresiones no tienen tolerancia: son números enteros y exactos.

### El override es una etiqueta en el pull request, no una entrada del workflow

Un refactor legítimo puede borrar tests o consolidarlos, y el ratchet lo bloquearía con razón. Hace falta una salida, pero no una que el propio agente pueda accionar: si el override fuera una entrada del workflow o una línea en el mensaje de commit, formaría parte de lo que el agente edita para poner el CI en verde, que es precisamente lo que el ratchet viene a impedir.

El override es una etiqueta aplicada al pull request. Ponerla requiere una acción deliberada sobre el pull request, queda en su historial con autor y fecha, y el reporte de métricas deja constancia de qué regresión se aceptó. Cuando está presente, el ratchet informa la regresión y no bloquea.

### La imagen se construye dos veces: una para verificar, otra para publicar

La verificación necesita ejecutar el contenedor, y un resultado multi-plataforma no puede cargarse en el demonio Docker del runner: el almacén de imágenes clásico que usan los runners no tiene forma de representar una lista de manifiestos. Por eso se construye primero solo amd64 con carga local, se corre la prueba de humo, y recién después se construye el conjunto completo para publicar.

Con la caché compartida entre ambas construcciones, la segunda reaprovecha casi todo el trabajo de la primera en la arquitectura nativa; lo que se paga de verdad es la compilación emulada de arm64, que es inevitable. En pull requests la segunda construcción no ocurre, así que el costo de emulación se paga una vez por push y no una vez por commit.

### Los tags de imagen se derivan con reglas explícitas para la serie cero y los prereleases

El comportamiento por defecto del generador de metadatos publicaría un tag `0` para las versiones `0.x`. Ese tag agruparía versiones que SemVer define como mutuamente incompatibles, y es una trampa concreta para estos repos, que están casi todos en la serie cero. La regla de la versión mayor sola se condiciona a que la versión no empiece en cero.

Los prereleases no mueven `latest` ni los tags de mayor y menor: un `alpha` existe para poder probarse sin que nadie lo reciba sin pedirlo.

### El modelo de ramas se declara y no se infiere

Inferir el modelo por la existencia de una rama `develop` es tentador y está mal: la rama puede existir por herencia de otra época, o estar por crearse, y en ambos casos el componente elegiría un comportamiento distinto del esperado sin que nadie lo haya pedido. La entrada explícita hace que el modelo sea parte de la configuración revisable del repositorio y no un efecto secundario del estado de sus ramas.

Los nombres de rama son configurables porque el patrón de ramas de trabajo es lo que más varía entre repos, pero los valores por defecto cubren el caso de todos los repos actuales.

Una rama que no encaja en ningún rol del modelo corre las verificaciones y no publica nada. Es el comportamiento correcto para una rama experimental: se quiere saber si rompe algo, no que deje tags ni imágenes atrás.

### El identificador de prerelease lleva el nombre de la rama

Un contador global `alpha.N` por versión base convierte cada par de ramas concurrentes en una carrera: dos pushes simultáneos leen el mismo máximo y piden el mismo número, y aun sin colisión el tag no dice de qué rama salió.

Incluir un componente derivado del nombre de la rama le da a cada una su propio contador. `0.2.0-alpha.login-oauth.1` es SemVer válido — los identificadores de prerelease son segmentos separados por puntos de alfanuméricos y guiones — y es válido como tag de imagen. La precedencia entre `alpha`, `rc` y estable sigue siendo la correcta porque la comparación es segmento a segmento y el primero ya decide.

El nombre de la rama se sanitiza: se le quita el prefijo del patrón, se reemplaza todo lo que no sea alfanumérico o guión, y se colapsan los separadores repetidos. Una rama `feature/login-oauth` y una `feature-login-oauth` producen el mismo identificador, que es lo deseable.

La versión base sale de la próxima versión que correspondería según los conventional commits acumulados desde el último tag estable. Eso hace que un prerelease anuncie la versión que va a ser, no la que fue.

Los pushes sucesivos de una misma rama se serializan con un grupo de concurrencia por rama, de modo que el cálculo del contador no se ejecute dos veces en paralelo sobre el mismo estado.

### El re-tag por digest se acota a la promoción desde la rama de integración

Promover un digest es correcto solo cuando el contenido que representa es el mismo que el de la rama de destino. Eso vale de la rama de integración a la estable, donde la promoción es la misma línea de trabajo avanzando. No vale desde una rama de trabajo: la rama de integración incorpora varias, y el digest de una no contiene a las demás, así que promoverlo publicaría como versión estable un código que nunca existió en esa forma.

En el modelo simple, la rama principal cumple el rol de integración y por eso construye. Es la contrapartida de no tener rama intermedia, no una limitación del mecanismo.

La promoción se hace componiendo una nueva lista de manifiestos sobre los mismos blobs, que es una operación de registro y no una construcción: no baja ni sube capas, y por eso no vuelve a pagar la emulación de arm64. Antes de promover se verifica que el digest exista; si no está, la ejecución falla en vez de reconstruir en silencio, porque una reconstrucción silenciosa rompería justamente la garantía que la promoción existe para dar.

### La versión efectiva de una imagen vive en su tag, no horneada en su manifiesto

La promoción por digest tiene una consecuencia que hay que aceptar explícitamente: release-please agrega el changelog y el bump del manifiesto en el commit que corta la versión, así que el árbol de la rama estable no es idéntico al de la rama de integración de la que sale el digest. La imagen promovida lleva adentro el manifiesto con la versión anterior.

La salida no es reconstruir —eso anularía la promoción— sino dejar de tratar el manifiesto horneado como fuente de la versión. La versión efectiva de una imagen es su tag y su etiqueta OCI de versión; una aplicación que necesite mostrar su propia versión la lee de una variable de entorno inyectada al desplegarla, no de su manifiesto. Es coherente con la decisión de que el tag de git sea la fuente de verdad, que ya está tomada más arriba por otras razones.

La verificación de esto es directa: la prueba de humo del componente comprueba que la versión que la imagen reporta coincide con su tag y no con su manifiesto.

### La baseline del ratchet es la rama de destino

Medir siempre contra la rama estable sería incorrecto en el modelo completo: una rama de trabajo que integra en `develop` tiene que compararse contra `develop`, que es donde va a caer, y no contra `main`, que puede estar varias versiones atrás. Si se comparara contra `main`, todo el trabajo acumulado en `develop` aparecería como mejora en cada rama de trabajo y la puerta dejaría de morder.

En un pull request la rama de destino es un dato del evento. En un push directo se deriva del rol de la rama dentro del modelo declarado.

### La documentación del flujo se genera en cada repositorio y su verificación la controla

Un README envejece sin que nadie lo note porque nada falla cuando queda desactualizado. Con cuatro repositorios consumidores, una plantilla copiada a mano garantiza que en algún momento tres de ellos describan un flujo que ya no es el suyo — y quien más va a sufrir esa mentira es un agente, que no tiene forma de sospecharla.

Por eso el flujo de cada repositorio se documenta en un bloque delimitado por marcadores, generado a partir de la configuración real de su pipeline, y la verificación de ese repositorio falla si el bloque no corresponde a esa configuración. Es el mismo razonamiento del ratchet aplicado a la documentación: no alcanza con pedirla, hay que medir que siga siendo cierta.

La generación es idempotente y solo toca lo que está entre los marcadores, así que convive con el contenido propio de cada archivo. Si los marcadores no están, se agregan sin alterar nada de lo existente.

El bloque se instala en tres lugares con la misma información y distinta voz: el README explica el flujo a una persona que llega al repositorio, y los documentos de agente lo prescriben, diciendo qué corresponde hacer y qué no. Que salgan del mismo generador es lo que impide que se contradigan.

Un punto es deliberadamente explícito en la versión para agentes: la etiqueta de override del ratchet es una decisión humana. Un agente que se encuentra bloqueado por la puerta tiene que arreglar lo que la disparó o explicar por qué corresponde la excepción, nunca aplicarla por su cuenta. Esa frontera pierde sentido si solo vive en la cabeza de quien diseñó el componente.

### El modo sin efectos suprime en el borde, no saltea etapas

Un modo de prueba que toma caminos distintos de los del modo real prueba el modo de prueba. Para que ejercitar el componente sirva de algo, la ejecución sin efectos tiene que recorrer exactamente las mismas etapas y tomar exactamente las mismas decisiones: qué tags correspondería publicar, qué digest correspondería promover, qué diría el comentario de métricas.

Lo único que cambia es el último paso de cada efecto, que en lugar de ejecutarse reporta lo que habría hecho. El cálculo de los tags no se saltea: se calcula y se imprime. La imagen se construye y se verifica; lo que no ocurre es el push. Así, un error en la derivación de tags o en la resolución del digest aparece en el modo sin efectos igual que aparecería en producción.

La comparación de métricas se ejecuta completa y se informa, pero no bloquea. El modo existe para observar el pipeline, no para juzgar el repositorio sobre el que se lo está ejercitando, y un bloqueo ahí solo escondería el resto del reporte.

El modo es una entrada pública y no un mecanismo interno del componente: sirve igual para ensayar la adopción en un repositorio antes de publicar nada desde él.

### La versión la propone release-please y la confirma un merge

Conventional commits dan el incremento, y release-please mantiene un pull request de release vivo que se actualiza con cada commit a la rama principal. El tag se crea al mergearlo, y es ese tag el que dispara la publicación de imágenes.

El tipo de release varía por lenguaje —el de Node sincroniza el manifiesto del paquete, y para Go, Ansible o un proyecto sin archivo de versión se usa el tipo simple con un archivo de versión plano— pero el tag resultante es idéntico en todos, que es lo que hace que la regla valga para todos los repos por igual.

### El propio componente se versiona igual y mantiene un tag mayor móvil

El componente usa su propio pipeline en todo lo que le aplica. Además, cada versión estable reapunta el tag de su serie mayor, para que los consumidores puedan fijar `@v1` y recibir correcciones sin tocar nada. Los prereleases no lo mueven.

Fijar `@v1` en lugar de un hash es una decisión consciente: el componente y los repos que lo consumen pertenecen a la misma cuenta, así que la razón habitual para fijar un hash —protegerse de que un tercero reescriba un tag— no aplica, y el costo de tener que abrir un pull request en cada repo por cada corrección del pipeline sí.

Las acciones de terceros que el componente usa se fijan por tag mayor, que es la práctica establecida en los repos actuales del usuario.

### Los scripts se escriben en Node sin dependencias

Node está preinstalado en todos los runners de GitHub, así que un script en Node corre igual en un repositorio Go o Python sin instalar nada. Escribirlos sin dependencias externas evita tener que instalar paquetes antes de poder evaluar la calidad, y mantiene el tiempo del paso en segundos.

Para consultar la ejecución previa y comentar el pull request se usa el CLI de GitHub, también preinstalado, en lugar de una librería cliente.

### El componente se verifica contra proyectos de prueba dentro de su propio repositorio

Un componente de CI que solo se prueba usándolo rompe repos ajenos para encontrar sus errores. El repositorio incluye proyectos mínimos por lenguaje y un workflow propio que los ejecuta a través del componente en modo sin efectos, además de la validación sintáctica de los workflows. Los scripts de métricas, ratchet y generación de documentación se prueban de forma directa contra reportes de ejemplo de cada formato, incluyendo los casos de métrica ausente, baseline faltante y regresión.

La matriz de esa verificación no es un caso por lenguaje sino la combinación de lenguaje, rol de rama y modelo: es lo que hace que agregar un camino nuevo al componente obligue a cubrirlo antes de que quede disponible para los consumidores, en lugar de descubrirlo cuando un repositorio ajeno lo ejercita por primera vez.

## Risks / Trade-offs

- **La construcción emulada de arm64 alarga cada push** → Se construye una sola arquitectura en los pull requests, la caché se comparte entre construcciones y las plataformas son configurables, de modo que un repo que no corre en Raspberry Pi puede limitarse a amd64.
- **Los artefactos de las ejecuciones expiran y la baseline desaparece** → La ausencia de baseline informa y no bloquea, nunca falla. El efecto de una baseline perdida es una ejecución sin puerta, no una ejecución rota; la siguiente ejecución de la rama base la restablece.
- **Una tolerancia cero puede volverse ruidosa si la cobertura del repo es inestable** → La tolerancia es configurable por repositorio, y el conteo de tests, que es exacto, sigue actuando como la señal fuerte.
- **La puerta puede bloquear un refactor legítimo** → La etiqueta de override permite seguir adelante dejando registro de la excepción y de qué regresión se aceptó.
- **Un pull request desde un fork no tiene permisos de escritura ni acceso a los secretos** → El reporte se publica igual en el resumen de la ejecución y la falta de comentario no altera el resultado; la publicación de imágenes ya está restringida a los eventos de push.
- **Las entradas del componente son API pública y un renombre rompe a todos los consumidores** → Cambios incompatibles solo en una serie mayor nueva; la serie anterior sigue funcionando para quien la tenga fijada.
- **El conteo de supresiones por expresiones regulares puede contar de más o de menos** → Lo que importa es la variación contra la baseline, no el valor absoluto, y un falso positivo se resuelve con la etiqueta de override.
- **Un único workflow condicionado por lenguaje crece hasta volverse difícil de leer** → Si llega a ese punto, la salida no es partirlo por lenguaje sino extraer bloques completos a acciones compuestas dentro del mismo repositorio, que sí se referencian por ruta relativa sin el problema de resolución de los workflows anidados.
- **Los tags de prerelease se acumulan: una rama de trabajo con veinte pushes deja veinte tags** → Los tags llevan el nombre de la rama, así que son fáciles de identificar y borrar en lote cuando la rama se cierra; la documentación incluye esa limpieza como paso del cierre de una rama. Borrarlos no afecta a las imágenes ya publicadas.
- **Crear tags desde el pipeline puede disparar otras ejecuciones y, en el peor caso, realimentarse** → La creación usa el token de la ejecución, que por diseño no dispara nuevos workflows; la publicación de la imagen del prerelease ocurre en la misma ejecución que crea el tag y no como reacción a él.
- **La imagen promovida lleva el manifiesto con la versión previa al bump** → La versión efectiva es el tag y la etiqueta OCI, la aplicación la recibe por entorno al desplegarse, y la prueba de humo del componente verifica que sea así.
- **Un repositorio puede declarar el modelo completo y no tener la rama de integración** → La ejecución falla con un mensaje que nombra la rama faltante, en lugar de degradarse silenciosamente al modelo simple y publicar una versión estable desde una rama de trabajo.
- **La documentación de flujo de un repositorio puede quedar desactualizada respecto del comportamiento real** → El bloque se genera desde la configuración del pipeline y la verificación del repositorio falla si no corresponde, así que una divergencia rompe el CI en vez de pasar inadvertida.
- **El generador del bloque puede pisar contenido si alguien rompe o duplica los marcadores** → La generación exige encontrar exactamente un par de marcadores bien formado; ante cualquier otra cosa no escribe y explica qué encontró, de modo que el caso dudoso lo resuelva una persona y no una heurística.
- **El modo sin efectos puede divergir del comportamiento real y dejar de probar lo que importa** → La supresión ocurre en el último paso de cada efecto y nunca saltea el cálculo previo; la verificación del componente ejercita los mismos caminos en ambos modos sobre los proyectos de prueba, donde publicar sí es inofensivo.
- **Un repositorio podría dejar el modo sin efectos activo y creer que está publicando** → El modo está desactivado por defecto, el resumen de cada ejecución dice en su encabezado que está activo, y la lista de efectos suprimidos aparece siempre, incluso cuando no hay ninguno.

## Migration Plan

1. Publicar el componente con su propia verificación en verde y cortar `v0.1.0`, creando el tag de serie mayor correspondiente.
2. Adoptarlo primero en `duplexalmar`, que hoy no tiene CI, con el modelo simple: si algo falla, no se pierde nada que existiera antes, y ejercita el camino Node completo incluyendo pruebas de extremo a extremo.
3. Adoptarlo en un servicio en Go que publica varios binarios desde un mismo Dockerfile, que ejercita el camino de Go, la matriz de targets y el pasaje de un umbral fijo de cobertura al ratchet.
4. Migrar `giftlist` último y con el modelo completo, comparando la salida del componente contra la de su pipeline actual antes de borrarlo: es el repositorio con más para perder, el que sirve de control, y el único que ejercita la promoción por digest de punta a punta.
5. `omni` y el resto quedan fuera de esta secuencia, como adopciones independientes.

La vuelta atrás en cualquier paso es restaurar el workflow anterior del repositorio, que sigue en su historial de git; el componente no deja estado en el repositorio consumidor más allá de los artefactos de sus ejecuciones.

## Open Questions

- Si conviene que el ratchet también compare el tamaño de la imagen publicada. Es una métrica útil contra la deriva de los Dockerfiles y encaja en el mismo mecanismo, pero necesita una baseline de una imagen ya publicada y no de la ejecución, así que puede agregarse después sin tocar el resto.
- Cuánta retención darles a los artefactos de métricas. El valor por defecto alcanza para el ritmo actual de estos repos; si una rama base queda mucho tiempo sin corridas, conviene subirlo.
