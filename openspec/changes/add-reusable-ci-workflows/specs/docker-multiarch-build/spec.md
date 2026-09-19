## Purpose

Construye y publica una sola imagen que funciona tanto en los servidores x86 como en las Raspberry Pi del usuario, reemplazando los Dockerfiles duplicados por arquitectura y los scripts de build manuales por un paso del pipeline que verifica la imagen antes de publicarla.

## ADDED Requirements

### Requirement: Imagen multi-arquitectura publicada bajo un único nombre

El componente SHALL construir la imagen para `linux/amd64` y `linux/arm64` y SHALL publicarlas bajo un único nombre de imagen, de modo que un cliente que haga pull obtenga automáticamente la variante correspondiente a su arquitectura.

El conjunto de plataformas SHALL ser configurable por el repositorio consumidor.

El componente SHALL publicar por defecto en el registro de contenedores de GitHub, bajo un nombre derivado del repositorio consumidor, y SHALL permitir sobreescribir el nombre de la imagen.

#### Scenario: Pull desde una máquina x86

- **WHEN** un cliente en `linux/amd64` hace pull del nombre de imagen publicado
- **THEN** recibe la variante `amd64` sin necesidad de indicar la arquitectura

#### Scenario: Pull desde una Raspberry Pi

- **WHEN** un cliente en `linux/arm64` hace pull del mismo nombre de imagen
- **THEN** recibe la variante `arm64` sin necesidad de indicar la arquitectura

#### Scenario: Plataformas restringidas

- **WHEN** un repositorio declara únicamente `linux/amd64` como plataforma
- **THEN** solo se construye y publica esa variante, y la ejecución no falla por la ausencia de `arm64`

### Requirement: Verificación antes de publicar

El componente SHALL construir y verificar la imagen antes de publicarla, y SHALL no publicar ninguna imagen si la verificación falla.

El componente SHALL permitir que un repositorio declare una prueba de humo consistente en levantar el contenedor y esperar a que un endpoint responda correctamente dentro de un tiempo límite, con variables de entorno y puerto configurables.

Si el contenedor no responde dentro del límite, el componente SHALL hacer fallar la ejecución y SHALL incluir los logs del contenedor en la salida.

Si el repositorio no declara una prueba de humo, el componente SHALL verificar únicamente que la imagen se construya.

#### Scenario: La imagen arranca y responde

- **WHEN** un repositorio declara una prueba de humo y el contenedor responde correctamente al endpoint declarado dentro del tiempo límite
- **THEN** la verificación pasa y el pipeline continúa hacia la publicación

#### Scenario: La imagen construye pero no arranca

- **WHEN** la imagen se construye correctamente pero el contenedor no responde dentro del tiempo límite
- **THEN** la ejecución falla, se imprimen los logs del contenedor y no se publica ninguna imagen

#### Scenario: Repositorio sin prueba de humo

- **WHEN** un repositorio no declara una prueba de humo
- **THEN** la verificación consiste solo en que la imagen se construya, y la ejecución continúa

### Requirement: Publicación condicionada al evento y a la rama

El componente SHALL construir la imagen en los pull requests sin publicarla en ningún registro.

El componente SHALL publicar la imagen en los eventos de push sobre cualquier rama que tenga un rol en el modelo declarado por el repositorio, y SHALL no publicar nada en las ramas que quedan fuera del modelo.

El componente SHALL permitir que un repositorio desactive por completo la publicación.

#### Scenario: Pull request

- **WHEN** el pipeline se ejecuta a partir de un pull request
- **THEN** la imagen se construye y se verifica, pero no se publica en el registro

#### Scenario: Push a una rama de trabajo

- **WHEN** el pipeline se ejecuta a partir de un push a una rama que coincide con el patrón de ramas de trabajo
- **THEN** la imagen se construye para todas las plataformas declaradas y se publica con la versión de prerelease de esa rama

#### Scenario: Push a la rama principal

- **WHEN** el pipeline se ejecuta a partir de un push a la rama principal
- **THEN** se publica la imagen con los tags de versión estable, ya sea construyéndola o promoviendo un digest previo según el modelo declarado

#### Scenario: Push a una rama fuera del modelo

- **WHEN** el pipeline se ejecuta a partir de un push a una rama que no tiene rol en el modelo declarado
- **THEN** la imagen se construye y se verifica, y no se publica

#### Scenario: Publicación desactivada

- **WHEN** un repositorio declara que no quiere publicar imágenes
- **THEN** la imagen se construye y se verifica en todos los eventos, y nunca se publica

### Requirement: Promoción de una imagen ya verificada

En el modelo completo de ramas, el componente SHALL publicar la versión estable agregando los tags de release al mismo digest que ya fue construido y publicado desde la rama de integración, sin reconstruir la imagen.

El componente SHALL verificar que ese digest exista en el registro antes de promoverlo, y SHALL fallar con un mensaje explícito si no lo encuentra, en lugar de reconstruir de forma silenciosa.

El componente SHALL promover el digest de todas las plataformas publicadas, de modo que la imagen promovida siga sirviendo cada arquitectura.

El componente SHALL NO promover un digest construido desde una rama de trabajo: una rama de integración incorpora varias ramas de trabajo y su contenido no coincide con el de ninguna de ellas.

En el modelo simple de ramas, la versión estable SHALL construirse, porque no existe una construcción previa que corresponda al contenido de la rama principal.

#### Scenario: Promoción de un candidato a versión estable

- **WHEN** en el modelo completo se corta la versión estable a partir de trabajo que ya pasó por la rama de integración
- **THEN** los tags de versión estable se agregan al mismo digest que se publicó como candidato, y no se ejecuta ninguna construcción

#### Scenario: La imagen de producción es la que se probó

- **WHEN** se compara el digest de la imagen publicada como candidato con el de la imagen publicada como versión estable
- **THEN** ambos son el mismo digest

#### Scenario: El digest del candidato no existe

- **WHEN** se intenta promover y no se encuentra en el registro el digest correspondiente al candidato
- **THEN** la ejecución falla e informa qué digest buscaba, sin reconstruir la imagen

#### Scenario: Promoción multi-arquitectura

- **WHEN** se promueve un digest que fue publicado para varias plataformas
- **THEN** la imagen promovida sirve cada arquitectura igual que la original

#### Scenario: Modelo simple

- **WHEN** un repositorio con modelo simple corta una versión estable
- **THEN** la imagen se construye a partir del contenido de la rama principal

### Requirement: Múltiples imágenes desde un mismo Dockerfile

El componente SHALL permitir que un repositorio declare varios targets de construcción de un mismo Dockerfile, y SHALL producir una imagen publicable independiente por cada uno, con su propio nombre derivado del target.

Cada target SHALL construirse de forma independiente, de modo que el fallo de uno no impida detectar el fallo de otro en la misma ejecución.

#### Scenario: Repositorio con varios binarios

- **WHEN** un repositorio declara cuatro targets del mismo Dockerfile
- **THEN** se publican cuatro imágenes, una por target, cada una con el mismo juego de tags de versión

#### Scenario: Repositorio con un solo artefacto

- **WHEN** un repositorio no declara targets
- **THEN** se construye y publica una única imagen a partir del Dockerfile declarado

### Requirement: Reutilización de caché entre ejecuciones

El componente SHALL reutilizar capas de construcción entre ejecuciones sucesivas del pipeline, y la caché SHALL estar separada por target cuando el repositorio declara varios.

Un fallo al leer o escribir la caché SHALL no hacer fallar la ejecución.

#### Scenario: Segunda ejecución sin cambios en las dependencias

- **WHEN** se ejecuta el pipeline dos veces seguidas y solo cambió el código de la aplicación
- **THEN** la segunda ejecución reutiliza las capas de instalación de dependencias en lugar de reconstruirlas

#### Scenario: Caché no disponible

- **WHEN** la caché de construcción no puede leerse
- **THEN** la imagen se construye completa desde cero y la ejecución no falla por ese motivo

### Requirement: Autenticación con el registro

El componente SHALL autenticarse contra el registro de destino usando las credenciales del repositorio consumidor, y SHALL permitir declarar credenciales propias para registros distintos del de GitHub.

El componente SHALL no exponer las credenciales en la salida de la ejecución.

#### Scenario: Publicación en el registro de GitHub

- **WHEN** un repositorio publica en el registro de contenedores de GitHub sin declarar credenciales propias
- **THEN** la autenticación usa el token de la ejecución y la publicación funciona sin configuración adicional

#### Scenario: Publicación en otro registro

- **WHEN** un repositorio declara credenciales para un registro distinto
- **THEN** la autenticación usa esas credenciales y ningún valor secreto aparece en los logs
