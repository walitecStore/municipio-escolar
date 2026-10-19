# ELECCIONES DEL MUNICIPIO ESCOLAR

Plataforma web para realizar elecciones digitales en una institución educativa del Perú.

## Tecnologías

- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- Vercel

## Funcionalidades

- Administración de elecciones
- Padrón electoral de estudiantes
- Registro de listas y candidatos con fotografías
- Votación secreta
- Un voto por estudiante
- Resultados automáticos
- Reportes y actas electorales

## Desarrollo

Proyecto desarrollado con Codex Web y GitHub.

Estado: en desarrollo.

## Prototipo implementado

La versión actual es una **demostración educativa** con Next.js App Router,
TypeScript, Tailwind CSS y ESLint. Incluye una portada institucional en español,
acceso de estudiantes, panel administrativo, padrón con búsqueda, listas y
candidatos con propuestas, pantalla de selección y resultados ilustrativos.

Los nombres, la institución, las fechas y las cifras son ficticios. Las fotografías
son referencias visuales de personas ajenas al proyecto; no son candidatos reales
ni implican su respaldo. La demostración **no autentica, no envía ni guarda votos**.
La selección solo existe en la memoria de la página y se pierde al recargar.
Los resultados son datos estáticos y no cambian con la selección.

### Instalación

Requisitos: Node.js 24 y npm 11 (versiones utilizadas en la validación).
Desde la raíz del repositorio:

```bash
npm ci --cache .npm-cache
npm run dev
```

El servidor utiliza el puerto 3000. No se necesitan credenciales ni archivos de
variables para ejecutar esta demostración. La caché local está ignorada por Git.

### Verificaciones y producción local

```bash
npm run lint
npm run build
npm run start
```

Las pruebas de navegador verifican las siete rutas, imágenes, navegación móvil,
búsqueda, acceso ilustrativo y que la selección no se envíe ni persista:

```bash
# Instalar Chromium si todavía no está disponible en la máquina.
npm run test:install
npm run build
npm run test:smoke
```

Los scripts de prueba utilizan sintaxis de entorno POSIX (Linux/macOS) y guardan
el navegador en `node_modules`, sin modificar otros proyectos.
Si la máquina ya dispone de Chromium, se puede utilizar sin descargar otro navegador:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:smoke
```

El runner inicia y detiene un servidor de producción en el puerto 3100.
Los navegadores de Playwright son una herramienta de prueba, no un requisito
para ejecutar la aplicación.

### Rutas

| Ruta              | Contenido                                               |
| ----------------- | ------------------------------------------------------- |
| `/`               | Inicio institucional                                    |
| `/estudiantes`    | Acceso ilustrativo, sin autenticación                   |
| `/administracion` | Panel público de ejemplo, sin operaciones privilegiadas |
| `/padron`         | Estudiantes ficticios con búsqueda local                |
| `/candidatos`     | Listas, fotografías referenciales y propuestas          |
| `/votacion`       | Selección de demostración sin registro de votos         |
| `/resultados`     | Resultados estáticos ficticios                          |

### Estructura

- `src/app/`: páginas, layout y estilos adaptables.
- `src/components/`: navegación, tarjetas y formularios de demostración.
- `src/lib/demo.ts`: datos ficticios compartidos.
- `src/lib/supabase/README.md`: guía para la futura integración.
- `.env.example`: nombres de configuración futura, sin valores ni credenciales.
- `public/candidatos/`: fotografías de referencia disponibles localmente.
- `tests/demo.spec.ts`: pruebas de navegador.

### Supabase y despliegue: pendientes

No se ha instalado un cliente, conectado una base de datos ni configurado Vercel.
La integración futura requiere clientes separados para servidor y navegador,
autenticación, autorización, políticas RLS y validación del lado del servidor.
Un proceso electoral real necesita además un diseño auditado para secreto,
unicidad, integridad y recuento de votos. Esta interfaz no ofrece esas garantías.
Nunca publicar claves secretas o `service_role` en variables `NEXT_PUBLIC_`.

### Créditos de fotografías referenciales

Las imágenes `valeria.jpg`, `mateo.jpg` y `lucas.jpg` proceden de
`team-1.jpg`, `team-2.jpg` y `team-3.jpg` del proyecto
[Soft UI Dashboard de Creative Tim](https://github.com/creativetimofficial/soft-ui-dashboard/tree/main/assets/img).
Se conserva la licencia MIT del proyecto fuente en
`public/candidatos/LICENCIA-FUENTE.txt`. Son fotografías referenciales de adultos,
ajenos a las candidaturas ficticias del prototipo.

Antes de un uso institucional público, sustituir las referencias por imágenes
apropiadas con autorización documentada.

### Guardar en GitHub

Revisar `git diff --cached` y crear un commit con los cambios preparados.
No se incluyen `node_modules`, compilaciones, cachés, resultados de pruebas ni
archivos `.env` privados. La publicación en GitHub se realiza mediante una rama
y un Pull Request; no implica un despliegue.

## Configuración institucional y módulo de padrón (2026)

- **I.E. ESTEBAN PAVLETICH TRUJILLO**, Educación Secundaria.
- Meta inicial: **230 electores**, 5 grados y 15 secciones (A, B y C por grado).
- Configuración central: `src/lib/institution.ts`.

En `/padron` puedes descargar un Excel ficticio de 230 registros, importarlo,
revisar errores y confirmar el reemplazo en memoria. Encabezados obligatorios:
`codigo`, `nombre`, `grado`, `seccion`. Escribe los códigos como texto para
conservar ceros iniciales. Se permiten grados 1–5 y secciones A–C; se rechazan
códigos duplicados, fórmulas, archivos mayores de 2 MB o libros con más de una hoja.
La capacidad es 230; un borrador menor puede corregirse, pero no cerrarse.

Esta versión pública **solo acepta los identificadores y nombres ficticios de la
plantilla** (`DEMO-001`, `Estudiante ficticio 001`, etc.). No debe utilizarse con
información personal real. No hay subidas al servidor ni persistencia local;
al recargar se reinician los datos y el bloqueo de edición. La interfaz incluye
conteos por grado/sección, electores, votantes y pendientes. Los 230 ejemplos
comienzan pendientes; la demostración de votación no los marca como votantes.
Los resultados ilustrativos de otra página son independientes de este padrón.

Se pueden corregir registros mientras el padrón ficticio está en borrador. La
opción de cierre bloquea los controles de edición de la demostración, sin abrir
una elección real ni emitir credenciales.

### Backend de seguridad preparado, sin desplegar

- `supabase/migrations/202610190001_electoral_security.sql`: 15 secciones,
  restricciones, reemplazo atómico de padrón, RLS, membresía administrativa,
  credenciales por hash/caducidad, participación única y emisión transaccional.
- `src/lib/security/credentials.ts`: utilidad de servidor para tokens aleatorios
  individuales de 256 bits, hash SHA-256 y caducidad de 24 horas.
- `docs/SEGURIDAD-ELECTORAL.md`: arquitectura, permisos, flujo y límites.

No se ha conectado Supabase, Auth, Vercel ni otro servicio. La web no llama a las
funciones SQL ni entrega credenciales. No está habilitada para elecciones reales.
La protección con sesiones reales y el despliegue de RLS requieren autorización
para conectar el backend y una validación independiente antes de usar datos reales.

### Pruebas del padrón y seguridad

```bash
npm run test:unit
npm run lint
npm run build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:smoke
```

Las pruebas de seguridad ejecutan SQL y roles en **PGlite en memoria**, sin acceder
a servicios externos. Verifican denegación de acceso, edición antes de apertura,
invalidación de credenciales al corregir, expiración, rechazo de repetidos y
rollback completo cuando falla una escritura. El motor local serializa las
solicitudes; la prueba real de concurrencia entre varias conexiones PostgreSQL
queda pendiente antes de cualquier uso electoral real.

Los Excel de prueba se generan en memoria. `.gitignore` excluye hojas de cálculo,
CSV, carpetas privadas y archivos de credenciales. Revisa los cambios preparados
antes de publicar: nunca incluyas información personal o tokens en GitHub.
