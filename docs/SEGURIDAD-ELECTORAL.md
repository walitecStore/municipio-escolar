# Seguridad electoral: preparación sin servicios conectados

## Estado actual

La institución configurada es **I.E. ESTEBAN PAVLETICH TRUJILLO**, Educación
Secundaria, año inicial 2026 y meta de 230 estudiantes. Existen 15 secciones:
1.º a 5.º, cada una con A, B y C.

La web pública sigue siendo una demostración. No hay sesiones autenticadas,
servidor de gestión del padrón, almacenamiento de credenciales ni elección real.
No cargar información real. La importación pública exige los identificadores
`DEMO-NNN` y nombres `Estudiante ficticio NNN`; procesa el Excel en memoria,
sin enviarlo al servidor, localStorage o cookies. El cierre de edición es una
simulación reversible al recargar, no una frontera de seguridad.

La migración `supabase/migrations/202610190001_electoral_security.sql` es una
preparación de backend, **no está desplegada ni conectada a la web**. Se ejecuta
solo en PGlite en memoria durante las pruebas. No protege un servicio externo
hasta que se despliegue y se verifique su integración autorizada.

## Modelo de datos y permisos preparados

- `electoral_private.electors`: identidad, código único por elección, grado,
  sección y vínculo único con una identidad autenticada de `auth.users`.
- `electoral_private.classrooms`: las 15 secciones autorizadas.
- `electoral_private.administrators`: membresía administrativa. Solo un operador
  privilegiado puede concederla; no hay una ruta pública de autoasignación.
- `electoral_private.credentials`: hash SHA-256 de un token aleatorio, caducidad
  y consumo. No contiene el token original ni tiene permisos de lectura web.
- `electoral_private.participations`: solo elección e identidad; clave única por
  elector y elección. No contiene lista elegida.
- `ballot_box.ballots`: UUID aleatorio, elección y candidatura (o NULL para
  blanco). No contiene identidad, código, credencial, hora ni identificador de
  participación. No existe permiso de lectura o escritura directa desde la web.

Todas las tablas habilitan RLS. Los usuarios anónimos no tienen permisos. Los
usuarios autenticados sin membresía administrativa no pueden leer el padrón ni
cambiar sus registros. Los permisos administrativos de padrón quedan limitados
además por triggers de estado que bloquean modificaciones tras abrir la elección.
Las funciones privilegiadas fijan `search_path` y califican sus referencias;
no confían en nombres de usuario ni roles enviados desde un formulario.

## Importación y corrección

La interfaz valida encabezados `codigo`, `nombre`, `grado`, `seccion`, códigos
normalizados y únicos, nombres obligatorios y las 15 secciones. Admite solo
`.xlsx`, una hoja, hasta 230 filas y 2 MB; rechaza fórmulas, enlaces y celdas
estructuradas. Muestra errores y una vista previa antes de reemplazar el padrón.
Con menos de 230 registros permite preparar el borrador, pero no simular su cierre.
No importa campos de participación: un Excel no puede marcar a alguien como votante.

Para el backend futuro, `replace_electoral_roll` exige una sesión administrativa,
valida los datos con restricciones SQL y reemplaza el padrón en una transacción.
Cualquier error revierte también las eliminaciones. Acepta borradores incompletos,
pero la apertura exige exactamente 230 electores con identidades vinculadas,
credenciales vigentes y al menos una candidatura. Corregir un elector revoca su
credencial anterior. La apertura y las correcciones bloquean la fila de elección
para impedir que una importación pase después de abrirla.

## Emisión de credenciales preparada

`src/lib/security/credentials.ts` debe ejecutarse exclusivamente en un servidor
autorizado. Genera 32 bytes criptográficamente aleatorios (256 bits), codificados
como token base64url de 43 caracteres. Solo se conserva su hash SHA-256; el token
se entrega una vez por un canal individual y no se registra en logs, analítica,
URLs, Git, archivos públicos o exportaciones generales. La caducidad es de 24 horas.
La función `register_electoral_credential` exige administrador, identidad vinculada,
elección en borrador y caducidad válida; una reemisión sustituye el hash anterior.
El identificador del alumno o su DNI nunca son la contraseña.

No hay endpoint de emisión ni credenciales entregadas desde esta demostración.
Antes del uso real se deben implementar sesión administrativa verificada, entrega
individual, rotación previa a la apertura, recuperación supervisada y protección
contra filtrado de tokens. No utilizar los tokens deterministas de fixtures de prueba.

## Prevención transaccional del voto duplicado

`cast_electoral_vote` requiere identidad autenticada vinculada al elector y el token
correcto, vigente y no consumido. Rechaza elecciones no abiertas y candidaturas
ajenas. Obtiene un bloqueo compartido de la elección y bloqueos de fila sobre el
elector y su credencial. En la misma transacción inserta participación, inserta
la papeleta y consume la credencial. La clave primaria de participación añade una
barrera de unicidad en base de datos. Un error en cualquier escritura revierte
todas; dos envíos del mismo elector no pueden confirmarse ambos.

La función no devuelve el identificador de la papeleta. La web de demostración
**no llama a esta función**, y su selección local no cambia el padrón ni los
resultados estáticos. Los contadores reales se obtendrían de
`electoral_roll_summary`, disponible únicamente para administradores.

## Límites y pasos previos al uso real

La separación de tablas y RLS evita la unión directa identidad-papeleta por la
aplicación. No proporciona anonimato criptográfico frente al operador de base de
datos, correlación por WAL, transacciones, tráfico o registros de infraestructura.
El acceso privilegiado y los respaldos requieren controles operativos y una
revisión independiente del secreto electoral.

Antes de activar datos reales se necesita autorización expresa para conectar el
servicio, desplegar la migración en un entorno aislado de pruebas, configurar Auth,
asignar administradores por un operador, implementar las rutas de servidor y la
entrega de credenciales, comprobar RLS con JWT reales, HTTPS, protección CSRF según
el flujo de sesión, límites de solicitudes, auditoría sin identidad-papeleta,
recuentos autorizados, copias de seguridad y política de retención. Los servidores
no deben usar `service_role` para omitir la autorización de solicitudes de usuarios.
Las pruebas PGlite verifican restricciones, roles, rollback y reenvíos, pero su
conexión única serializa solicitudes: hace falta además una prueba de concurrencia
con múltiples sesiones de PostgreSQL antes de una elección real.

No se guardan archivos Excel de prueba en el repositorio; se generan en memoria.
`.gitignore` excluye hojas, CSV, carpetas privadas y exportaciones de credenciales.
Estas exclusiones no sustituyen la revisión de cambios antes de subir a GitHub.
