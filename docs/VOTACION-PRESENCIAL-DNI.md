# Votación presencial con DNI y varias computadoras

Esta modalidad requiere supervisión presencial del comité. El DNI identifica un registro, **no acredita por sí solo la identidad**. El alumno no necesita cuenta, contraseña ni credencial individual. Las cuentas y credenciales anteriores siguen funcionando para las elecciones que conservan la modalidad individual.

## Estado y aplicación manual

El código prepara la migración **006**, no ejecuta SQL remoto, no cambia los indicadores de Vercel ni abre elecciones. Conserva las migraciones 001–005 ya aplicadas. Un operador debe revisar y ejecutar `supabase/migrations/202610210006_supervised_dni.sql` una sola vez, después de 005. Hace falta una copia de seguridad y probar primero en un proyecto de ensayo con datos ficticios. Agrega dos tablas privadas con RLS sin acceso directo, un indicador de modalidad y RPC acotadas. Actualiza las funciones de apertura para mantener todas las validaciones existentes, excepto las cuentas/credenciales individuales cuando se elige expresamente DNI presencial. Las elecciones existentes conservan `supervised_dni=false`.

No habilites Anonymous Sign-Ins en Supabase Auth: este diseño no crea usuarios anónimos. La RPC de mesa admite el rol PostgreSQL `anon` solo mediante una habilitación aleatoria de 384 bits, distinta por computadora; las RPC del comité exigen cuenta autorizada y AAL2. El cliente de mesa se crea en el servidor con la clave publicable y nunca recibe la sesión administrativa.

Mantén los esquemas `electoral_private` y `ballot_box` fuera de los esquemas expuestos de Data API. No otorgues permisos directos sobre las tablas nuevas ni amplíes las políticas de Storage. La nueva modalidad no modifica las políticas de fotografías: la papeleta presencial presenta número, lista y candidato a alcalde, sin publicar fotos privadas.

## Padrón Excel

Una hoja `.xlsx`, máximo 230 alumnos y 2 MB. Columnas en este orden:

| dni | nombre | grado | seccion |
| --- | --- | --- | --- |
| 00000001 | Estudiante ficticio 001 | 1 | A |

El identificador mostrado es exclusivamente un ejemplo ficticio para pruebas. Formatea **toda la columna DNI como Texto antes de escribir/importar**, ocho dígitos, incluidos los ceros iniciales. No se aceptan celdas numéricas ni se completan ceros adivinando el documento. Se rechazan duplicados, fórmulas, estructuras inesperadas, grados fuera de 1–5 y secciones distintas de A/B/C. Los 230 registros pueden mezclar grados y secciones en una sola hoja; no hay que crear una elección por grado. Para cargar archivos por grado o sección, selecciona **Agregar grado/sección sin borrar registros**. Cada archivo agrega nuevos DNI y conserva los grados anteriores, con un máximo total de 230. Un DNI ya existente rechaza el lote entero; corrígelo desde el panel, no reimportándolo. La opción **Reemplazar padrón completo** borra el padrón anterior y revoca sus credenciales: úsala solo para una carga integral. La corrección solo se admite en borrador.

En el panel de la elección institucional, importa el Excel y abre **Mesas · DNI → Usar DNI presencial**. También puedes activar la modalidad con el padrón vacío y después importarlo. La apertura exige los 230 electores y listas/candidaturas completas. No requiere crear 230 cuentas Auth ni emitir 230 contraseñas.

Los DNI se guardan en el campo interno `code`, protegido como el resto del padrón. No se publican nuevos padrones ni documentos en Git. La carga de datos reales exige autorización institucional y medidas de privacidad; las pruebas incluidas usan exclusivamente registros ficticios.

## Preparar equipos y supervisar

1. El administrador/comité entra con contraseña y MFA en un equipo de control exclusivo.
2. En **Mesas · DNI** crea una habilitación distinta por computadora, con un nombre reconocible. Se muestra una sola vez y caduca en ocho horas. Solo se almacena su SHA-256 en PostgreSQL.
3. En cada computadora de votación abre otro navegador o perfil exclusivo, **sin ninguna sesión administrativa**, en `https://municipio-escolar-gold.vercel.app/sistema/mesa`. Introduce su habilitación una vez. No la envíes por URL, capturas, analítica o mensajería. El navegador recibe únicamente una cookie HttpOnly, Secure en HTTPS, SameSite Strict y limitada a `/sistema/mesa`.
4. Cada alumno introduce solo su DNI. El equipo muestra espera; no revela el nombre a cualquiera que pruebe documentos. El comité actualiza los turnos en su panel, comprueba físicamente documento/persona y equipo, y autoriza el turno correcto. Puede cancelar un turno equivocado o revocar un equipo.
5. Solo después de la comprobación aparece el nombre y la papeleta en el equipo del alumno. El alumno confirma que es su nombre, elige lista o blanco, revisa y confirma su voto. La autorización dura dos minutos; la solicitud pendiente, cinco. El comité nunca recibe la selección.
6. Tras confirmar, aparece únicamente «Participación registrada». Pulsa **Terminar y limpiar pantalla** antes del siguiente alumno. Ante una respuesta perdida usa **Comprobar estado**, nunca reenvíos automáticos.
7. Todas las computadoras deben usar la **misma elección**. PostgreSQL registra participación y papeleta en una sola transacción. La clave única de participación y los bloqueos impiden votos duplicados. La autorización simultánea del mismo alumno en dos equipos también se rechaza. El cierre espera transacciones que ya adquirieron el bloqueo de elección y rechaza las posteriores.

La habilitación del equipo es un secreto de posesión, **no una certificación del dispositivo**. Quien la copie podrá usar esa mesa hasta revocación/caducidad; por eso se configura presencialmente y no se comparte. Una cuenta de comité comprometida puede autorizar identidades indebidamente. No es un sistema de votación remota usando DNI.

## Indicadores de activación

Conserva inicialmente en Vercel:

```text
ELECTORAL_SUPERVISED_DNI_ENABLED=false
ELECTORAL_RPC_VOTING_ENABLED=false
ELECTORAL_OFFICIAL_VOTING_ENABLED=false
```

La preparación del padrón y de los equipos no activa esos indicadores. Para un **ensayo aislado** se requieren los dos primeros en `true`, una elección de propósito `test` y abierta mediante los controles existentes. El importador de elecciones `test` mantiene la restricción de plantilla DEMO; para ensayos del nuevo padrón usa los tests PostgreSQL locales incluidos o prepara los identificadores ficticios en un proyecto de ensayo bajo control del operador. No introduzcas documentos reales para superar esa restricción.

Una elección oficial además exige aprobación de seguridad en la base, habilitación oficial explícita y apertura deliberada. Este cambio **no concede esa aprobación**. No modifiques esos estados ni indicadores de producción hasta revisar las pruebas de seguridad alojadas, consentimiento, procedimientos de mesa y cierre/contingencias.

Las habilitaciones de equipo caducadas o revocadas requieren crear otra. No se solicita DNI para recuperar contraseñas administrativas. La recuperación Auth/MFA existente permanece intacta.

## Acta después del cierre

**Resultados** continúa consultando la función SQL protegida. Ningún rol de aplicación obtiene conteos por lista antes del cierre. Después del cierre, el acta PDF se genera con institución, año, identificador de elección, electores, votantes, pendientes, participación, votos por lista, blancos, lista con mayor votación y nombre de su candidato a alcalde. Un empate se identifica como empate, sin inventar ganador.

Antes de descargar, selecciona la insignia real de la institución (PNG/JPEG, hasta 1 MB) y consigna nombres del director, comité, apoyo electoral, miembros de mesa y representante ganador. Se incluyen espacios de firma. Estos datos se usan en esa descarga y no se persisten ni se suben a Supabase. No se inventan insignias, firmas ni acreditación ONPE. El PDF es un acta para revisión y firma, no una proclamación oficial ni una firma electrónica. La exportación Excel conserva el recuento agregado sin DNI ni nombres de votantes.

## Operación, privacidad y verificaciones pendientes

- Usa HTTPS, equipos controlados, pantallas fuera de la vista del comité durante la selección y bloqueo del panel de control. No instales analítica, grabación de sesiones o captura de formularios en `/sistema`.
- No registres cuerpos de Server Actions/RPC, tokens, DNI ni elecciones individuales. Revisa también proveedores, proxies, monitoreo y configuración de PostgreSQL/Supabase; el código no puede garantizar su política de logs. No actives trazas de parámetros para investigar votos.
- Se permiten cinco solicitudes de DNI por minuto por mesa; la limitación persiste incluso ante documentos inexistentes. Antes de uso oficial verifica además límites de infraestructura frente a abuso, rotación/revocación y recuperación ante pérdida de red. No existe detección criptográfica de un dispositivo clonado.
- La papeleta no guarda DNI, elector, equipo, turno, actor ni fecha. Participación y turno no guardan selección. Aun así, operadores privilegiados de base/infraestructura pueden correlacionar transacciones, tiempos y WAL; este límite del secreto electoral permanece.
- RLS no protege contra el propietario de la base. Los secretos de equipos no dan acceso al padrón completo ni al panel administrativo. Los nombres solo aparecen tras autorización y deben limpiarse al terminar cada turno.
- Antes de abrir producción prueba en Supabase alojado las cookies en navegadores separados, MFA y recuperación, revocación/caducidad, doble voto y cierre concurrente, bloqueos de resultados y fotos. Las pruebas locales no certifican la configuración alojada. La apertura oficial sigue pendiente de esa validación y decisión institucional.

## Verificación de esta implementación

Aprobados `npm run lint`, `npm run type-check` y `npm run build`. Las suites suman 70 pruebas: 18 unitarias, 17 con PostgreSQL real local, 24 de integración SDK/HTTP contra un fixture local y 11 de navegación/demostración. Para las pruebas de navegador en este entorno se usó `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`.

Se ensayaron 230 electores ficticios, votos desde dos mesas, doble envío, autorizaciones simultáneas sobre el mismo DNI, cierre concurrente, reversión de participación cuando falla la papeleta, expiración/revocación, límites de solicitudes y carga sucesiva por grado. Los ensayos del SDK usan un servidor HTTP ficticio y no se presentarán como comprobaciones del Supabase alojado.
