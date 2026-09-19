## Purpose

Define el modelo de ramas de un repositorio y una única regla de versionado que vale igual para proyectos Node, Go, Python o Ansible, tomando el tag de git como fuente de verdad, y deriva de ella tanto el changelog como los tags de las imágenes publicadas, para que en todos los repositorios del usuario la versión signifique exactamente lo mismo y cada rama produzca un artefacto identificable.

## ADDED Requirements

### Requirement: Modelo de ramas declarado por el repositorio

El componente SHALL soportar dos modelos de ramas y SHALL requerir que el repositorio consumidor declare cuál usa, sin inferirlo de la estructura del repositorio:

- Un modelo simple, con una rama estable y ramas de trabajo que se integran directamente en ella.
- Un modelo completo, con una rama estable, una rama de integración intermedia y ramas de trabajo que se integran en la intermedia.

El nombre de la rama estable, el de la rama de integración y el patrón que identifica a las ramas de trabajo SHALL ser configurables, con valores por defecto `main`, `develop` y `feature-*`.

Si el repositorio declara el modelo completo sin que exista la rama de integración, el componente SHALL fallar con un mensaje que indique qué rama falta.

Si una ejecución corresponde a una rama que no es la estable, ni la de integración, ni coincide con el patrón de ramas de trabajo, el componente SHALL ejecutar las verificaciones y SHALL no producir ninguna versión ni publicar ninguna imagen.

#### Scenario: Repositorio con modelo simple

- **WHEN** un repositorio declara el modelo simple y se hace push a una rama de trabajo
- **THEN** la rama produce un prerelease y su integración en la rama estable produce la versión estable, sin que exista ninguna rama intermedia

#### Scenario: Repositorio con modelo completo

- **WHEN** un repositorio declara el modelo completo
- **THEN** las ramas de trabajo producen prereleases, la rama de integración produce candidatos y la rama estable produce la versión estable

#### Scenario: Nombres de rama propios

- **WHEN** un repositorio declara nombres de rama distintos de los valores por defecto
- **THEN** el componente aplica las mismas reglas sobre las ramas declaradas

#### Scenario: Modelo completo sin rama de integración

- **WHEN** un repositorio declara el modelo completo pero la rama de integración no existe
- **THEN** la ejecución falla e informa qué rama hace falta crear

#### Scenario: Rama fuera del modelo

- **WHEN** se hace push a una rama que no encaja en ninguno de los roles del modelo declarado
- **THEN** se ejecutan las verificaciones y no se crea ningún tag ni se publica ninguna imagen

### Requirement: Prerelease automático por rama de trabajo

En cada push a una rama de trabajo, el componente SHALL crear un tag de prerelease y SHALL publicar la imagen correspondiente a esa versión.

El identificador de prerelease SHALL incluir un componente derivado del nombre de la rama, de modo que cada rama de trabajo lleve su propio contador y dos ramas vivas simultáneamente no compitan por el mismo número.

El nombre de la rama SHALL sanitizarse para producir un identificador válido tanto en SemVer como en un tag de imagen.

La versión base del prerelease SHALL ser la próxima versión que correspondería según los conventional commits acumulados desde el último tag estable; el contador SHALL derivarse del mayor tag existente que coincida con esa versión base y ese identificador de rama.

En el modelo completo, cada push a la rama de integración SHALL crear un tag candidato con identificador `rc` y su propio contador sobre la misma versión base.

Ningún prerelease SHALL mover los tags de versión estable de la imagen.

#### Scenario: Primer push de una rama de trabajo

- **WHEN** se hace push a `feature-login-oauth` y la próxima versión calculada es `0.2.0`
- **THEN** se crea el tag `v0.2.0-alpha.login-oauth.1` y se publica la imagen `0.2.0-alpha.login-oauth.1`

#### Scenario: Pushes sucesivos de la misma rama

- **WHEN** se hace un segundo push a `feature-login-oauth`
- **THEN** se crea el tag `v0.2.0-alpha.login-oauth.2`, y el contador de cualquier otra rama de trabajo no se ve afectado

#### Scenario: Dos ramas de trabajo en paralelo

- **WHEN** existen `feature-login-oauth` y `feature-cache-redis` y se hace push a ambas
- **THEN** cada una produce su propia serie de tags, sin colisión ni dependencia entre sus contadores

#### Scenario: Nombre de rama con caracteres no admitidos

- **WHEN** se hace push a una rama cuyo nombre contiene caracteres que no son válidos en un identificador de SemVer o en un tag de imagen
- **THEN** el identificador se sanitiza y el tag resultante es válido en ambos formatos

#### Scenario: Candidato en la rama de integración

- **WHEN** en el modelo completo se integra trabajo en la rama de integración y la próxima versión calculada es `0.2.0`
- **THEN** se crea el tag `v0.2.0-rc.1` y se publica la imagen correspondiente

#### Scenario: Precedencia entre las tres etapas

- **WHEN** existen los tags `v0.2.0-alpha.login-oauth.3`, `v0.2.0-rc.1` y `v0.2.0`
- **THEN** su orden de precedencia según SemVer coincide con la dirección de promoción entre las ramas

#### Scenario: Un prerelease no altera la versión estable publicada

- **WHEN** se publica cualquier prerelease
- **THEN** los tags de versión estable de la imagen siguen apuntando a la última versión estable

### Requirement: El tag de git es la fuente de verdad de la versión

La versión de un repositorio SHALL estar determinada por el tag de git, con el formato `vMAJOR.MINOR.PATCH` opcionalmente seguido de un identificador de prerelease, siguiendo SemVer 2.0.

El archivo de versión propio del lenguaje, cuando exista, SHALL mantenerse sincronizado con el tag, pero SHALL no ser la fuente de verdad: dos repositorios de lenguajes distintos con el mismo tag SHALL considerarse en la misma versión.

Un tag que no cumpla el formato SHALL no disparar una publicación de versión.

#### Scenario: Proyecto sin archivo de versión

- **WHEN** un proyecto Go o de Ansible, que no tiene un archivo de versión nativo, recibe el tag `v1.2.0`
- **THEN** su versión es `1.2.0` y el pipeline publica exactamente los mismos tags de imagen que publicaría un proyecto Node con ese mismo tag

#### Scenario: Proyecto con archivo de versión

- **WHEN** se corta la versión `v1.2.0` de un proyecto Node
- **THEN** el archivo de manifiesto del proyecto queda con la versión `1.2.0` y coincide con el tag

#### Scenario: Tag que no es de versión

- **WHEN** se crea un tag que no sigue el formato de versión
- **THEN** no se dispara ninguna publicación de versión

### Requirement: Derivación de los tags de imagen

El componente SHALL derivar los tags de la imagen publicada a partir del evento que disparó la ejecución, según las siguientes reglas:

- Un tag de versión estable SHALL publicar la versión completa, la combinación mayor y menor, y `latest`.
- Un tag de versión estable con mayor distinto de cero SHALL publicar además el tag de la versión mayor sola.
- Un tag de versión estable con mayor igual a cero SHALL NO publicar el tag de la versión mayor sola, porque un tag `0` agruparía versiones mutuamente incompatibles.
- Un tag de prerelease SHALL publicar únicamente la versión completa, y SHALL NO mover `latest` ni los tags de mayor o menor.
- Un tag candidato de la rama de integración SHALL publicar únicamente la versión completa, y SHALL NO mover `latest` ni los tags de mayor o menor.
- Un push a una rama de trabajo SHALL publicar, además de su versión de prerelease, un tag derivado del nombre sanitizado de la rama, que SHALL reapuntarse en cada push de esa rama.
- Un push a la rama principal SHALL publicar el nombre de la rama.
- Toda publicación SHALL incluir, además, un tag derivado del hash corto del commit.

#### Scenario: Versión estable posterior a 1.0

- **WHEN** se publica el tag `v1.4.2`
- **THEN** se publican las imágenes `1.4.2`, `1.4`, `1`, `latest` y el tag del commit

#### Scenario: Versión estable en la serie cero

- **WHEN** se publica el tag `v0.1.2`
- **THEN** se publican las imágenes `0.1.2`, `0.1`, `latest` y el tag del commit, y no se publica ninguna imagen con el tag `0`

#### Scenario: Prerelease

- **WHEN** se publica el tag `v0.1.2-alpha.1`
- **THEN** se publican únicamente la imagen `0.1.2-alpha.1` y el tag del commit, y `latest` sigue apuntando a la última versión estable

#### Scenario: Candidato de la rama de integración

- **WHEN** se publica el tag `v0.2.0-rc.1`
- **THEN** se publican únicamente la imagen `0.2.0-rc.1` y el tag del commit, y `latest` sigue apuntando a la última versión estable

#### Scenario: Tag móvil de una rama de trabajo

- **WHEN** se hace push dos veces a `feature-login-oauth`
- **THEN** existe un tag de imagen con el nombre de la rama que apunta a la construcción más reciente, además de los dos tags de prerelease inmutables

#### Scenario: Push a la rama principal

- **WHEN** se hace push a la rama principal sin crear un tag
- **THEN** se publican la imagen con el nombre de la rama y el tag del commit, y no se toca `latest`

#### Scenario: Trazabilidad de una imagen

- **WHEN** alguien tiene una imagen publicada por el pipeline
- **THEN** existe un tag de esa imagen que identifica el commit exacto con el que se construyó

### Requirement: Versión derivada de conventional commits

El componente SHALL derivar el incremento de versión a partir de los mensajes de commit incorporados a la rama principal desde la última versión, siguiendo Conventional Commits.

Un commit de corrección SHALL producir un incremento de parche; un commit de funcionalidad SHALL producir un incremento menor; un commit marcado como incompatible SHALL producir un incremento mayor.

Mientras la versión mayor sea cero, un commit marcado como incompatible SHALL producir un incremento menor en lugar de mayor.

Los commits que no siguen el formato SHALL no impedir el cálculo de la versión, y SHALL no aparecer en el changelog.

#### Scenario: Solo correcciones

- **WHEN** desde la última versión `1.2.0` se incorporaron únicamente commits de corrección
- **THEN** la versión propuesta es `1.2.1`

#### Scenario: Nueva funcionalidad

- **WHEN** desde la última versión `1.2.0` se incorporó al menos un commit de funcionalidad y ningún cambio incompatible
- **THEN** la versión propuesta es `1.3.0`

#### Scenario: Cambio incompatible después de 1.0

- **WHEN** desde la última versión `1.2.0` se incorporó un commit marcado como incompatible
- **THEN** la versión propuesta es `2.0.0`

#### Scenario: Cambio incompatible en la serie cero

- **WHEN** desde la última versión `0.3.1` se incorporó un commit marcado como incompatible
- **THEN** la versión propuesta es `0.4.0`

### Requirement: Changelog generado automáticamente

El componente SHALL mantener en el repositorio un archivo de changelog, agrupado por versión y por tipo de cambio, con los encabezados en español.

El changelog SHALL incluir los cambios de funcionalidad, las correcciones y los cambios de comportamiento, y SHALL destacar los cambios incompatibles.

El changelog SHALL actualizarse en el mismo cambio que crea la versión, de modo que el contenido del tag y el del changelog nunca difieran.

#### Scenario: Se corta una versión

- **WHEN** se crea una nueva versión a partir de commits de funcionalidad y de corrección
- **THEN** el changelog gana una sección para esa versión con los cambios agrupados y con los encabezados en español

#### Scenario: Cambio incompatible

- **WHEN** la versión incluye un cambio marcado como incompatible
- **THEN** el changelog lo destaca de forma diferenciada del resto de los cambios

### Requirement: Publicación de versión revisable antes de ocurrir

El componente SHALL proponer cada nueva versión como un cambio revisable que indique la versión calculada y el contenido del changelog, antes de crear el tag.

El tag y la publicación de las imágenes SHALL producirse únicamente cuando esa propuesta se acepta.

Una propuesta pendiente SHALL actualizarse al incorporarse nuevos commits a la rama principal, en lugar de acumular varias propuestas simultáneas.

#### Scenario: Se acumulan cambios sin publicar

- **WHEN** se incorporan varios commits a la rama principal sin aceptar la propuesta de versión
- **THEN** existe una única propuesta pendiente, que refleja la versión y el changelog correspondientes a todos esos commits

#### Scenario: Se acepta la propuesta

- **WHEN** se acepta la propuesta de versión
- **THEN** se crea el tag correspondiente, se publica la release con las notas del changelog y se disparan las publicaciones de imágenes asociadas a ese tag

#### Scenario: No hay cambios que ameriten versión

- **WHEN** desde la última versión solo se incorporaron commits que no corresponden a ningún tipo versionable
- **THEN** no se propone ninguna versión nueva

### Requirement: Tag mayor móvil del propio componente

El componente SHALL mantener un tag que apunte siempre a la última versión estable de su serie mayor, para que los repositorios consumidores puedan fijar esa serie y recibir correcciones sin cambiar su configuración.

Ese tag SHALL actualizarse únicamente con versiones estables, y SHALL no moverse con prereleases.

Un cambio incompatible en las entradas del componente SHALL publicarse como una nueva serie mayor, de modo que los repositorios que fijaron la serie anterior no se vean afectados.

#### Scenario: Se publica una corrección del componente

- **WHEN** se publica la versión estable `1.3.1` del componente
- **THEN** el tag de la serie mayor pasa a apuntar a ella y los repositorios que la fijaron reciben la corrección sin modificar su configuración

#### Scenario: Se publica un prerelease del componente

- **WHEN** se publica una versión de prerelease del componente
- **THEN** el tag de la serie mayor no se mueve

#### Scenario: Cambio incompatible en las entradas

- **WHEN** el componente cambia sus entradas de forma incompatible
- **THEN** se publica una nueva serie mayor y los repositorios que fijaron la serie anterior siguen ejecutando la versión previa
