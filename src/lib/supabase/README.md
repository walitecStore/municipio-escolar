# Integración Supabase

La implementación conectada está en `src/lib/connected/` y `src/app/sistema/`.
Usa el SDK oficial desde módulos server-only, cookies HttpOnly y `auth.getUser()`
antes de consultar datos; la autorización y MFA se comprueban también por RPC.
No se ha configurado ni contactado el proyecto Supabase real.

`config.ts` es el helper público opcional legado de la demostración; no es el
lector de la conexión real. Las variables actuales del servidor se describen en
`.env.example` y `docs/ACTIVACION-SUPABASE.md`. No usar service_role ni claves
secretas, ni introducirlas en variables NEXT_PUBLIC_.

Los esquemas electorales permanecen privados. La secuencia completa de migraciones
es 001, 002, 003 y 004; solo se han ejecutado en pruebas locales. No sustituir las
RPC transaccionales por escrituras directas a tablas. El sitio de demostración
original continúa funcionando sin credenciales ni persistencia remota.
