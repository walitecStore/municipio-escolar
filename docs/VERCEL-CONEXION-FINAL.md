# Conexión final de Vercel con Supabase

## Punto de partida

Revisión de `origin/main` en `da7ef1b`, 20 de octubre de 2026. El responsable
confirmó migraciones 001–004 ejecutadas, RLS en las 11 tablas, administrador con
rol verificado, Email/Password y TOTP habilitados y aplicación publicada. No
repetir migraciones ni recrear cuentas. Estas confirmaciones no equivalen a una
comprobación independiente del proyecto alojado desde Codex.

La integración está en `/sistema`. `/administracion`, `/resultados` y las demás
pantallas originales siguen siendo demostraciones; no usar su comportamiento
como evidencia de acceso real, voto o resultados de PostgreSQL.

## Variables exactas en Vercel

Abrir **el proyecto municipio-escolar** → Settings → Environment Variables.
Configurar para **Production**, sin prefijo `NEXT_PUBLIC_`, sin comillas ni
espacios iniciales/finales:

| Nombre                              | Valor                                       | Procedencia                                                                                                                                    |
| ----------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_INTEGRATION_ENABLED`      | `true`                                      | Habilita Auth/RPC/Storage de la aplicación.                                                                                                    |
| `SUPABASE_URL`                      | URL HTTPS del proyecto Supabase             | Panel del proyecto Supabase → Connect / Data API → Project URL; copiar el valor del proyecto, sin inventar su referencia ni añadir `/rest/v1`. |
| `SUPABASE_PUBLISHABLE_KEY`          | Clave que empieza por `sb_publishable_`     | Supabase → Settings → API Keys → Publishable key. La clave `anon` JWT legacy no es aceptada por este código.                                   |
| `APP_ORIGIN`                        | `https://municipio-escolar-gold.vercel.app` | Dominio de producción confirmado. Sin barra final, rutas, puerto, parámetros ni comodines.                                                     |
| `ELECTORAL_RPC_VOTING_ENABLED`      | `false`                                     | Mantiene deshabilitada la emisión desde la aplicación, incluida la de pruebas.                                                                 |
| `ELECTORAL_OFFICIAL_VOTING_ENABLED` | `false`                                     | Mantener deshabilitado el modo oficial.                                                                                                        |
| `ELECTORAL_DEPLOYMENT_STAGE`        | `production`                                | Valor descriptivo permitido; nunca `local-test` para servicios alojados.                                                                       |

No agregar `service_role`, `sb_secret_`, contraseña PostgreSQL, JWT secret ni
cadena de conexión. La publishable key no es una credencial administrativa;
aun así, esta implementación la conserva en el servidor. No pegar valores en
Git, capturas, comentarios de PR o chat.

Guardar variables no actualiza los deployments existentes. Hacer **Redeploy**
del deployment de producción que contiene `main`, después de revisar los valores.
No cambiar variables de otros proyectos. Este documento no realiza el redeploy.

No compartir esta configuración con Preview/Development indiscriminadamente.
Una Preview debe permanecer deshabilitada o utilizar un proyecto Supabase de
pruebas separado y su propio origen exacto. El origen de un deployment temporal
`*.vercel.app` difiere del dominio canónico: usar siempre el dominio indicado
para iniciar sesión. Si cambia el dominio, actualizar también APP_ORIGIN y Site
URL, y redeplegar. No resolver el rechazo de origen con comodines.

## Supabase Auth: confirmar solo lo pendiente

En Authentication → URL Configuration:

- **Site URL:** `https://municipio-escolar-gold.vercel.app`.
- **Redirect URLs:** el inicio de sesión por contraseña y TOTP implementado no
  utiliza callbacks OAuth ni `redirectTo`; no requiere agregar `/auth/callback`.
  Conservar únicamente URLs exactas de flujos que estén implementados. Si se
  mantiene una entrada para producción, usar el origen canónico exacto; evitar
  comodines. Configurar esta lista no sustituye APP_ORIGIN.

Email/Password y TOTP ya están habilitados: no repetir su instalación. Confirmar
que el registro público está deshabilitado, la cuenta existente está confirmada,
los límites de Auth están activos y el dispositivo del autenticador tiene hora
automática. No crear otro administrador ni repetir su inserción SQL. Si se
requiere comité adicional, asignarlo mediante un operador autorizado.

La aplicación no implementa recuperación pública por correo, magic links ni
OAuth. Una pérdida del autenticador requiere recuperación administrativa
supervisada; no eliminar MFA para sortear una prueba.

## Acceso real y MFA

1. Abrir `https://municipio-escolar-gold.vercel.app/sistema/login` en una ventana
   privada. El responsable introduce personalmente sus credenciales; no se
   solicitan ni comparten con Codex.
2. La contraseña crea una sesión AAL1. El personal pasa a `/sistema/mfa`; todavía
   no tiene acceso al padrón ni a las RPC administrativas.
3. Pulsar preparar MFA. Si no hay factor verificado, escanear el QR privado y
   confirmar los seis dígitos. Si existe un factor, utilizarlo: no se reemplaza.
4. Después de verificar, `/sistema` debe mostrar el panel y el rol autorizado.
   Una lista vacía de elecciones es válida si todavía no se creó ninguna.
5. Confirmar cookies HttpOnly, Secure y SameSite=Lax sin copiar sus valores;
   cerrar sesión y comprobar que ya no se puede acceder al panel.

`verifiedSession()` verifica al usuario con Supabase; el rol procede de la tabla
privada, no de `user_metadata`. Tanto administrador como comité tienen actualmente
las mismas facultades administrativas; no existe una separación adicional de
permisos entre ambos. La función SQL `is_admin()` exige membresía y JWT AAL2.
El panel de demostración `/administracion` no está protegido porque es ficticio.

## Data API, fotografías y resultados

- Mantener `public` expuesto para las RPC. No exponer `electoral_private` ni
  `ballot_box`, ni agregar permisos de lectura directa para resolver errores.
- Confirmar `electoral-media` privado, límite 5 MB y JPEG/PNG/WebP. No hacerlo
  público ni generar enlaces públicos de prueba.
- Subir únicamente una imagen referencial autorizada a una elección ficticia en
  borrador desde `/sistema/{id}/media`. El servidor elimina metadatos y Storage
  aplica RLS. Después se asigna la ruta opaca a una lista o candidatura.
- La descarga usa `/sistema/{id}/media/archivo?path=...`, verifica sesión y RLS,
  vuelve a sanear la imagen y responde `private, no-store`. No pasa por el
  optimizador público de imágenes.
- Una cuenta de elector solo puede ver imágenes autorizadas de su elección
  abierta/cerrada. Un anónimo o elector de otra elección no debe obtenerlas.
- `get_electoral_results` exige personal AAL2 y estado `closed`. Antes del cierre
  ni siquiera el administrador debe recibir el recuento. Tras el cierre, un
  elector sigue sin tener acceso al resultado mediante esta RPC administrativa.

RLS activado es necesario pero no prueba por sí solo que las políticas sean
correctas. Las verificaciones deben incluir solicitudes directas Data API/Storage,
además de la interfaz.

## Pruebas HTTP alojadas preparadas

Desde una máquina con acceso a ambos dominios, instalar dependencias con `npm ci`
y proporcionar las variables anteriores por un mecanismo seguro de entorno.
No guardar un archivo con valores reales en Git; no pasar claves en argumentos
visibles ni utilizar `set -x`. Ejecutar:

```bash
node --import tsx scripts/check-hosted-readonly.ts
```

El comprobador no inicia sesión ni emite votos: solicita el login, comprueba la
redirección del panel anónimo y el rechazo de una fotografía de prueba, y consulta
las RPC de padrón/resultados como **anon** usando solo la publishable key. Solo
imprime nombres de comprobaciones y aprobado/fallido; no cuerpos, cookies ni
claves. Usa un UUID ficticio; un 404 de fotografía inexistente no prueba la
protección de un archivo real. Los 401/403 esperados deben revisarse si existen
bloqueos de red/WAF, ya que podrían impedir llegar a PostgREST.

Completar después esta matriz en un proyecto con datos exclusivamente ficticios,
mediante el responsable y un ejecutor HTTP autorizado que conserve JWT solo en
memoria, nunca en URLs, logs, archivos, informes ni comandos. No usar service_role:

| Caso                                          | Evidencia esperada                                                                              |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Admin AAL1: `get_electoral_session`           | Rol administrator y aal1; sin padrón ni resultados.                                             |
| Admin AAL1: RPC de padrón                     | Rechazo sin filas.                                                                              |
| Admin AAL2 tras TOTP                          | Contexto aal2; padrón de prueba accesible.                                                      |
| Usuario sin membresía                         | Sin acceso al panel administrativo ni a RPC privadas.                                           |
| Elector ficticio                              | Sin padrón completo, auditoría ni resultados administrativos.                                   |
| Resultados en draft/open con admin AAL2       | Error SQL, sin recuentos ni porcentajes en la respuesta.                                        |
| Resultados en elección de prueba ya cerrada   | Recuento permitido exclusivamente a personal AAL2; sin identidades junto a opciones.            |
| Fotografía existente, anónimo / otra elección | Sin bytes de imagen por Next.js ni por Storage directo.                                         |
| Misma fotografía, usuario autorizado          | Imagen saneada, no-store y sin URL pública; comprobar también Storage RLS.                      |
| Cierre de sesión                              | Panel inaccesible; para revocación, considerar el tiempo de validez del access JWT de Supabase. |
| Ambos interruptores false                     | Interfaz sin emisión; ningún ensayo de voto en esta fase.                                       |

No abrir/cerrar elecciones, crear cuentas, subir fotos ni ejecutar votos
automáticamente como parte de este comprobador. La matriz autenticada necesita
sesiones y fixtures autorizados; no se ejecutó desde Codex. Las pruebas previas de
concurrencia en PostgreSQL local siguen siendo evidencia local, no alojada.

## Comprobación de que el modo oficial sigue deshabilitado

Revisar ambos valores `false` en **Production** y efectuar el redeploy. Por código,
abrir una elección oficial requiere además `security_approved=true`; los roles de
aplicación no pueden asignarlo. No modificar propósito ni aprobación.

Los flags de Vercel controlan la aplicación: **no bloquean una RPC directa de una
elección ya abierta y aprobada**. Para comprobar el estado real sin exponer datos
personales, el operador puede ejecutar exclusivamente esta consulta de lectura
en el SQL Editor del proyecto correcto y registrar solo los dos conteos:

```sql
select
  count(*) filter (where purpose = 'official' and state = 'open')
    as official_open,
  count(*) filter (where purpose = 'official' and security_approved)
    as official_approved
from electoral_private.elections;
```

Esperado en esta etapa: ambos cero. Si no lo son, investigar con el responsable;
no asumir seguridad por las variables ni cambiar el estado automáticamente.

## Alcance de la revisión de Codex

Se revisó el código fusionado, pero no se leyó la configuración privada de Vercel
ni de Supabase. No hay variables Supabase en el entorno de trabajo. Los intentos
HTTP al dominio publicado fueron bloqueados por el proxy de salida con 403 al
establecer el túnel CONNECT, antes de llegar a Vercel. No es evidencia de un fallo
de la aplicación. Para repetirlos, el entorno necesita acceso al dominio Vercel
y al hostname exacto del proyecto Supabase; no se adivinó ese hostname.

No se cambiaron migraciones, cuentas, servicios, datos ni deployments. El inicio
de sesión real, TOTP, las políticas alojadas y los flags efectivos de Production
quedan pendientes de evidencia del responsable tras configurar las variables.
