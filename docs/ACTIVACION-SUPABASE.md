Para preparar la gestión institucional y una elección oficial en borrador sin abrirla, consultar [Gestión institucional](GESTION-INSTITUCIONAL.md), incluida la migración adicional 005.

# Integración Next.js–Supabase: activación manual y segura

La recuperación y el cambio de contraseña están implementados. Configuración
actual: [Recuperación de contraseña](RECUPERACION-CONTRASENA.md).

## Estado de esta entrega

El código conecta Auth, Data API/RPC y Storage mediante el SDK oficial, desde el
servidor de Next.js. La demostración original sigue en sus siete rutas. La
integración real está en `/sistema`; no se mezcla con el estado ficticio de React.
No se ha conectado ni modificado el proyecto Supabase real y no se han utilizado
credenciales reales. Las variables están vacías o deshabilitadas por defecto.

Se probaron el SDK y las pantallas con un servidor HTTP de prueba en loopback y
las migraciones con PostgreSQL local. Ese servidor no sustituye la validación
final de Auth/JWT/TOTP, RLS y Storage del proyecto alojado en Supabase.

## 1. Revisar y aplicar manualmente las migraciones

**No ejecutadas por Codex en tu Supabase.** Cuando autorices la instalación en un
proyecto aislado de pruebas, revisa el historial y aplica solo las pendientes,
completas y en este orden:

1. `supabase/migrations/202610190001_electoral_security.sql`
2. `supabase/migrations/202610190002_complete_electoral_system.sql`
3. `supabase/migrations/202610190003_private_electoral_media.sql`
4. `supabase/migrations/202610190004_secure_application_sessions.sql`

Si el proyecto contiene datos reales o una elección en curso, detenerse y
planificar una migración supervisada; la instalación aquí se valida en un proyecto
aislado de pruebas sin estudiantes reales.

No repetir archivos sobre objetos existentes, no ejecutar fixtures ni crear
imitaciones de `auth.users`, `auth.uid`, `auth.jwt` o `storage` en Supabase. Esos
objetos y funciones los proporciona el servicio. Cada migración usa transacción.
Si falla alguna instrucción, investigar y revertir el intento antes de continuar;
no saltar restricciones o permisos para hacerla pasar.

La 004 añade roles de personal, contexto de sesión, listado seguro de elecciones,
MFA AAL2 en las RPC administrativas y barrera de aprobación para elecciones
oficiales. Sin ella la aplicación rechaza la integración; no degrada la seguridad
para funcionar con un esquema incompleto.

## 2. Data API, permisos y Storage

En la configuración de Data API, mantener expuesto `public` para las RPC. **No
agregar `electoral_private` ni `ballot_box` a Exposed schemas**. Conserva los
esquemas gestionados por Supabase según su configuración; no otorgues SELECT o
escritura directa sobre las tablas privadas a `anon`, `authenticated` o
`service_role` para resolver errores. Las RPC comprueban la sesión y los permisos.

La activación automática de ENABLE RLS es compatible. Verifica las políticas
instaladas y no introduzcas políticas amplias de acceso público. No activar FORCE
RLS indiscriminadamente: los helpers privilegiados necesitan su acceso interno.
Los propietarios y operadores siguen siendo privilegiados y requieren controles.

En Storage, verificar que `electoral-media` existe como **privado**, con 5 MB y
JPEG/PNG/WebP. La migración 003 crea el bucket y sus políticas restrictivas.
No hacerlo público ni usar enlaces públicos. Las subidas emplean la sesión del
personal con MFA, previa autorización registrada y saneamiento en el servidor.
Las descargas pasan por Next.js, revalidan usuario y elección, aplican RLS de
Storage, eliminan metadatos y responden sin caché pública ni enlaces firmados.

Si una RPC no aparece tras confirmar las migraciones, comprobar primero su
existencia y permisos y recargar la caché de esquema de PostgREST mediante el
mecanismo del proveedor. No modificar las firmas ni exponer esquemas privados.

## 3. Configurar Supabase Auth

En Authentication:

- Habilitar el proveedor Email/Password que utiliza esta implementación.
- Deshabilitar registros públicos: las cuentas se crean por un operador autorizado.
- Configurar Site URL con el origen canónico de Next.js. Configurar las URLs de
  redirección que realmente se utilicen; no usar comodines amplios en producción.
- Habilitar TOTP MFA y los límites de solicitudes de autenticación disponibles.
- Configurar correo, recuperación administrativa y políticas de contraseña según
  el entorno. La aplicación usa contraseña, TOTP y recuperación mediante correo
  en `/sistema/restablecer`; configurar la Redirect URL y plantilla descritas en
  la guía de recuperación. OAuth y acceso por enlaces mágicos no se implementan.

Crear primero cuentas de prueba de personal desde Authentication > Users, sin
información de alumnos reales. Deben estar confirmadas mediante el procedimiento
autorizado del panel. `example.test` es un dominio ficticio: no esperes recibir
correos allí. No desactivar verificaciones de producción para resolver una prueba.

El UUID de Auth, no un correo ni un campo editable del perfil, concede la
membresía. Un operador ejecuta manualmente una inserción como esta, sustituyendo el
marcador por el UUID real de la cuenta de personal autorizada:

```sql
insert into electoral_private.administrators (user_id, role)
values ('<UUID_DE_AUTH_DEL_PERSONAL>'::uuid, 'administrator');
```

Para un integrante autorizado del comité, usar `committee`. No ejecutar el ejemplo
con el marcador literal. Ambos perfiles tienen las facultades administrativas del
sistema actual; la diferencia identifica su función institucional, no una
separación de permisos que todavía no se ha definido. No existe endpoint de
registro de administradores ni se confía en `user_metadata` para asignar roles.

En `/sistema/login` iniciar sesión y verificar el autenticador en `/sistema/mfa`.
Si no hay TOTP verificado, el sistema permite inscribir uno para esa cuenta. Si ya
existe, exige un código del factor existente; no lo sustituye para evitarlo. La
base de datos comprueba `aal2`, además de las comprobaciones de Next.js.

## 4. Variables del servidor de Next.js

Copiar `.env.example` a `.env.local` en la máquina de desarrollo o introducir los
valores mediante la configuración segura del alojamiento. No guardarlos en Git ni
enviarlos por chat. No se necesita contraseña de PostgreSQL, cadena de conexión,
`service_role` ni clave `sb_secret_` para los datos electorales y Storage.
La función opcional de invitaciones de personal incorpora una clave privada
separada, exclusiva del servidor y utilizada únicamente para crear enlaces de
Auth; consulta [su configuración adicional](PERSONAL-Y-CANDIDATOS.md).

| Variable                            | Valor que debes configurar                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------- |
| `SUPABASE_INTEGRATION_ENABLED`      | `true` solo tras preparar y revisar el proyecto de pruebas                                        |
| `SUPABASE_URL`                      | Project URL HTTPS exacta del proyecto Supabase, sin ruta ni credenciales                          |
| `SUPABASE_PUBLISHABLE_KEY`          | Publishable key `sb_publishable_…` del panel API Keys; no anon JWT legacy, secret ni service_role |
| `APP_ORIGIN`                        | Origen exacto de Next.js, por ejemplo el origen local que estés usando o tu dominio HTTPS         |
| `ELECTORAL_RPC_VOTING_ENABLED`      | Mantener `false` al principio; `true` permite pruebas explícitas de emisión desde la aplicación   |
| `ELECTORAL_OFFICIAL_VOTING_ENABLED` | Mantener **`false`** en esta fase                                                                 |
| `ELECTORAL_DEPLOYMENT_STAGE`        | `development` en desarrollo; no usar `local-test` con servicios reales                            |

No hay variables `NEXT_PUBLIC_` para la conexión. El SDK y la clave permanecen en
módulos `server-only`; el navegador solo recibe los datos autorizados y cookies
HttpOnly. `APP_ORIGIN` debe coincidir exactamente con el origen usado en el
navegador: `localhost` y `127.0.0.1` son distintos. Las mutaciones rechazan otros
orígenes además de las protecciones CSRF de Server Actions. HTTPS es obligatorio
fuera del desarrollo en loopback y habilita cookies Secure.

Reiniciar Next.js después de cambiar variables. No hace falta proporcionar valores
para `npm run build`: la compilación no contacta a Supabase.

## 5. Preparar una elección de pruebas con 230 identidades ficticias

1. Entrar como personal con MFA y crear una elección desde `/sistema/nueva`.
   Se crea en borrador y con `purpose='test'`; la aplicación no puede asignar
   aprobación de seguridad ni convertirla en oficial.
2. Descargar el XLSX ficticio de la demostración `/padron`. En el padrón conectado,
   importar la hoja de 230 registros y confirmar el reemplazo transaccional.
   En modo test solo se aceptan códigos y nombres de esa plantilla.
3. Crear las cuentas Auth de estudiantes **ficticios** mediante un procedimiento
   autorizado del panel. Copiar sus UUID al registro correspondiente mediante
   el formulario de corrección. La aplicación no lista cuentas de Auth ni crea
   usuarios mediante una clave administrativa.
4. Gestionar listas y candidatos desde las páginas conectadas. Registrar medios
   autorizados y copiar sus rutas opacas a las candidaturas/símbolos. Las fotos de
   prueba deben ser referenciales; no subir fotos de menores reales.
5. Emitir una credencial por elector y verificar la entrega individual; confirmar
   la versión vigente. No copiar tokens a planillas, logs o URLs.
6. Comprobar 230 registros con cuenta vinculada, credenciales vigentes y entregas
   confirmadas, listas numeradas, propuestas, alcalde y al menos un regidor por
   lista. Abrir la elección de pruebas mediante confirmación explícita.
7. Solo para la prueba autorizada, establecer `ELECTORAL_RPC_VOTING_ENABLED=true`
   y reiniciar la aplicación. Iniciar sesión con cuentas ficticias vinculadas,
   elegir, revisar y confirmar. Probar blanco, doble envío, recuperación y errores.
8. Cerrar mediante una cuenta de personal con MFA. Consultar el recuento conectado:
   antes del cierre la página no entrega cifras y la RPC también lo impide.
   Después permite agregar y exportar resultados; el modo test conserva marcas de
   demostración. No representa un acta oficial firmada.

La recuperación invalida el token anterior y no permite votar hasta confirmar la
nueva entrega; un elector que ya participó no puede recuperar otra credencial.
Una respuesta perdida se resuelve consultando participación, sin reenviar la
selección automáticamente ni devolver qué opción fue elegida.

## 6. Qué falta antes de una elección oficial

Esta entrega **no autoriza ni activa una votación oficial**. Antes se requiere:

- Aprobar y documentar las pruebas con el proyecto alojado: JWT verificados,
  revocación de sesiones, TOTP real, RLS de Data API/Storage, concurrencia y cierre.
- Revisar logs del alojamiento, proxy y Supabase. No capturar cuerpos, argumentos,
  contraseñas, tokens, OTP ni identidad y selección juntos. El código no agrega
  ese registro, pero no controla los registros del proveedor.
- Implementar límites de solicitudes en la infraestructura, HTTPS, timeouts,
  respaldo/restauración, retención y respuesta a incidentes conforme al plan
  contratado; no asumir garantías de disponibilidad del plan gratuito.
- Autorizar el tratamiento de datos de menores y fotografías, custodiar evidencia,
  validar padrón y reglas electorales y aprobar la proclamación/firma del acta.
- Revisar independientemente las limitaciones del secreto frente a operadores,
  transacciones, WAL, instrumentación y respaldos.

Solo entonces un operador autorizado podría preparar una elección con
`purpose='official'` y registrar `security_approved=true` en la base de datos,
con evidencia externa del informe de seguridad y autorización institucional. Los
roles de aplicación no pueden modificar esas columnas. El trigger de la 004
impide abrir una elección oficial sin esa aprobación. La aplicación añade la
barrera `ELECTORAL_OFFICIAL_VOTING_ENABLED`; no basta con cambiar una variable.

Las variables controlan la aplicación, no deshabilitan por sí solas el acceso
RPC de una elección ya abierta y aprobada. Para detener una elección, cerrarla
primero en PostgreSQL mediante personal autorizado u operador; no confiar solo
en ocultar la pantalla o desactivar una variable. El personal con MFA puede cerrar
una elección aunque el interruptor oficial de la aplicación esté apagado.

## Verificaciones reproducibles, sin credenciales reales

```bash
npm run test:unit
npm run test:postgres
npm run lint
npm run build
npm run type-check
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:smoke
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:connected
```

`test:postgres` usa Docker local y las cuatro migraciones. `test:connected` ejecuta
Next.js con el SDK oficial contra una simulación HTTP de Auth/RPC/Storage en
loopback. Sus cuentas/tokens son ficticios y no sirven fuera de esa prueba. No
apunta al proyecto real. Las pruebas de TOTP comprueban el protocolo y el flujo,
no certifican la implementación del proveedor. `test:smoke` conserva las pruebas
de demostración y comprueba que sin configuración la integración falla cerrada.
