## Purpose

Convierte el CI de un semáforo en una medida de dirección: compara cada rama contra el último estado verde conocido de la rama en la que se va a integrar y bloquea la que empeore el repositorio, de modo que ni una persona ni un agente de IA puedan poner el pipeline en verde borrando tests, marcándolos como omitidos o silenciando el linter.

## ADDED Requirements

### Requirement: Métricas normalizadas entre lenguajes

El componente SHALL producir, en cada ejecución, un conjunto único de métricas con el mismo formato para todos los lenguajes soportados, que SHALL incluir al menos: porcentaje de cobertura de líneas, sentencias, funciones y ramas; cantidad de tests que pasaron; cantidad de tests omitidos; y cantidad de supresiones de linter presentes en el código fuente.

Una métrica que el lenguaje o las herramientas del repositorio no reportan SHALL registrarse como ausente, y no como cero.

El componente SHALL publicar ese conjunto de métricas como artefacto de la ejecución, de modo que pueda servir de baseline a ejecuciones posteriores.

#### Scenario: Proyecto Go sin cobertura de ramas

- **WHEN** se recolectan las métricas de un proyecto Go, cuyo toolchain no reporta cobertura de ramas
- **THEN** la cobertura de ramas se registra como ausente y no como cero por ciento

#### Scenario: Métricas comparables entre herramientas

- **WHEN** un repositorio cambia la herramienta con la que ejecuta sus tests, pero la cantidad de tests y la cobertura reales no cambian
- **THEN** las métricas producidas son equivalentes a las de la ejecución anterior y la comparación no reporta ninguna regresión

### Requirement: Comparación contra la baseline de la rama de destino

El componente SHALL comparar las métricas de la ejecución actual contra las métricas de la última ejecución exitosa del mismo pipeline sobre la rama contra la que se está integrando el trabajo.

En un pull request, esa rama SHALL ser la rama de destino del pull request, de modo que el trabajo de una rama se mida contra aquello en lo que se va a integrar y no contra la rama estable cuando el modelo tiene una rama intermedia.

En un push directo, esa rama SHALL ser la rama de integración que corresponda al rol de la rama actual dentro del modelo declarado por el repositorio.

Si no existe baseline — porque es la primera ejecución, porque el artefacto expiró o porque la rama de destino nunca corrió el pipeline — el componente SHALL informar las métricas actuales sin bloquear la ejecución, e indicar explícitamente que no hubo comparación.

El componente SHALL ignorar en la comparación toda métrica ausente en cualquiera de los dos lados.

#### Scenario: Pull request hacia la rama de integración

- **WHEN** un pull request desde una rama de trabajo apunta a la rama de integración
- **THEN** la comparación usa como baseline la última ejecución exitosa de la rama de integración

#### Scenario: Pull request hacia la rama estable

- **WHEN** un pull request desde la rama de integración apunta a la rama estable
- **THEN** la comparación usa como baseline la última ejecución exitosa de la rama estable

#### Scenario: Primera ejecución del repositorio

- **WHEN** se ejecuta la comparación y no existe ninguna ejecución exitosa previa en la rama de destino
- **THEN** se informan las métricas actuales, se indica que no hay baseline y la ejecución no se bloquea

#### Scenario: Baseline expirada

- **WHEN** la última ejecución exitosa de la rama de destino existe pero su artefacto de métricas ya no está disponible
- **THEN** se informa que no se pudo recuperar la baseline y la ejecución no se bloquea

#### Scenario: Métrica ausente en la baseline

- **WHEN** la baseline no contiene una métrica que la ejecución actual sí reporta
- **THEN** esa métrica se informa sin comparar y no puede por sí sola bloquear la ejecución

### Requirement: Bloqueo por regresión de cobertura

El componente SHALL hacer fallar la ejecución cuando cualquier porcentaje de cobertura caiga respecto de la baseline más allá de una tolerancia configurable, expresada en puntos porcentuales.

La tolerancia por defecto SHALL ser cero, de modo que el comportamiento predeterminado sea estrictamente incremental.

#### Scenario: La cobertura baja

- **WHEN** la cobertura de líneas de la rama es menor que la de la baseline por más de la tolerancia configurada
- **THEN** la ejecución falla e informa la métrica, el valor de la baseline, el valor actual y la diferencia

#### Scenario: La cobertura sube

- **WHEN** todas las métricas de cobertura de la rama son iguales o mayores que las de la baseline
- **THEN** la ejecución pasa e informa las mejoras

#### Scenario: Caída dentro de la tolerancia

- **WHEN** un repositorio configura una tolerancia mayor que cero y la cobertura cae menos que esa tolerancia
- **THEN** la ejecución pasa e informa la caída sin bloquear

### Requirement: Bloqueo por pérdida de tests

El componente SHALL hacer fallar la ejecución cuando la cantidad de tests que pasan sea menor que la de la baseline.

El componente SHALL hacer fallar la ejecución cuando la cantidad de tests omitidos sea mayor que la de la baseline.

Estas dos reglas SHALL evaluarse aunque la cobertura no haya bajado, porque una rama puede borrar tests sin mover el porcentaje de cobertura.

#### Scenario: Se borran tests

- **WHEN** la rama ejecuta menos tests que la baseline
- **THEN** la ejecución falla e informa cuántos tests se perdieron

#### Scenario: Se marcan tests como omitidos

- **WHEN** la rama tiene más tests omitidos que la baseline
- **THEN** la ejecución falla e informa cuántos tests pasaron a estar omitidos

#### Scenario: Se borran tests sin que baje la cobertura

- **WHEN** la rama borra tests redundantes y la cobertura se mantiene idéntica
- **THEN** la ejecución igualmente falla por la caída en la cantidad de tests

#### Scenario: Se agregan tests

- **WHEN** la rama agrega tests y no omite ninguno
- **THEN** la ejecución pasa e informa el crecimiento de la suite

### Requirement: Bloqueo por aumento de supresiones de linter

El componente SHALL contar las supresiones de linter y de chequeo de tipos presentes en el código fuente del repositorio y SHALL hacer fallar la ejecución cuando ese total sea mayor que el de la baseline.

El conteo SHALL excluir los directorios de dependencias, de artefactos de build y de reportes de cobertura, de modo que refleje solo el código del repositorio.

#### Scenario: Se agrega una supresión

- **WHEN** la rama agrega una directiva que desactiva una regla del linter o un chequeo de tipos
- **THEN** la ejecución falla e informa cuántas supresiones se agregaron respecto de la baseline

#### Scenario: Se quitan supresiones

- **WHEN** la rama elimina supresiones existentes
- **THEN** la ejecución pasa e informa la mejora

#### Scenario: Supresión en una dependencia

- **WHEN** el árbol del repositorio contiene supresiones dentro de un directorio de dependencias instaladas
- **THEN** esas supresiones no se cuentan y no afectan el resultado

### Requirement: Reporte legible de la comparación

El componente SHALL publicar el resultado de la comparación en el resumen de la ejecución, con una tabla que muestre, por métrica, el valor de la baseline, el valor actual, la diferencia y si constituye una regresión.

Cuando la ejecución corresponda a un pull request, el componente SHALL publicar ese mismo resultado como comentario en el pull request, y SHALL actualizar el comentario existente en lugar de agregar uno nuevo en cada ejecución.

Si el componente no tiene permiso para comentar, SHALL continuar sin fallar por ese motivo.

#### Scenario: Comentario en un pull request

- **WHEN** la comparación termina sobre un pull request
- **THEN** el pull request muestra un único comentario con la tabla de métricas, actualizado con el resultado de la última ejecución

#### Scenario: Ejecuciones sucesivas del mismo pull request

- **WHEN** se ejecuta el pipeline varias veces sobre el mismo pull request
- **THEN** el pull request sigue teniendo un solo comentario de métricas, con los valores de la ejecución más reciente

#### Scenario: Sin permiso para comentar

- **WHEN** el pipeline no tiene permiso para escribir en el pull request
- **THEN** el resultado se publica igualmente en el resumen de la ejecución y la falta de comentario no altera el resultado de la comparación

### Requirement: Piso absoluto opcional

El componente SHALL permitir que un repositorio declare un porcentaje mínimo de cobertura, y SHALL hacer fallar la ejecución cuando la cobertura esté por debajo de ese mínimo, con independencia de la baseline.

Si el repositorio no declara un mínimo, esta verificación SHALL no aplicarse.

#### Scenario: Cobertura bajo el piso declarado

- **WHEN** un repositorio declara un mínimo de cobertura y la ejecución queda por debajo de él, aunque haya mejorado respecto de la baseline
- **THEN** la ejecución falla e informa el mínimo declarado y el valor alcanzado

#### Scenario: Sin piso declarado

- **WHEN** un repositorio no declara un mínimo de cobertura
- **THEN** solo se aplica la comparación contra la baseline
