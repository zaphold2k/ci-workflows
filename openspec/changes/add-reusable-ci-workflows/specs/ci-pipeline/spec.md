## Purpose

Da a cualquier repositorio un pipeline de verificación estándar — instalación del toolchain, lint, typecheck, tests y build — que se importa en lugar de escribirse, de modo que un repo nuevo tenga CI completo con unas pocas líneas y una mejora del pipeline llegue a todos los repos a la vez.

## ADDED Requirements

### Requirement: Invocación como workflow reutilizable

El componente SHALL exponerse como un workflow reutilizable invocable desde el repositorio de cualquier otro proyecto mediante una referencia versionada, sin que el repositorio consumidor necesite copiar los pasos del pipeline.

El repositorio consumidor SHALL poder fijar la referencia a un tag mayor móvil, a un tag exacto o a una rama.

#### Scenario: Un repositorio importa el pipeline

- **WHEN** un repositorio declara un job que invoca el workflow de CI con la referencia `@v1` y declara el lenguaje del proyecto
- **THEN** el pipeline completo se ejecuta contra ese repositorio sin que exista ningún paso de verificación escrito en él

#### Scenario: Una referencia inválida falla de forma explícita

- **WHEN** un repositorio invoca el workflow con una referencia que no existe
- **THEN** la ejecución falla antes de correr paso alguno e informa la referencia que no pudo resolverse

### Requirement: Soporte multi-lenguaje con un contrato único

El componente SHALL aceptar un lenguaje declarado entre `node`, `go`, `python` y `make`, y SHALL instalar el toolchain correspondiente antes de ejecutar cualquier verificación.

El componente SHALL exponer el mismo conjunto de entradas y producir el mismo conjunto de resultados observables para todos los lenguajes soportados, de manera que agregar un lenguaje no cambie la forma en que un repositorio invoca el pipeline.

Si el lenguaje declarado no es uno de los soportados, el componente SHALL fallar con un mensaje que enumere los valores aceptados.

#### Scenario: Proyecto Node

- **WHEN** un repositorio declara el lenguaje `node` y una versión del runtime
- **THEN** el pipeline instala esa versión, restaura la caché de dependencias, instala las dependencias y ejecuta lint, typecheck, tests y build

#### Scenario: Proyecto Go

- **WHEN** un repositorio declara el lenguaje `go` y una versión del runtime
- **THEN** el pipeline instala esa versión de Go, ejecuta el linter de Go y corre los tests con detección de carreras y con perfil de cobertura

#### Scenario: Proyecto Python

- **WHEN** un repositorio declara el lenguaje `python` y una versión del runtime
- **THEN** el pipeline instala esa versión, instala las dependencias declaradas por el proyecto y ejecuta lint y tests con medición de cobertura

#### Scenario: Proyecto sin lenguaje soportado

- **WHEN** un repositorio declara el lenguaje `make`
- **THEN** el pipeline delega cada etapa a un objetivo homónimo del Makefile del repositorio y no instala ningún toolchain por su cuenta

#### Scenario: Lenguaje desconocido

- **WHEN** un repositorio declara un lenguaje que el componente no soporta
- **THEN** la ejecución falla inmediatamente e informa cuáles son los lenguajes aceptados

### Requirement: Comandos sobreescribibles por repositorio

El componente SHALL usar comandos por defecto idiomáticos para el lenguaje declarado, y SHALL permitir que el repositorio consumidor reemplace individualmente el comando de instalación, de lint, de typecheck, de test y de build.

Un comando definido como cadena vacía SHALL omitir esa etapa sin hacer fallar la ejecución.

El componente SHALL permitir declarar un directorio de trabajo distinto de la raíz del repositorio, y todos los comandos SHALL ejecutarse en él.

#### Scenario: Un repositorio reemplaza un comando

- **WHEN** un repositorio declara un comando de test propio
- **THEN** el pipeline ejecuta ese comando en lugar del comando por defecto del lenguaje

#### Scenario: Un repositorio omite una etapa

- **WHEN** un repositorio declara el comando de typecheck como cadena vacía
- **THEN** el pipeline no ejecuta la etapa de typecheck y continúa con el resto sin marcar la ejecución como fallida

#### Scenario: Proyecto en un subdirectorio

- **WHEN** un repositorio declara un directorio de trabajo distinto de la raíz
- **THEN** todos los comandos se ejecutan en ese directorio y las rutas de los reportes se resuelven relativas a él

### Requirement: Fallo visible por etapa

Cuando una etapa de verificación falla, el componente SHALL marcar la ejecución como fallida y SHALL identificar en el resumen de la ejecución qué etapa falló.

El componente SHALL ejecutar las etapas de verificación independientes aunque una anterior haya fallado, de modo que una sola corrida informe todos los problemas en lugar del primero.

#### Scenario: Falla el lint pero los tests también tienen errores

- **WHEN** el lint falla y los tests también fallan en la misma corrida
- **THEN** la ejecución termina fallida e informa ambas etapas, en lugar de detenerse en el lint

#### Scenario: Todas las etapas pasan

- **WHEN** todas las etapas de verificación terminan sin error
- **THEN** la ejecución termina exitosa y publica el resumen de las verificaciones ejecutadas

### Requirement: Pruebas de extremo a extremo opcionales

El componente SHALL permitir que un repositorio declare un comando de pruebas de extremo a extremo, y SHALL ejecutarlo como una etapa separada de los tests unitarios.

Si el repositorio no declara ese comando, el componente SHALL omitir la etapa.

#### Scenario: Repositorio con pruebas de extremo a extremo

- **WHEN** un repositorio declara un comando de pruebas de extremo a extremo
- **THEN** el pipeline lo ejecuta en una etapa propia y su fallo hace fallar la ejecución

#### Scenario: Repositorio sin pruebas de extremo a extremo

- **WHEN** un repositorio no declara ese comando
- **THEN** el pipeline no ejecuta ninguna etapa de extremo a extremo
