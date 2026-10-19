# Seguridad electoral y estado de integración

## Alcance y estado verificable

I.E. ESTEBAN PAVLETICH TRUJILLO, Educación Secundaria, 2026, 230 electores y
15 secciones (1.º a 5.º, A/B/C). No hay conexión a Supabase real ni Vercel.

La web sigue siendo una demostración con datos ficticios en memoria. Las listas,
regidores, padrón y fase se comparten al navegar, pero desaparecen al recargar.
La selección de voto no se envía, almacena ni convierte en participación oficial.
La simulación administrativa no autentica personas; no habilitarla con datos reales.

El backend SQL sí está implementado y probado en PostgreSQL 17 local con múltiples
conexiones. Auth y Storage se representan con esquemas/roles de prueba para validar
SQL y RLS; no se ha verificado todavía la integración HTTP/JWT/Storage del proyecto
Supabase real. El flujo completo de sesiones y entrega real no está conectado.

## Tablas y separación de datos

- `electoral_private.elections`, `classrooms`, `electors`: elección, 15 secciones
  y padrón. Código y usuario autenticado son únicos por elección. La capacidad de
  apertura es exactamente 230; borradores incompletos pueden corregirse.
- `electoral_private.choices` representa las listas existentes, conservando su
  identidad para compatibilidad. Tiene número único, propuestas y símbolo privado.
- `electoral_private.candidates`: alcalde y regidores, cargo, orden, grado, sección
  y fotografía. Una posición por lista; la alcaldía ocupa 0 y regidurías 1–20.
  Ese límite técnico no sustituye las reglas institucionales de composición.
- `electoral_private.media_assets`: rutas opacas y confirmación administrativa de
  autorización. No se guardan imágenes ni documentos de consentimiento en Git.
- `electoral_private.credentials`: hash SHA-256, caducidad, versión aleatoria,
  confirmación de entrega y consumo. Nunca token original.
- `electoral_private.participations`: elección e identidad; clave única por elector.
- `ballot_box.ballots`: UUID aleatorio, elección y lista o NULL para blanco. No
  contiene alumno, código, token, participación, timestamp ni secuencia compartida.
- `electoral_private.admin_audit`: actor administrativo, acción, entidad, elección
  y hora. Sin nombres de estudiantes, tokens, hashes ni preferencias de voto.

No existe clave que una una papeleta con su elector. La participación y la
papeleta se insertan en una transacción para garantizar integridad; esa misma
transacción permite correlación a operadores con acceso a WAL/infraestructura.

## Roles, RLS y SECURITY DEFINER

Todas las tablas propias tienen RLS. Al finalizar las migraciones, los roles de
aplicación no tienen acceso directo a esas tablas, tampoco el administrador de la
web. `anon` no ejecuta RPC electorales. `authenticated` puede invocarlas, pero cada
operación administrativa comprueba la membresía en `administrators` con `auth.uid()`.
El voto y su estado se limitan al elector vinculado con esa identidad autenticada.
El recuento requiere administrador y cierre oficial. No hay registro público de
administradores ni uso de metadatos de perfil editables para conceder permisos.

Los esquemas privados permanecen fuera de la Data API. Solo las RPC públicas
controladas son la vía de gestión. Las funciones privilegiadas fijan
`search_path=pg_catalog` y califican tablas y helpers; no interpolan datos de
usuarios en SQL dinámico. El bloque de permisos usa firmas del catálogo, no entrada
externa. Las nuevas funciones revocan EXECUTE de PUBLIC/anon y otorgan a
`authenticated` únicamente después de definir las comprobaciones internas.
Se revocan permisos explícitos de service_role sobre tablas/esquemas propios y RPC
electorales; ninguna clave service_role se necesita ni se expone al navegador.

El dueño de tablas/funciones sigue teniendo acceso privilegiado. RLS no protege
contra el propietario, superusuarios o intervenciones de infraestructura. No
activar FORCE RLS sin rediseñar los helpers que dependen del acceso interno.
La activación automática de ENABLE RLS es compatible y se simula en las pruebas;
no conceder políticas permisivas de conveniencia. Las políticas restrictivas de
Storage limitan el bucket electoral incluso ante una política permisiva previa.

## Padrón y candidaturas

La importación XLSX valida una hoja, cuatro columnas (`codigo`, `nombre`, `grado`,
`seccion`), hasta 230 registros y 2 MB. Rechaza fórmulas, enlaces y celdas complejas.
Hay vista previa, normalización de códigos, detección de duplicados y validación
de las 15 secciones. La web pública solo acepta la plantilla ficticia DEMO-NNN.
Antes del parser se comprueba la expansión ZIP de forma incremental: máximo
128 entradas, 2 MB por entrada y 8 MB en total, sin macros ni archivos binarios.
El servidor conectado deberá repetir las validaciones, limitar tiempo/memoria y
no confiar en comprobaciones realizadas únicamente en el navegador.

La RPC `replace_electoral_roll` reemplaza el padrón en una transacción y revierte
todo si una fila es inválida. Las correcciones revocan la credencial del registro.
La elección se bloquea primero desde las RPC administrativas; triggers impiden
correcciones e importaciones después de abrir. La apertura valida padrón completo,
identidades vinculadas, entregas, listas y autorizaciones de medios.
No se comprueba elegibilidad normativa de candidatos ni una composición legal
específica del concejo: esas reglas deben aprobarse antes del uso institucional.

## Credenciales y entrega individual

`prepareElectoralCredential` usa 32 bytes aleatorios criptográficos: 256 bits,
base64url de 43 caracteres. El servidor conserva únicamente SHA-256; la utilidad
no realiza red ni escribe archivos. `issueCredential` registra el hash mediante
un transporte RPC con sesión verificada y devuelve el token al flujo supervisado.
No acepta roles o identidad del navegador como prueba de autorización.

Cada emisión/recuperación crea una versión nueva, invalida el hash anterior y deja
la entrega sin confirmar. `confirm_electoral_delivery` exige administrador y la
versión vigente. Una confirmación antigua no puede activar una credencial nueva.
La credencial no permite votar hasta confirmar la entrega. No existen exportaciones
masivas de tokens ni endpoints públicos de emisión en la aplicación actual.

La recuperación está permitida en borrador y elección abierta solo para quien no
ha participado. Bloquea elección y elector, conserva la unicidad de participación
incluso al competir con un voto y caduca en un máximo de 24 horas. No reabre una
elección cerrada ni elimina participaciones. La expiración usa reloj real después
de esperar bloqueos, no solo el inicio de la transacción.

El flujo conectado deberá verificar al destinatario, entregar una vez por canal
individual y confirmar la entrega desde una sesión autorizada. Nunca usar DNI,
código escolar ni tokens deterministas de tests como contraseña. Un operador
malicioso con capacidad de emisión sigue siendo un riesgo organizativo.

## Voto, errores y concurrencia

La confirmación de la interfaz precede a la operación de voto; se admite blanco.
`cast_electoral_vote` exige elección abierta, identidad vinculada, token correcto,
entregado y vigente, y ausencia de participación. Bloquea la elección FOR SHARE,
luego elector y credencial FOR UPDATE. Inserta participación/papeleta y consume
credencial en una única transacción. Una clave única de participación impide el
segundo voto incluso con dos conexiones y dos solicitudes simultáneas.

El cierre obtiene un bloqueo incompatible: espera los votos que ya entraron o
impide los que llegan después. Recuperación y voto siguen el mismo orden de
bloqueos y no reactivan electores que ya votaron. Los fallos intermedios revierten
participación, papeleta y consumo.

`submitVote` no reenvía preferencias automáticamente: consulta únicamente el
estado de participación para resolver una respuesta perdida. Distingue registro,
rechazo, fallo transitorio con posible reintento explícito y estado desconocido.
Si devuelve registro tras consultar el estado, solo confirma participación, no
el contenido de la papeleta. No retorna SQL, argumentos o excepciones originales
a la interfaz. El llamador no
debe registrar el cuerpo de solicitudes ni la combinación identidad-selección.

## Recuento, empate y exportaciones

`get_electoral_results` comprueba autorización y estado `closed` en SQL antes de
leer papeletas, incluso para administradores de la aplicación. Devuelve agregados:
votos por lista y blancos, electores, votantes, pendientes y porcentajes. Los
porcentajes por opción incluyen blancos en el denominador; la participación usa
el total de electores. Con cero votos, los porcentajes son cero. Los empates se
representan como varias listas con mayor votación; cero preferencias no proclama
una lista ganadora. Quórum, desempate y proclamación son reglas del comité.

La interfaz muestra barras y genera PDF/Excel marcados como demostración solo
tras su cierre simulado. Las cifras de ejemplo son independientes de la selección
local. Las bibliotecas de exportación son funcionales, pero no constituyen actas
oficiales firmadas ni una conexión al recuento remoto. El recuento SQL se prueba
por separado con 230 votos ficticios.

## Protección de fotografías y datos de menores

El bucket `electoral-media` es privado, limita a JPEG/PNG/WebP y 5 MB. Las rutas
usan UUID y no nombres de estudiantes. La utilidad de servidor
`preparePrivateElectoralImage` valida formato/píxeles, redimensiona y convierte a
WebP eliminando EXIF/GPS. La integración preparada en `/sistema` lo aplica antes
de subir y al servir los archivos; el proyecto alojado aún no está configurado.

Solo administradores pueden gestionar medios en borrador. Los electores vinculados
pueden leer medios autorizados en elección abierta/cerrada; anónimos y ajenos no.
No hacer público el bucket ni usar URLs firmadas de larga duración. La autorización
no evita capturas de imágenes por personas que ya tienen acceso. Las imágenes
públicas del repositorio son referencias de adultos, no estudiantes del colegio.

Minimizar los datos, documentar finalidad y autorización institucional, restringir
personal autorizado, definir retención/eliminación y proteger respaldos. No poner
Excel, fotos de menores, documentos de consentimiento, tokens o credenciales en
GitHub. La evidencia de autorizaciones se custodia fuera del repositorio.

## Límites del secreto y requisitos de conexión

No hay anonimato criptográfico contra el operador de base de datos, servidor,
WAL, logs, tráfico, respaldos o instrumentación que capture identidad y opción.
Antes de la elección real se necesita revisión independiente de ese riesgo,
segregación de funciones y autorización del comité. La auditoría de la aplicación
no agrega preferencias, pero no controla el registro de proveedores externos.

Orden de instalación y requisitos: `supabase/README.md` y
`docs/ACTIVACION-SUPABASE.md`. Antes de activar el proyecto alojado falta validar
Auth/JWT/TOTP, las sesiones y la entrega individual real,
configuración de logs sin cuerpos/argumentos de voto, límites de solicitudes,
protección CSRF según el flujo, HTTPS, timeouts, respaldo/restauración y validación
HTTP de Data API/Storage con roles reales de prueba. No asumir que el plan gratuito
incluye todos los mecanismos de disponibilidad o recuperación necesarios.

## Validación reproducible

- `npm run test:unit`: validadores, credenciales, errores, exportaciones, medios y
  regresión de la migración inicial en PGlite.
- `npm run test:postgres`: PostgreSQL 17 desechable en Docker, conexiones con PID
  distintos, doble voto simultáneo, cierre concurrente en ambos órdenes,
  recuperación concurrente, entrega versionada, rollback, RLS automática,
  Storage restrictivo y 230 votos ficticios con recuento completo.
- `npm run test:smoke`: navegador, confirmación de voto, padrón, gestión, entrega
  ficticia y exportaciones PDF/Excel.

El runner PostgreSQL crea y elimina solo su propio contenedor; publica un puerto
aleatorio exclusivamente en loopback. No acepta URLs externas ni bases cuyo nombre
no sea `municipio_electoral_test`. Usa autenticación de confianza solo en ese
contenedor local desechable. No reutilizar su configuración en producción.

## Integración Next.js preparada tras la migración 004

La implementación conectada está en `/sistema`, aislada del estado ficticio de la
demostración. El servidor usa el SDK oficial con la clave publicable y la sesión
del usuario; no necesita service_role. Cada consulta y mutación verifica al usuario
con `auth.getUser()` y comprueba contexto y permisos mediante RPC; no confía solo
en la cookie o en `getSession`. Las sesiones usan HttpOnly, SameSite Lax y Secure
en HTTPS. Las páginas/medios son dinámicos, sin caché pública, sin indexación y con
protección frente a incrustación y referencias entre sitios.

La 004 exige AAL2 para personal en la propia autorización SQL, no solo en la
interfaz. Las mutaciones tienen comprobación de origen canónico y validación del
servidor. Los XLSX se procesan y validan de nuevo antes de la RPC transaccional.
Los medios se sanean antes de subir y al descargar con una sesión autorizada;
no se crean enlaces públicos o enlaces firmados que permitan eludir ese control.

La creación desde la aplicación es exclusivamente de elecciones de pruebas.
`purpose` y `security_approved` no tienen escritura por roles de aplicación; una
elección oficial sin aprobación no puede abrirse. Los interruptores de entorno
están apagados por defecto y no sustituyen esa barrera SQL. No se ha activado
ninguna elección oficial. Si una elección ya está abierta, detenerla exige cerrar
su estado en la base de datos; apagar una pantalla no cancela las RPC directas.

La integración se ha probado contra simuladores locales y PostgreSQL, no contra
el proyecto Supabase real. Requisitos pendientes y pasos exactos:
`docs/ACTIVACION-SUPABASE.md`. La guía no autoriza el uso de información de menores
ni certifica anonimato contra operadores o infraestructura.
