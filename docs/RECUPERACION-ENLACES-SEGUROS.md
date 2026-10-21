# Recuperación por correo sin consumo previo del enlace

## Diagnóstico
El 21/10/2026 Supabase registró peticiones GET /verify con error **One-time token not found** segundos después de enviar mensajes de recuperación. No se trata necesariamente de un enlace caducado por el tiempo configurado: un lector o filtro de seguridad puede visitar el enlace de un solo uso antes que la persona.

## Configuración necesaria
La plantilla predeterminada que usa `{{ .ConfirmationURL }}` apunta al endpoint /auth/v1/verify de Supabase, que puede consumir el token mediante una solicitud GET. Para evitarlo, personalizar la plantilla de **Authentication → Emails → Reset password** con el contenido de `docs/email-templates/reset-password.html`.

La URL personalizada utiliza `{{ .TokenHash }}` para que el primer GET abra **nuestra página**, no el endpoint de canje de Supabase. El token viaja en el fragmento de URL; el navegador lo retira de la dirección visible y el sitio lo verifica de forma segura con `verifyOtp({ type: 'recovery', token_hash })` mediante una acción POST. Solo después de validar el token aparece el formulario para escribir y confirmar la nueva contraseña.

**Nota operativa:** algunas configuraciones de Supabase exigen SMTP personalizado antes de permitir editar plantillas. Esta configuración de Auth no está expuesta por las herramientas conectadas; debe cambiarse desde el panel autorizado. No guardar claves SMTP en el repositorio.

## Prueba
1. Confirmar despliegue de producción en estado READY.
2. Activar la plantilla anterior en Supabase.
3. Solicitar un único correo nuevo (no reutilizar correos previos), respetando los límites de envío.
4. Al tocar el botón del correo, comprobar que se abre el formulario de nueva contraseña. Si hay MFA, completar el código del autenticador.
5. Verificar el inicio de sesión con la nueva contraseña.
6. Si falla, revisar registros de Vercel con evento `password_recovery_verify` y la fase, sin publicar tokens ni enlaces completos.

No activar la votación oficial por este cambio.