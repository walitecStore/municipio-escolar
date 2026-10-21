# ELECCIONES DEL MUNICIPIO ESCOLAR

Plataforma web para realizar elecciones digitales en una institución educativa del Perú.
Proyecto desarrollado con Codex Web y GitHub. La portada institucional está en `/`
y la gestión conectada en `/sistema`. El responsable confirmó Supabase y Vercel
configurados y el cambio de contraseña operativo. Esta rama prepara la gestión
institucional y requiere la migración adicional 005; no habilita votaciones.

## Institución

**I.E. ESTEBAN PAVLETICH TRUJILLO**, Educación Secundaria. Año electoral inicial: 2026. Meta: 230 estudiantes. Grados 1.º–5.º, cada uno con secciones A, B y C.
Configuración central en `src/lib/institution.ts`.

## Demostración conservada y backend de gestión

| Componente          | Recorrido de demostración                                                                                                           | Backend preparado y probado                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Inicio y acceso     | Portada adaptable y acceso ilustrativo en español                                                                                   | Auth real, MFA y recuperación en `/sistema`                                 |
| Listas y candidatos | Crear/editar/eliminar listas, alcalde y regidores, cargos, grados, secciones, símbolos, fotos referenciales y propuestas en memoria | Tablas, restricciones y RPC administrativas                                 |
| Padrón              | Excel ficticio de 230 registros, vista previa, validación, filtros, correcciones y conteos                                          | Reemplazo atómico, códigos únicos y acceso administrativo                   |
| Credenciales        | Entrega individual ficticia, recuperación, ocultación y bloqueo por participación                                                   | Tokens aleatorios, hash, caducidad, versiones y confirmación supervisada    |
| Votación            | Selección, revisión previa, confirmación y blanco; no envía votos                                                                   | Una participación, transacción atómica, bloqueos y resolución de reintentos |
| Resultados          | Cierre simulado, gráficos, mayor votación/empates y PDF/Excel de demostración                                                       | RPC de agregados accesible solo a administradores después del cierre        |
| Seguridad           | Solo datos ficticios, sin persistencia de información personal                                                                      | RLS, esquemas privados, Storage privado y auditoría sin preferencias        |

Los cambios de demostración se comparten entre páginas y se pierden al recargar.
El padrón público solo admite códigos `DEMO-NNN` y nombres `Estudiante ficticio NNN`.
Las credenciales ficticias no autentican ni emiten votos oficiales. Los resultados
son ejemplos independientes de la selección local. Las exportaciones dicen
**DEMOSTRACIÓN — SIN VALIDEZ OFICIAL** y no son actas firmadas.

## Tecnologías

Next.js App Router, TypeScript, Tailwind CSS, ESLint, ExcelJS, pdf-lib y Sharp.
Backend SQL compatible con Supabase; PostgreSQL 17 en Docker para pruebas de
concurrencia y PGlite para regresión local. El SDK de Supabase opera en el servidor
con las variables y sesiones autorizadas de cada instalación.

## Instalación y ejecución

Requisitos: Node.js 24 y npm 11 (versiones utilizadas). Desde el repositorio:

```bash
npm ci --cache .npm-cache
npm run dev
```

Puerto 3000. La demostración no necesita credenciales ni variables. `.env.example`
contiene la configuración deshabilitada, sin credenciales; nunca guardar claves
secretas en variables `NEXT_PUBLIC_`.

Para producción local:

```bash
npm run build
npm run start
```

## Verificaciones

```bash
npm run lint
npm run type-check
npm run test:unit
npm run test:postgres
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:smoke
```

`type-check` puede necesitar `npm run build` en una copia nueva para generar los
archivos de tipos de Next.js. `test:postgres` requiere Docker y crea/elimina su
propio PostgreSQL 17 desechable con puerto aleatorio limitado a loopback. Ejecuta
las tres migraciones con sustitutos de Auth/Storage, identidades ficticias y
conexiones PostgreSQL independientes. No utiliza ni admite una URL remota.

Las pruebas de navegador inician y detienen un servidor de producción en 3100.
Si no hay Chromium del sistema, instalar el navegador local de Playwright:

```bash
npm run test:install
npm run test:smoke
```

La descarga depende de la política de red. Los scripts usan sintaxis POSIX.
No se guardan Excel, PDF ni datos de estudiantes en Git; las pruebas los generan
en memoria y las carpetas de resultados están ignoradas.

## Migraciones y operación

El orden completo está en [supabase/README.md](supabase/README.md):

1. `202610190001_electoral_security.sql`.
2. `202610190002_complete_electoral_system.sql`.
3. `202610190003_private_electoral_media.sql`.
4. `202610190004_secure_application_sessions.sql`.
5. `202610210005_institutional_drafts.sql`, nueva y pendiente de revisión manual.

El responsable confirmó instaladas 001–004: **no repetirlas**. Codex no ejecutó
SQL en Supabase alojado. Aplicar solo 005 después de revisar la guía de gestión
institucional. No ejecutar los fixtures de prueba en ese servicio. Conservar Auth,
MFA administrativo, sesiones de servidor y registro controlado de administradores.
Mantener `electoral_private` y `ballot_box` fuera de los esquemas expuestos de la
Data API. La aplicación usa RPC administrativas; no exponer tablas privadas para
solucionar errores de integración.

`src/lib/electoral/backend.ts` recibe un transporte RPC ligado a una sesión ya
verificada: no conecta servicios ni verifica JWT por sí mismo. La gestión web
conectada verifica la sesión en `src/lib/connected` y utiliza ese transporte.
Antes de abrir una elección siguen siendo necesarias la entrega supervisada,
validación HTTP de Storage y RLS alojados, revisión de logs y límites, respaldos
y autorización del comité.

## Rutas

Institucional: `/`. Gestión: `/sistema`, `/sistema/preparacion`, `/sistema/nueva`
y los módulos autorizados de cada elección. Demostración: `/demostracion`,
`/estudiantes`, `/administracion`, `/padron`, `/candidatos`, `/votacion` y `/resultados`. La apertura/cierre simulados se realizan en Administración; el
padrón y las candidaturas se bloquean al abrir, y los resultados se habilitan al
cerrar. PostgreSQL aplica sus controles de forma independiente de la interfaz.

## Privacidad y límites del secreto electoral

Consultar [docs/SEGURIDAD-ELECTORAL.md](docs/SEGURIDAD-ELECTORAL.md). Separar identidad
y papeleta no proporciona anonimato criptográfico frente al operador, WAL, logs o
infraestructura. Ningún token, selección asociada a identidad, Excel real o dato
personal de menores debe registrarse en GitHub, URLs, analítica o logs.

Las fotografías referenciales de adultos de `public/candidatos` proceden de
`team-1.jpg`, `team-2.jpg` y `team-3.jpg` de
[Soft UI Dashboard de Creative Tim](https://github.com/creativetimofficial/soft-ui-dashboard/tree/main/assets/img).
Se conserva la licencia de origen en `public/candidatos/LICENCIA-FUENTE.txt`.
No representan estudiantes del colegio ni implican su respaldo. Las fotografías
reales deberán sanearse en el servidor, contar con autorización y permanecer en
el bucket privado preparado por la migración 003.

## Integración con Supabase y preparación institucional

La ruta `/sistema` utiliza el SDK oficial en el servidor para Auth, sesiones
HttpOnly, MFA TOTP de administrador/comité, RPC de padrón/listas/credenciales/voto,
recuento tras cierre y Storage privado. La demostración original se conserva.

La plantilla de variables mantiene conexión y emisión apagadas por defecto.
Las pruebas locales no usan credenciales reales ni ejecutan SQL en Supabase alojado. La guía completa de configuración manual,
variables, creación controlada de cuentas y validación está en
[docs/ACTIVACION-SUPABASE.md](docs/ACTIVACION-SUPABASE.md).

La secuencia completa es **001 → 002 → 003 → 004 → 005**; ejecutar únicamente las pendientes. La migración 004 añade roles de
personal, contexto de sesión, MFA AAL2 para administración y aprobación de
seguridad para elecciones oficiales. No basta con aplicar solo las tres primeras.

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:connected
```

Esta suite ejecuta Next.js y el SDK con un servicio HTTP local de prueba, sin
credenciales reales. La validación final contra Auth y Storage alojados sigue
pendiente de la configuración y autorización manual.

Cambio de contraseña del personal en `/sistema/perfil` y recuperación en
`/sistema/restablecer`: [configuración exacta de Auth y pruebas](docs/RECUPERACION-CONTRASENA.md).

Gestión conectada y preparación del borrador institucional: [guía de gestión institucional](docs/GESTION-INSTITUCIONAL.md). La migración adicional 005 requiere revisión y ejecución manual; no abre la votación.

### Votación presencial mediante DNI

La modalidad supervisada para varias computadoras se prepara con la migración 006, conservando las elecciones existentes y sin abrir la votación. Importa una hoja Excel con `dni,nombre,grado,seccion` (DNI como texto de ocho dígitos). Consulta [la guía de mesas, privacidad, activación manual y acta PDF](docs/VOTACION-PRESENCIAL-DNI.md). No ejecutes esta migración en producción sin revisión y ensayo previo. El nuevo indicador `ELECTORAL_SUPERVISED_DNI_ENABLED` permanece en `false` en `.env.example`.

### Plataforma multiinstitución y aplicación instalable

La interfaz de producción utiliza datos institucionales y oculta las demostraciones. Los encargados tienen acceso a un colegio mediante asignaciones verificadas por PostgreSQL. El operador incorpora colegios desde **Mi institución y equipo**; cada encargado configura su perfil y prepara elecciones con su propio total de electores. La portada incluye instalación PWA para celular/computadora con conexión a internet.

Revisa [configuración, migraciones 007–008, incorporación de colegios y alcance académico](docs/PLATAFORMA-MULTIINSTITUCION.md). Las migraciones no se ejecutan automáticamente ni habilitan elecciones oficiales. Conserva los datos y las migraciones 001–006 ya aplicadas. Agrega `npm run test:operational` a la validación, ejecutándolo después de `test:connected`.

### Interfaz y navegación

Diseño adaptable a PC, tableta y celular, tarjetas por tarea, controles para volver y una sección propia de actas. Consulta [la guía y las capturas de la interfaz](docs/INTERFAZ-RESPONSIVE.md). Esta actualización visual no requiere nuevas migraciones ni abre la votación.
