# Orden de migraciones — sin conexión al proyecto real

Ejecutar **solo después de autorización y en un entorno de pruebas primero**:

1. `migrations/202610190001_electoral_security.sql`: base de elecciones, padrón,
   secciones, opciones/listas, credenciales, participación y papeletas.
2. `migrations/202610190002_complete_electoral_system.sql`: candidaturas y listas
   completas, RPC administrativas, entrega/recuperación versionada, auditoría,
   permisos restringidos y recuento protegido por cierre.
3. `migrations/202610190003_private_electoral_media.sql`: bucket privado y políticas
   de Supabase Storage. Requiere los objetos gestionados por Supabase Storage y su
   RLS activado. No recrear ni cambiar propietarios de `auth` o `storage`.

4. `migrations/202610190004_secure_application_sessions.sql`: sesiones, perfiles
   de personal, MFA AAL2 y protección de activación oficial.

Los cuatro archivos forman la versión completa. No habilitar clientes entre pasos.
La migración 001 se conserva sin cambios: si ya fue aplicada por una persona,
comprobar su historial y aplicar únicamente las pendientes en orden. No repetir
los scripts sobre objetos existentes ni comentar instrucciones que fallen.
Cada archivo es transaccional; no son scripts idempotentes de reparación.

## Prerrequisitos

Supabase proporciona `auth.users`, `auth.uid()`, roles `anon`/`authenticated` y
Storage. El operador de migración debe tener los privilegios necesarios para crear
esquemas, funciones y políticas. Los esquemas `electoral_private` y `ballot_box`
**no se incluyen en Exposed schemas de la Data API**. Las RPC se ubican en public.
No dar permisos directos de tablas a roles de aplicación para solucionar errores.

Los scripts de pruebas crean sustitutos de Auth/Storage exclusivamente en una base
Docker desechable; **no ejecutar esos sustitutos ni fixtures en Supabase**.
No se incluyen usuarios, contraseñas, UUID de administradores reales ni datos de
estudiantes en las migraciones. Solo se insertan las 15 secciones autorizadas y la
configuración del bucket privado.

## Después de validar las migraciones

1. Crear una cuenta administrativa mediante Supabase Auth con registro controlado
   y MFA; un operador registra su UUID en `electoral_private.administrators`.
   No hay endpoint para autoasignarse permisos.
2. Crear la elección mediante `manage_electoral_election`; importar y vincular las
   identidades autenticadas desde un servidor autorizado. No utilizar la plantilla
   de demostración como padrón real.
3. Gestionar listas y candidatos con sus RPC. Registrar autorizaciones de medios
   antes de subir bytes saneados a `electoral-media`. Los nombres de archivo son
   UUID, nunca nombres o códigos de estudiantes.
4. Emitir tokens individuales desde el servidor, entregar cada uno bajo supervisión
   y confirmar su versión mediante `confirm_electoral_delivery`. Para abrir se
   requieren 230 electores, identidades vinculadas, 230 entregas vigentes, listas
   numeradas con propuestas, exactamente un alcalde y al menos un regidor por lista.
5. Integrar sesiones JWT verificadas y autorización en el servidor antes de activar
   datos reales. `src/lib/electoral/backend.ts` define operaciones con un transporte
   RPC inyectado; no conecta nada ni verifica JWT por sí solo.
6. Configurar exclusión de cuerpos/argumentos sensibles en logs y analítica,
   límites de solicitudes, timeouts, HTTPS, respaldos y retención. Probar permisos
   de Data API y descargas Storage usando sesiones reales de prueba.

`get_electoral_results` permite solo administradores y solo estado `closed`;
ningún rol de aplicación recibe acceso directo a las papeletas. Los estudiantes no
pueden consultar ese recuento incluso tras el cierre. Una futura publicación para
la comunidad debe exponer únicamente un agregado autorizado, nunca papeletas.

La autorización, entrega física, reglas de proclamación/quórum, firma de actas y
operación del comité electoral requieren aprobación institucional. Los PDF y Excel
actuales están marcados como demostración, no como documentos oficiales firmados.

## Ampliación de integración Next.js

Después de 001, 002 y 003 aplicar manualmente, cuando corresponda:

4. `migrations/202610190004_secure_application_sessions.sql`: rol de personal,
   sesión y elecciones accesibles, administración con AAL2 y barrera de apertura
   oficial. No se ha aplicado al servicio real.

La guía actual y completa de activación es `docs/ACTIVACION-SUPABASE.md`.
Con la 004, `is_admin` requiere TOTP/AAL2 además de membresía. Administrador y comité
son perfiles de personal autorizado con las mismas facultades actuales. Las
cuentas sin membresía no reciben permisos por sus metadatos editables.
