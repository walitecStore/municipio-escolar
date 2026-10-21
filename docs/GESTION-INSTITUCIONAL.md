# Preparación institucional y elección oficial en borrador

La gestión conectada guarda padrón, listas, candidatos, fotografías privadas y
credenciales en Supabase. La portada institucional es `/`; la portada ficticia se
conserva en `/demostracion` y sus demás rutas originales. El menú principal lleva
al sistema autorizado. Cada elección identifica su modalidad: pruebas o
institucional. Retirar rótulos globales de demostración no aprueba una elección.

## Lo que se prepara en esta entrega

- Personal con contraseña y MFA puede crear un borrador institucional sin activar
  votos. Un elector o una sesión AAL1 no pueden hacerlo.
- En borrador institucional se permite editar padrón, listas y candidatos,
  registrar medios privados y preparar credenciales con los controles existentes.
  La variable de activación oficial ya no bloquea esa preparación en borrador.
- La apertura oficial sigue exigiendo aprobación de seguridad en PostgreSQL y
  habilitación explícita en el servidor. No se concedió a la aplicación permiso
  de aprobar, convertir elecciones ni saltar esas barreras.
- Las elecciones de prueba siguen admitiendo únicamente identidades ficticias.
  Los datos y resultados ficticios no se convierten en oficiales.

No se cargaron estudiantes reales, no se ejecutó SQL en el proyecto alojado y no
se cambiaron variables de Vercel ni se desplegó. Las pruebas automatizadas usan
solo electores ficticios, también cuando ejercitan el modo institucional.

## Paso inmediato del administrador

En la pantalla «Verificación del comité», pulsar preparar MFA. Inscribir el QR con
una aplicación autenticadora si no hay factor verificado, e introducir su código.
La gestión real empieza en `/sistema`, después de esa verificación; no se elimina
MFA para salir de la demostración. El panel ofrece «Preparar elección» y
«Estado de preparación institucional».

## Migración adicional 005, pendiente de ejecución manual

Revisar y aplicar únicamente:

`supabase/migrations/202610210005_institutional_drafts.sql`

Las migraciones 001–004 ya instaladas **no se modifican ni se vuelven a ejecutar**.
La aplicación no ejecuta esta migración. Si falta, crear el borrador institucional
muestra una indicación para aplicarla; no sustituye silenciosamente la modalidad.

Compatibilidad:

- No borra ni transforma elecciones, estudiantes, cuentas, candidatos o votos.
- Sustituye la unicidad colegio/año por colegio/año/modalidad. Una elección de
  prueba de 2026 puede coexistir con una institucional de 2026; sigue habiendo
  como máximo una de cada modalidad por colegio y año. Los registros existentes,
  ya únicos bajo una regla más estricta, son compatibles. Las relaciones actuales
  referencian el UUID, no la clave sustituida.
- Añade una RPC con SECURITY DEFINER y search_path fijo, solo para authenticated
  con membresía de personal y AAL2 verificados en SQL. PUBLIC, anon y service_role
  no tienen ejecución concedida. No crea tablas ni modifica las políticas RLS.
- Inserta exclusivamente state=draft, purpose=official, security_approved=false,
  además de auditoría administrativa sin datos del padrón ni preferencias.
- Todo ocurre en una transacción. Cambiar el índice de unicidad requiere bloqueo;
  revisar una ventana sin actividad electoral y respaldos antes de aplicarla.

No utilizar esta migración en una elección en curso sin revisión del operador.
No dar grants amplios ni exponer electoral_private o ballot_box en Data API.

## Preparar el proceso de 2026

Después de publicar el código revisado y aplicar 005 en el proyecto correcto:

1. Entrar con personal y MFA, crear modalidad institucional y año 2026.
2. Confirmar «Borrador» y «Aprobación de seguridad pendiente».
3. Revisar autorización institucional para tratar datos de menores, cuentas,
   fotografías, acceso del comité, retención y custodia de archivos.
4. Importar el padrón autorizado de hasta 230 estudiantes: código único, nombre,
   grado y sección. Revisar las 15 secciones antes de emitir credenciales. No
   subir archivos ni fotografías reales a GitHub, capturas o informes públicos.
5. Crear o verificar manualmente las cuentas Auth mediante el operador autorizado
   y vincular sus UUID; no usar service_role en el navegador ni claves en Excel.
6. Completar listas, cargos, propuestas, fotografías consentidas y símbolos.
7. Preparar credenciales individuales y confirmar su entrega supervisada. No
   exportar tokens a planillas ni registrarlos en URLs, logs o analítica.

Mantener en Vercel Production:

```text
ELECTORAL_RPC_VOTING_ENABLED=false
ELECTORAL_OFFICIAL_VOTING_ENABLED=false
```

La preparación puede funcionar con ambos valores false. No se añade una variable
que permita saltar la aprobación. `/sistema/preparacion` muestra los valores
actuales del servidor y el número de elecciones oficiales abiertas que devuelve
la consulta autorizada; no certifica por sí mismo la configuración externa.

## Antes de abrir la elección oficial

Se requiere evidencia del proyecto alojado: MFA real, RLS y permisos de Auth/Data
API/Storage, fotos existentes inaccesibles a usuarios ajenos, resultados bloqueados
antes del cierre, doble voto y concurrencia en conexiones PostgreSQL independientes,
recuperación supervisada de credenciales, cierre concurrente, fallos y reintentos.
Las pruebas locales son necesarias y no sustituyen ese ensayo alojado controlado.

Además deben revisarse logging de proveedores, protección de menores, límites de
solicitudes, backups/restauración, disponibilidad del plan gratuito, respuesta a
incidentes y las limitaciones del secreto ante operadores, WAL y respaldos.
Registrar revisión independiente y autorización institucional antes de aprobar.
La aplicación no permite aprobar seguridad; esa decisión corresponde al operador
con evidencia y autorización. Esta entrega no abre la elección ni da instrucciones
para saltar la revisión activando interruptores.

Los flags de la aplicación no bloquean por sí solos una RPC directa de una
elección ya abierta/aprobada. Si existiera una, detenerla exige el cierre real
en PostgreSQL por personal autorizado; ocultar botones no es suficiente.

## Verificación local

Las pruebas usan PostgreSQL local con migraciones 001–005, incluyendo RLS y Auth
simulados únicamente en la base desechable. Comprueban coexistencia de modalidades,
permisos AAL2, auditoría, rechazo de duplicados y apertura oficial no aprobada.
Las pruebas del navegador usan el SDK real con proveedor HTTP ficticio para
crear el borrador, importar 230 identidades ficticias y verificar que emisión y
resultados siguen bloqueados. Nunca ejecutar fixtures en Supabase alojado.
