# ELECCIONES DEL MUNICIPIO ESCOLAR

Plataforma web para realizar elecciones digitales en una institución educativa del Perú.
Proyecto desarrollado con Codex Web y GitHub. Estado: desarrollo y validación local,
sin conexión al proyecto Supabase real y sin despliegue en Vercel.

## Institución

**I.E. ESTEBAN PAVLETICH TRUJILLO**, Educación Secundaria. Año electoral inicial: 2026. Meta: 230 estudiantes. Grados 1.º–5.º, cada uno con secciones A, B y C.
Configuración central en `src/lib/institution.ts`.

## Componentes implementados

| Componente          | Web actual                                                                                                                          | Backend preparado y probado                                                 |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Inicio y acceso     | Portada adaptable y acceso ilustrativo en español                                                                                   | Auth real aún no conectado                                                  |
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
concurrencia y PGlite para regresión local. Supabase y Vercel no están conectados.

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

## Migraciones y conexión futura

El orden completo está en [supabase/README.md](supabase/README.md):

1. `202610190001_electoral_security.sql`.
2. `202610190002_complete_electoral_system.sql`.
3. `202610190003_private_electoral_media.sql`.
4. `202610190004_secure_application_sessions.sql`.

**No se han ejecutado en Supabase real.** No ejecutar los fixtures de pruebas en
ese servicio. Antes de conectar, autorizar un entorno de pruebas, configurar Auth,
MFA administrativo, sesiones de servidor y registro controlado de administradores.
Mantener `electoral_private` y `ballot_box` fuera de los esquemas expuestos de la
Data API. La aplicación usa RPC administrativas; no exponer tablas privadas para
solucionar errores de integración.

`src/lib/electoral/backend.ts` recibe un transporte RPC ligado a una sesión ya
verificada: no conecta servicios ni verifica JWT por sí mismo. La gestión web
actual sigue siendo ficticia. También faltan entrega individual real, validación
HTTP de las políticas de Storage, configuración de logs, límites de solicitudes,
respaldos y autorización del comité antes de una elección real.

## Rutas

`/`, `/estudiantes`, `/administracion`, `/padron`, `/candidatos`, `/votacion` y
`/resultados`. La apertura/cierre simulados se realizan en Administración; el
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

## Integración real con Supabase (preparada, sin activar el proyecto alojado)

La ruta `/sistema` utiliza el SDK oficial en el servidor para Auth, sesiones
HttpOnly, MFA TOTP de administrador/comité, RPC de padrón/listas/credenciales/voto,
recuento tras cierre y Storage privado. La demostración original se conserva.

La conexión y la emisión están apagadas por defecto. No se han usado credenciales
reales ni ejecutado SQL en Supabase. La guía completa de configuración manual,
variables, creación controlada de cuentas y validación está en
[docs/ACTIVACION-SUPABASE.md](docs/ACTIVACION-SUPABASE.md).

La secuencia actual es **001 → 002 → 003 → 004**. La migración 004 añade roles de
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
