## Purpose

Hace que el componente sea operable sin supervisión, documentando en cada repositorio que lo adopta cuál es su flujo concreto — qué modelo de ramas usa, en qué rama trabajar, contra qué rama abrir un pull request, qué produce cada push y cómo cortar un paquete — y dejando explícito dónde termina la autonomía de un agente, para que la puerta de calidad no se convierta en un obstáculo a sortear.

## ADDED Requirements

### Requirement: Documentación de flujo presente en cada repositorio

El componente SHALL incluir documentación operativa en su propio repositorio, y SHALL instalar en cada repositorio consumidor la documentación de su flujo concreto, tanto en el archivo que describe el repositorio a las personas como en los que dirigen a los agentes.

La documentación instalada SHALL describir la configuración concreta de ese repositorio —su modelo de ramas, los nombres de sus ramas, su lenguaje y su imagen— y no solamente las opciones disponibles.

La documentación dirigida a personas SHALL explicar el flujo, y la dirigida a agentes SHALL prescribir qué corresponde hacer y qué no; ambas SHALL describir el mismo flujo, sin contradecirse.

Cuando el entorno de agentes de un repositorio requiera más de un nombre de archivo, el componente SHALL proveer el mismo contenido bajo cada uno de ellos, sin divergencias.

#### Scenario: Repositorio que adopta el componente

- **WHEN** se instala el componente en un repositorio
- **THEN** el repositorio queda con la descripción de su flujo tanto en su documento de presentación como en sus documentos de agente, con su modelo de ramas, su lenguaje y su imagen concretos

#### Scenario: Varios nombres de archivo requeridos

- **WHEN** un repositorio necesita el documento de agente bajo más de un nombre de archivo
- **THEN** todos los nombres contienen el mismo contenido y ninguno queda desactualizado respecto de otro

#### Scenario: Dos audiencias, un mismo flujo

- **WHEN** se compara lo que la documentación para personas dice del flujo con lo que dicen los documentos de agente
- **THEN** ambas describen el mismo modelo de ramas y las mismas transiciones, y ninguna afirma algo que la otra contradiga

### Requirement: Flujo de trabajo de pull requests documentado

La documentación instalada en un repositorio consumidor SHALL permitir determinar, sin consultar a una persona y sin salir del repositorio, cómo se trabaja en él: desde qué rama se parte para una funcionalidad nueva, contra qué rama se abre el pull request, qué verificaciones van a correr sobre él y cuáles de ellas bloquean la integración.

La documentación SHALL indicar qué produce la integración del pull request en cada rama de destino del modelo.

La documentación SHALL indicar qué hacer cuando una verificación bloquea el pull request, enlazando el motivo del bloqueo con la acción que corresponde.

#### Scenario: Se empieza una funcionalidad nueva

- **WHEN** alguien va a empezar una funcionalidad en un repositorio que adoptó el componente
- **THEN** la documentación del repositorio le indica de qué rama partir, cómo nombrar la suya y contra qué rama abrir el pull request

#### Scenario: Se abre un pull request

- **WHEN** se abre un pull request en ese repositorio
- **THEN** la documentación permite anticipar qué verificaciones van a correr y cuáles impiden la integración si fallan

#### Scenario: Se integra un pull request

- **WHEN** se integra un pull request en cada una de las ramas de destino del modelo
- **THEN** la documentación describe qué versión y qué imágenes produce cada una de esas integraciones

#### Scenario: Una verificación bloquea el pull request

- **WHEN** una verificación bloquea la integración
- **THEN** la documentación del repositorio permite identificar el motivo y la acción que corresponde, sin necesidad de consultar la documentación del componente

### Requirement: Bloque generado y verificable

La documentación de flujo instalada en un repositorio consumidor SHALL delimitarse con marcadores que la identifiquen como generada a partir de la configuración de ese repositorio.

El componente SHALL proveer una forma de regenerar ese bloque a partir de la configuración vigente, que SHALL ser idempotente y SHALL preservar intacto todo el contenido del archivo que quede fuera de los marcadores.

Si el archivo todavía no contiene los marcadores, la regeneración SHALL agregarlos sin alterar el contenido existente.

La verificación del repositorio consumidor SHALL fallar cuando el bloque no corresponda a la configuración vigente del pipeline, de modo que un cambio de flujo no pueda quedar sin reflejarse en la documentación.

#### Scenario: Regeneración sin cambios

- **WHEN** se regenera el bloque de un repositorio cuya configuración no cambió
- **THEN** ningún archivo resulta modificado

#### Scenario: Contenido propio del repositorio

- **WHEN** se regenera el bloque de un archivo que contiene además texto propio del repositorio
- **THEN** ese texto queda intacto y solo cambia lo que está entre los marcadores

#### Scenario: Archivo sin marcadores

- **WHEN** se regenera el bloque en un archivo que todavía no los tiene
- **THEN** los marcadores y el bloque se agregan, y el contenido previo del archivo se conserva

#### Scenario: Cambio de configuración sin actualizar la documentación

- **WHEN** un repositorio cambia su modelo de ramas y no regenera el bloque
- **THEN** su propia verificación falla e indica que la documentación no corresponde a la configuración vigente

### Requirement: Elección del modelo de ramas sin consultar

La documentación SHALL permitir que un agente determine qué modelo de ramas corresponde a un repositorio a partir de características observables de ese repositorio, sin necesidad de consultar a una persona.

La documentación SHALL indicar qué hacer cuando el repositorio ya declaró un modelo, cuando no declaró ninguno, y cuando las características observadas sugieren un modelo distinto del declarado.

En este último caso, la documentación SHALL indicar que el modelo declarado prevalece y que la discrepancia se plantea, sin cambiarlo por iniciativa propia.

#### Scenario: Repositorio sin modelo declarado

- **WHEN** un agente evalúa un repositorio que todavía no declaró su modelo de ramas
- **THEN** la documentación le permite elegir uno a partir de características del repositorio y justificar la elección

#### Scenario: Repositorio con modelo ya declarado

- **WHEN** un agente trabaja sobre un repositorio que ya declaró su modelo
- **THEN** la documentación le indica usar el modelo declarado sin reevaluarlo

#### Scenario: Discrepancia entre lo declarado y lo observado

- **WHEN** el modelo declarado no coincide con lo que las características del repositorio sugerirían
- **THEN** la documentación indica respetar lo declarado y plantear la discrepancia, no modificar la declaración

### Requirement: Determinación de la rama de trabajo

La documentación SHALL permitir que un agente determine, para cada modelo de ramas, en qué rama debe trabajar y cómo nombrarla, incluyendo el patrón que el nombre tiene que respetar para que el pipeline lo reconozca.

La documentación SHALL indicar qué rama es el destino de la integración en cada modelo.

La documentación SHALL indicar qué ocurre si se trabaja en una rama que no respeta el patrón, para que un nombre mal elegido no se descubra recién al no obtener artefactos.

#### Scenario: Agente que empieza una tarea

- **WHEN** un agente va a empezar a trabajar en un repositorio que usa el componente
- **THEN** la documentación le permite determinar el nombre de su rama y hacia dónde va a integrarla

#### Scenario: Nombre de rama fuera del patrón

- **WHEN** un agente considera un nombre de rama que no coincide con el patrón configurado
- **THEN** la documentación le indica que esa rama correrá las verificaciones y no producirá versión ni imagen

### Requirement: Anticipación de lo que produce un push

La documentación SHALL permitir que un agente anticipe, antes de hacer push, qué tag de versión y qué tags de imagen va a producir ese push, para cada rol de rama del modelo.

La documentación SHALL indicar en qué casos un push no produce ninguna versión ni imagen.

La documentación SHALL indicar cómo se cierra una rama de trabajo, incluyendo qué hacer con los tags de prerelease que dejó.

#### Scenario: Push a una rama de trabajo

- **WHEN** un agente va a hacer push a su rama de trabajo
- **THEN** la documentación le permite anticipar el tag de prerelease y los tags de imagen que se van a crear

#### Scenario: Push que no produce artefactos

- **WHEN** un agente va a hacer push a una rama sin rol en el modelo
- **THEN** la documentación le indica que no se creará ninguna versión ni imagen

#### Scenario: Cierre de una rama de trabajo

- **WHEN** una rama de trabajo se integra y deja de usarse
- **THEN** la documentación indica qué hacer con los tags de prerelease acumulados y aclara que borrarlos no afecta a las imágenes ya publicadas

### Requirement: Corte de paquetes a pedido

La documentación SHALL permitir que un agente, cuando se le pide un paquete, determine de qué tipo de paquete se trata y qué acción concreta lo produce, distinguiendo al menos el prerelease de una rama de trabajo, el candidato de la rama de integración y la versión estable.

La documentación SHALL indicar, para cada tipo, cuál es la precondición que tiene que cumplirse antes de cortarlo.

La documentación SHALL indicar cómo se verifica que el paquete quedó publicado, de modo que el agente pueda confirmar el resultado en lugar de suponerlo.

Cuando el pedido sea ambiguo respecto del tipo de paquete, la documentación SHALL indicar cuál es el que corresponde asumir y qué preguntar si esa asunción no es segura.

#### Scenario: Pedido de un paquete de prueba

- **WHEN** se le pide a un agente un paquete para probar el trabajo en curso
- **THEN** la documentación le permite identificar que corresponde el prerelease de su rama de trabajo y qué acción lo produce

#### Scenario: Pedido de una versión estable

- **WHEN** se le pide a un agente cortar una versión estable
- **THEN** la documentación le permite identificar la acción que la produce y la precondición que tiene que cumplirse antes

#### Scenario: Verificación del paquete cortado

- **WHEN** un agente termina de cortar un paquete
- **THEN** la documentación le permite verificar que el tag y la imagen quedaron efectivamente publicados

#### Scenario: Pedido ambiguo

- **WHEN** el pedido no deja claro qué tipo de paquete se espera
- **THEN** la documentación indica qué asumir por defecto y en qué caso corresponde preguntar antes de actuar

### Requirement: La puerta de calidad como límite de la autonomía

La documentación SHALL establecer explícitamente que la puerta de calidad no es un obstáculo a sortear, y SHALL enumerar, para cada motivo de bloqueo, qué corresponde hacer para resolverlo.

La documentación SHALL establecer que la etiqueta de override es una decisión humana, y que ante un bloqueo un agente debe corregir la causa o explicar por qué correspondería la excepción, sin aplicarla por su cuenta.

La documentación SHALL enumerar explícitamente las acciones que no corresponden ante un bloqueo, incluyendo borrar o marcar como omitidos los tests que fallan, agregar supresiones de linter y bajar los umbrales configurados.

#### Scenario: Agente bloqueado por caída de cobertura

- **WHEN** la puerta bloquea a un agente por una caída de cobertura
- **THEN** la documentación le indica agregar los tests que faltan, y no bajar el umbral ni aplicar la etiqueta de override

#### Scenario: Agente bloqueado por pérdida de tests

- **WHEN** la puerta bloquea a un agente porque la rama ejecuta menos tests que la baseline
- **THEN** la documentación le indica restituir la cobertura de casos perdida o explicar por qué la pérdida es deliberada, dejando la decisión sobre la excepción a una persona

#### Scenario: Agente que considera una supresión de linter

- **WHEN** un agente considera agregar una directiva que desactiva una regla del linter para destrabar el pipeline
- **THEN** la documentación le indica que eso va a bloquear la ejecución y cuál es la alternativa

### Requirement: La documentación se mantiene junto al comportamiento

La documentación para agentes SHALL enumerar de forma explícita las preguntas que tiene que poder responder, de modo que pueda verificarse si sigue haciéndolo.

Cuando el componente cambie un comportamiento que la documentación describe, la verificación del propio componente SHALL señalarlo, para que la documentación no quede describiendo un comportamiento que ya no existe.

#### Scenario: Cambio de comportamiento del componente

- **WHEN** el componente cambia lo que produce un push a una rama de trabajo
- **THEN** la verificación del componente señala que la documentación para agentes describe un comportamiento que ya no corresponde

#### Scenario: Revisión de la documentación

- **WHEN** alguien quiere comprobar si la documentación para agentes sigue siendo suficiente
- **THEN** la propia documentación enumera las preguntas que tiene que responder y permite verificarlas una por una
