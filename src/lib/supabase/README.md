# Integración pendiente

La interfaz utiliza datos ficticios de `src/lib/demo.ts` y `src/lib/roll/`. No hay conexión a Supabase.

Al incorporar el servicio: crear clientes de navegador y servidor por separado,
validar sesiones en el servidor y configurar RLS y permisos antes de usar datos reales.
La unicidad del voto y el secreto electoral requieren un diseño y auditoría específicos
con transacciones de servidor; no se garantizan desde el navegador.
Nunca exponer claves secretas ni service_role en variables NEXT_PUBLIC_.
No sustituir el botón de demostración por una escritura directa a una tabla.

`config.ts` define la configuración pública opcional; devuelve `null` si faltan
variables. No inicializa clientes ni realiza solicitudes. Ninguna página lo usa
para autenticar usuarios o escribir datos.

La migración preparada en `supabase/migrations/` contiene RLS, funciones de
importación atómica y voto transaccional; se prueba solo en memoria.
Consulta `docs/SEGURIDAD-ELECTORAL.md` antes de cualquier despliegue.
No existe todavía integración de Auth o del padrón real con la interfaz.
