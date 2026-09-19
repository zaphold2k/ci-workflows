## Purpose

Permite ejecutar el pipeline completo sin que produzca ningún efecto fuera de su propia ejecución, reportando lo que habría publicado, taggeado o comentado, para que agregarle funcionalidad al componente o ensayar su adopción en un repositorio pueda verificarse de punta a punta sin publicar imágenes, crear tags ni escribir en pull requests ajenos.

## ADDED Requirements

### Requirement: Modo de ejecución sin efectos externos

El componente SHALL aceptar una entrada que active un modo de ejecución sin efectos, y SHALL exponerla tanto para su propia verificación como para los repositorios consumidores.

En ese modo, el componente SHALL ejecutar todas las etapas que solo leen o producen resultados dentro de la ejecución —instalación, lint, typecheck, tests, cobertura, recolección de métricas, construcción de la imagen y prueba de humo— exactamente igual que en una ejecución normal.

En ese modo, el componente SHALL NO publicar imágenes en ningún registro, SHALL NO crear ni mover tags de git, SHALL NO promover digests, SHALL NO crear ni actualizar releases ni pull requests de release, y SHALL NO escribir comentarios en ningún pull request.

El modo SHALL estar desactivado por defecto.

#### Scenario: Ejecución completa sin publicar

- **WHEN** se ejecuta el pipeline con el modo sin efectos activo sobre un repositorio cuyo pipeline normalmente publicaría una imagen
- **THEN** la imagen se construye y se verifica, y el registro no recibe ninguna imagen nueva

#### Scenario: No se crean tags

- **WHEN** se ejecuta con el modo activo sobre una rama de trabajo que normalmente crearía un tag de prerelease
- **THEN** no se crea ningún tag y el repositorio queda con los mismos tags que antes de la ejecución

#### Scenario: No se escribe en el pull request

- **WHEN** se ejecuta con el modo activo sobre un pull request
- **THEN** el pull request no recibe ningún comentario nuevo ni se modifica ninguno existente

#### Scenario: Las verificaciones se ejecutan de verdad

- **WHEN** se ejecuta con el modo activo sobre un repositorio cuyos tests fallan
- **THEN** la ejecución falla por los tests, igual que lo haría sin el modo activo

#### Scenario: Desactivado por defecto

- **WHEN** un repositorio invoca el componente sin declarar esta entrada
- **THEN** el pipeline se comporta de forma normal y produce todos sus efectos

### Requirement: Reporte de los efectos suprimidos

En el modo sin efectos, el componente SHALL informar en el resumen de la ejecución cada efecto que habría producido, con el detalle suficiente para verificarlo: los tags de imagen y el registro de destino, los tags de git que habría creado, el digest que habría promovido y el contenido del comentario que habría publicado.

El reporte SHALL distinguir de forma inequívoca entre lo que se ejecutó y lo que se reportó sin ejecutar.

El componente SHALL producir este reporte aunque alguna etapa de verificación haya fallado, de modo que un fallo temprano no oculte lo que el resto de la ejecución habría hecho.

#### Scenario: Reporte de la publicación suprimida

- **WHEN** se ejecuta con el modo activo sobre un push que normalmente publicaría
- **THEN** el resumen enumera el nombre completo de cada imagen y cada tag que se habría publicado

#### Scenario: Reporte de la promoción suprimida

- **WHEN** se ejecuta con el modo activo sobre un corte de versión que normalmente promovería un digest
- **THEN** el resumen indica qué digest se habría promovido y con qué tags

#### Scenario: Reporte del comentario suprimido

- **WHEN** se ejecuta con el modo activo sobre un pull request
- **THEN** el resumen incluye el contenido del comentario de métricas que se habría publicado

#### Scenario: Reporte tras un fallo

- **WHEN** una etapa de verificación falla durante una ejecución con el modo activo
- **THEN** el resumen igualmente informa los efectos que el resto de la ejecución habría producido

### Requirement: La puerta de calidad informa sin bloquear

En el modo sin efectos, el componente SHALL ejecutar la comparación de métricas completa y SHALL informar su resultado, incluidas las regresiones detectadas.

El resultado de esa comparación SHALL NO hacer fallar la ejecución en este modo, porque el propósito del modo es observar el comportamiento del pipeline y no juzgar el trabajo del repositorio.

El reporte SHALL indicar explícitamente si la comparación habría bloqueado la ejecución en un modo normal.

#### Scenario: Regresión detectada en modo sin efectos

- **WHEN** se ejecuta con el modo activo sobre una rama cuya cobertura bajó respecto de la baseline
- **THEN** el resumen informa la regresión e indica que habría bloqueado, y la ejecución no falla por ese motivo

#### Scenario: Sin regresión

- **WHEN** se ejecuta con el modo activo sobre una rama que no empeora ninguna métrica
- **THEN** el resumen informa la comparación e indica que no habría bloqueado

### Requirement: Cobertura de los pasos del componente

El componente SHALL poder ejercitar, en modo sin efectos, cada uno de los roles de rama y cada uno de los eventos que soporta, de modo que un cambio en el componente pueda verificarse contra todos sus caminos antes de publicarse.

La verificación del propio componente SHALL cubrir, como mínimo, un camino por lenguaje soportado, un camino por rol de rama de cada modelo, el camino de promoción por digest y el camino de una rama sin rol en el modelo.

Cuando el componente incorpore un camino nuevo, su verificación SHALL cubrirlo antes de que ese camino quede disponible para los repositorios consumidores.

#### Scenario: Se agrega una funcionalidad al componente

- **WHEN** el componente incorpora un paso o una entrada nueva
- **THEN** existe una ejecución en modo sin efectos que lo ejercita, y la verificación del componente falla si ese camino no está cubierto

#### Scenario: Cobertura de los roles de rama

- **WHEN** se ejecuta la verificación del componente
- **THEN** se ejercita cada rol de rama de ambos modelos, incluida la rama sin rol, y cada lenguaje soportado

#### Scenario: Verificación de un cambio antes de publicarlo

- **WHEN** alguien modifica el componente en una rama
- **THEN** puede ejercitar el pipeline completo contra los proyectos de prueba sin publicar ninguna imagen ni crear ningún tag
