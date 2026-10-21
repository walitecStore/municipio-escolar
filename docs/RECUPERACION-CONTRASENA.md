# Cambio y recuperación de contraseña del personal

## Rutas y configuración exacta de producción

La aplicación implementa:

- `/sistema/login`: acceso con contraseña y enlace «Olvidé mi contraseña».
- `/sistema/perfil`: «Cambiar contraseña», exclusivo para administrador/comité
  con AAL2. Exige nuevamente contraseña actual y código TOTP en la misma operación.
- `/sistema/restablecer`: solicitar enlace, verificarlo y guardar contraseña nueva.

En **Supabase → Authentication → URL Configuration**:

**Site URL**

```text
https://municipio-escolar-gold.vercel.app
```

**Redirect URLs**, agregar exactamente:

```text
https://municipio-escolar-gold.vercel.app/sistema/restablecer
```

No agregar comodines, `/auth/callback` ni parámetros con tokens. No hace falta
agregar `/sistema/perfil` como redirect. Conservar otras entradas solo si sirven
para flujos implementados. Para un entorno local separado, registrar únicamente
el origen y puerto usados, por ejemplo
`http://localhost:3000/sistema/restablecer`; no usarlo como Site URL de producción.

En Vercel, conservar `APP_ORIGIN=https://municipio-escolar-gold.vercel.app`, la
conexión server-only existente y ambos interruptores de votación en `false`.
Esta funcionalidad no agrega variables secretas ni requiere service_role.

## Plantilla recomendada del correo de recuperación

En **Authentication → Email Templates → Reset Password**, usar un enlace como:

Asunto: **Restablecimiento de contraseña - Municipio Escolar**.

```html
<h2>Restablecimiento de contraseña - Municipio Escolar</h2>
<p>
  Has solicitado restablecer la contraseña de tu cuenta en la plataforma de
  Elecciones del Municipio Escolar.
</p>
<p>Para continuar, haz clic en el siguiente botón:</p>
<a
  href="{{ .SiteURL }}/sistema/restablecer#token_hash={{ .TokenHash }}&amp;type=recovery"
  >CONFIRMAR RESTABLECIMIENTO DE CONTRASEÑA</a
>
<p>Si no solicitaste este cambio, puedes ignorar este mensaje.</p>
```

El fragmento después de `#` no se envía al servidor en la petición HTTP. El
navegador lo retira de la URL y solo lo transmite por POST al Server Action
cuando el usuario pulsa «Verificar enlace de recuperación». El servidor llama
`verifyOtp({ type: 'recovery', token_hash })`; no acepta el parámetro `type` del
usuario para elegir otros flujos. Supabase comprueba validez, vencimiento y uso
único del token. No utilizar el número OTP corto en lugar de `TokenHash`.

Esta plantilla permite abrir el correo en otro navegador porque el token se
verifica directamente; no depende de la cookie PKCE del navegador que solicitó
el correo. Deshabilitar seguimiento de clics y reescritura de enlaces del
proveedor de correo. Probar el correo real tras configurar la plantilla.

Se conserva compatibilidad con:

- La plantilla por defecto `{{ .ConfirmationURL }}` cuando se solicita desde la
  aplicación: Supabase devuelve un `code` PKCE a `/sistema/restablecer`. Debe
  abrirse en el mismo navegador con la cookie verifier vigente. Sin ella se
  rechaza y se permite solicitar otro enlace. Los parámetros de URL se eliminan
  al montar la pantalla; para evitar códigos en registros de infraestructura,
  preferir la plantilla de fragmento anterior.
- Enlaces anteriores que llegan al Site URL con
  `#access_token=…&refresh_token=…&type=recovery`: el inicio los dirige a
  `/sistema/restablecer`, sin enviar el fragmento por HTTP. El servidor verifica
  el access JWT exacto mediante Supabase Auth antes de confiar en sus claims y
  exige una autenticación de correo (`otp` o `recovery` en AMR) de menos de diez minutos. Un token de sesión
  normal de contraseña no se acepta como enlace de recuperación.
- Un error `otp_expired` en el fragmento del inicio muestra la recuperación con
  opción de solicitar otro enlace. No se muestra el texto privado del proveedor.

No todos los enlaces antiguos son recuperables: un token ya consumido o vencido,
una sesión revocada o un canje PKCE sin su verifier se rechazan de forma segura.
No es necesario reutilizarlos; solicitar otro enlace con la configuración nueva.

## Política de contraseña y MFA

Los dos campos deben coincidir. Se exigen al menos 12 caracteres, un máximo de
72 bytes UTF-8, mayúscula, minúscula, número y símbolo. Los 72 bytes evitan
truncamientos de bcrypt; caracteres Unicode pueden ocupar más de un byte. No se
recortan ni normalizan contraseñas. Supabase aplica además su propia política;
activar longitud mínima de 12 y los requisitos equivalentes disponibles en Auth.
Si la protección contra contraseñas filtradas está disponible en el plan,
configurarla sin asumir que el plan gratuito la incluye. Mantener activado el
cambio seguro de contraseña. Un requisito más estricto del proveedor puede
rechazar la actualización sin que la aplicación muestre su respuesta privada.

En cambio desde el perfil se comprueba la identidad reciente con una sesión
efímera en memoria: contraseña actual, mismo UUID de Auth y nuevo desafío TOTP.
El formulario de perfil no confía solo en que la sesión ya fuera AAL2.

La recuperación utiliza un cliente y cookies diferentes (`electoral-recovery`,
HttpOnly, Secure bajo HTTPS, SameSite=Lax), limitadas a
`/sistema/restablecer`. Estas cookies no autentican el panel electoral ni sus
RPC desde la aplicación. La antigüedad de la prueba de correo se comprueba en servidor, con
límite de diez minutos, aunque se intente prolongar la cookie. No se confía en
`getSession()` sin verificar el JWT exacto con Auth.

Si existe un factor TOTP verificado, se exige un código actual antes de guardar,
aunque la sesión de recuperación haya obtenido AAL2 anteriormente. No se
reemplazan ni desinscriben factores para superar una recuperación. Si todavía no
se inscribió ningún TOTP, se permite cambiar la contraseña mediante la prueba del
correo; esto no crea una sesión electoral ni elimina la obligación de inscribir
y verificar TOTP antes de entrar al panel. Se exige rol administrator/committee
consultado en la base de datos; no se confía en metadatos editables.

Si hay varios factores TOTP verificados se usa el primero devuelto por Auth,
igual que en el flujo de MFA existente. La pérdida de ese autenticador requiere
un procedimiento supervisado del responsable; el correo no autoriza eliminarlo.

Tras guardar desde el perfil se redirige al login con un indicador de éxito sin
secretos en la URL. En recuperación se muestra el resultado en la misma pantalla.
Tras guardar se muestra **«Tu contraseña se actualizó correctamente»**. Se intenta
revocar globalmente las sesiones mediante Auth y se elimina la sesión de la
operación; si la revocación global no se confirma se advierte al responsable.
Los access JWT ya emitidos pueden conservar validez hasta expirar según la
semántica de Supabase; no se promete revocación instantánea de todos los JWT.
El usuario vuelve a iniciar sesión con contraseña nueva y MFA para el panel.

## Prueba alojada, exclusivamente por el responsable

1. Publicar el código revisado en Vercel y configurar las URLs y plantilla
   anteriores. No ejecutar migraciones; las 001–004 no cambian.
2. En ventana privada, usar «Olvidé mi contraseña» con una cuenta autorizada de
   prueba. La respuesta es genérica tanto si existe como si no: no revela cuentas.
3. Abrir el correo, verificar el enlace y comprobar que la URL queda limpia. No
   copiar tokens a capturas, informes o herramientas de analítica.
4. Probar contraseñas distintas, débiles y TOTP incorrecto. Ninguno debe cambiarla.
5. Guardar con contraseña válida y TOTP vigente; comprobar el mensaje de éxito.
6. Confirmar que no se entra al panel con la sesión de recuperación, que el enlace
   de un uso no se reutiliza y que se puede solicitar otro si venció.
7. Iniciar sesión con la contraseña nueva y verificar nuevamente MFA. Desde el
   perfil, probar contraseña actual incorrecta y OTP inválido antes del caso
   correcto. Confirmar cierre de sesión local al guardar.
8. Probar enlace por defecto PKCE en el mismo navegador y rechazo al abrirlo sin
   verifier; probar el enlace de fragmento en otro navegador.
9. Confirmar que los flags de votación siguen en `false` y no abrir elecciones.

Configurar límites de solicitudes de Auth/correo/MFA, HTTPS y restricciones de
acceso en la infraestructura. No habilitar registro de cuerpos, contraseñas,
cookies, OTP, argumentos ni fragmentos de URL en Next.js, Supabase, Vercel,
seguimiento de errores o analítica. Excluir las rutas de recuperación de
capturas de sesión; los enlaces son credenciales. La aplicación no añade dichos
registros, pero no puede garantizar la configuración de los proveedores.

Las pruebas automatizadas utilizan el SDK real contra un proveedor HTTP ficticio
local. Verifican hash de un uso, cookies aisladas, coincidencia, MFA obligatorio,
PKCE, enlace implícito, rechazo de OTP antiguo y cambio reciente desde perfil.
No certifican entrega de correo ni Auth/MFA del Supabase alojado. No se utilizaron
credenciales ni estudiantes reales y no se conectó al proyecto Supabase real.

## Diagnosticar un correo que no llega

La entrada directa a `/sistema/restablecer` ahora muestra el formulario de correo
sin afirmar que un enlace venció. Solo un enlace rechazado o una sesión de
recuperación caducada muestran «Este enlace ha vencido o ya fue utilizado.
Solicita uno nuevo» y el botón «SOLICITAR NUEVO ENLACE». El envío aceptado por Auth
muestra «Si el correo está registrado, recibirás un enlace para restablecer tu
contraseña»; esto no certifica entrega al buzón.

La acción inspecciona el error de `resetPasswordForEmail`. Un fallo conocido del
servicio muestra un aviso de indisponibilidad, y un 429 indica límite de envío;
ninguno muestra confirmación de envío. Las condiciones referidas a existencia de
cuenta conservan la respuesta neutral. Nunca se presenta al usuario el mensaje
original del proveedor.

En los logs de Vercel, filtrar por `password_recovery_request`. Solo se registran
`event`, una categoría `outcome` de una lista fija y, si está disponible, el estado
HTTP numérico. No se registran correos, IP, hashes de límites, contraseñas, tokens,
cookies, códigos, URLs ni errores originales.

| outcome           | Interpretación y siguiente comprobación                                                     |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `accepted`        | Auth aceptó la solicitud; revisar entrega por el proveedor. No significa que llegó a Gmail. |
| `account_neutral` | Respuesta neutral, sin revelar existencia de cuenta.                                        |
| `local_limit`     | La defensa local impidió llamar a Auth; esperar el tiempo indicado.                         |
| `rate_limit`      | Auth limitó solicitudes; revisar cuotas y ventana de envío.                                 |
| `configuration`   | Revisar proveedor Email/SMTP, remitente y destinatarios permitidos.                         |
| `mail_service`    | Fallo 5xx; revisar Auth Logs y estado de SMTP/proveedor.                                    |
| `provider`        | Rechazo no clasificado; revisar Auth Logs de forma privada, sin copiar datos sensibles.     |
| `unavailable`     | Revisar configuración de servidor, origen canónico y conectividad.                          |

Pasos manuales del responsable, en el proyecto correcto:

1. En **Authentication → Logs** (o Logs Explorer → Auth), revisar el evento de la
   hora del intento. No exportar ni compartir cuerpos, enlaces, tokens, correos o
   IP; anotar solo categoría, estado y hora para el diagnóstico.
2. En **Authentication → Rate Limits**, comprobar límites de correo y tiempo
   mínimo entre solicitudes. No aumentar cuotas a ciegas ni enviar repetidamente
   para probar. Los valores dependen del plan y de si se usa SMTP propio.
3. Si se usa el servicio de correo predeterminado de Supabase, comprobar sus
   restricciones actuales de destinatarios y cuotas: puede limitar envíos a
   direcciones autorizadas del equipo del proyecto. No asumir que enviará a
   cualquier dirección Gmail aunque esa dirección figure en Auth.
4. Si esas restricciones impiden el uso previsto, configurar un proveedor SMTP
   autorizado en **Authentication → Email / SMTP Settings**. Revisar host, puerto,
   TLS, remitente, dominio verificado, SPF/DKIM/DMARC y cuotas del proveedor. Guardar
   sus credenciales únicamente en Supabase; no en Git, navegador ni chat. Este
   trabajo no configura ni contrata SMTP ni solicita esas credenciales.
5. En el panel del proveedor de correo, comprobar aceptación, entrega, rebotes,
   supresiones y restricciones del destinatario. Auth 200 por sí solo no prueba
   entrega. Revisar Spam/Promociones en Gmail y evitar seguimiento de clics que
   pueda reescribir o consumir enlaces.
6. Confirmar Site URL, Redirect URL y la plantilla Recovery indicadas arriba.
   No cambiar Email/Password, TOTP, usuarios, roles ni SQL para resolver correo.
7. Realizar un solo intento controlado con una cuenta de prueba autorizada, esperar
   el plazo y comprobar el nuevo enlace desde Gmail. No usar datos de estudiantes.

No se accedió a los logs privados ni a la configuración SMTP de Supabase alojado;
por tanto, no se atribuye el fallo real a una causa concreta sin evidencia.

## Límites de frecuencia y alcance en Vercel

Antes de llamar a Auth se reserva capacidad de forma síncrona para evitar carreras:
una solicitud por correo cada 60 segundos, cinco por IP en 15 minutos y 30 por
instancia en un minuto. Se cuentan también los intentos que fallen. Los correos
se comparan sin distinguir mayúsculas; solo se conservan identificadores HMAC con
sal efímera en memoria. Las entradas caducan y el tamaño está acotado. El cliente
muestra una espera y deshabilita el botón; recargar no evita la reserva del servidor
en esa instancia. Vercel usa su cabecera de IP de plataforma; sin ella se usa un
cupo compartido conservador, sin confiar en cabeceras arbitrarias del cliente.

**La memoria de una función serverless no es un límite global persistente:** cambia
entre instancias y se pierde al reiniciar. Mantener los límites compartidos de
Supabase Auth activos, incluido el tiempo mínimo de reenvío, y configurar protección
de frecuencia en la frontera de Vercel/proxy según las opciones del plan. Aplicarla
al POST de `/sistema/restablecer`, sin inspeccionar ni registrar cuerpos. No asumir
que una opción de Firewall de un plan superior está incluida en el plan actual.
Una defensa distribuida adicional requiere infraestructura compartida autorizada;
no se añadieron Redis, servicios externos ni tablas electorales para este cambio.

## Publicación y validación

1. Fusionar el PR revisado en `main` y comprobar que Vercel publica ese commit.
   Si se necesita un redeploy manual, hacerlo solo en `municipio-escolar`.
2. Verificar en Production `APP_ORIGIN` exacto y las variables server-only de
   Supabase ya existentes; no hacen falta claves nuevas para esta corrección.
3. Mantener `ELECTORAL_RPC_VOTING_ENABLED=false` y
   `ELECTORAL_OFFICIAL_VOTING_ENABLED=false`. No abrir elecciones.
4. Guardar la plantilla Recovery y las URLs en Supabase, sin volver a ejecutar SQL.
5. Validar entrada sin enlace, error de envío, espera, correo real, enlace nuevo,
   cambio de contraseña y nuevo login con MFA. Las pruebas locales simulan Auth y
   SMTP: no certifican entrega real en Gmail ni SMTP alojado.

## Validación de la revisión 59335f1

El flujo actual verifica el enlace automáticamente: las pruebas de navegador se
actualizaron para esperar el formulario o el rechazo, conservando comprobaciones
de un solo uso, sesión aislada, contraseña nueva, nuevo login y MFA. No dependen
de un botón de verificación retirado de la interfaz.

El SDK puede representar una respuesta HTTP 500 como `AuthRetryableFetchError`.
Ese nombre por sí solo no demuestra un fallo de conexión: con estado 5xx se
mantiene el diagnóstico `mail_service`. La categoría `connection` se reserva para
un error de transporte sin estado HTTP. En ese caso tampoco se afirma que el
correo no se envió: una respuesta perdida no permite saber si Auth lo procesó.
Estos casos se validan localmente; no prueban el envío real del proyecto alojado.
