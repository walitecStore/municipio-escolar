# Plataforma para varias instituciones y aplicación instalable

## Modelo implementado

Una misma dirección web y un mismo proyecto Supabase alojan varias instituciones. Cada institución tiene identificador propio, perfil, personal autorizado y elecciones. El vínculo se comprueba en PostgreSQL mediante `auth.uid()` y las asignaciones privadas; cambiar una URL o un campo del navegador no concede acceso a otro colegio.

El operador de la plataforma incorpora instituciones y asigna al encargado. El encargado inicia sesión, verifica MFA, completa el perfil institucional y prepara sus elecciones. El registro público de usuarios permanece deshabilitado. Cada cuenta institucional pertenece a un solo colegio; si una persona trabaja en varios colegios, se asignan cuentas institucionales separadas.

Los administradores existentes de la tabla histórica `electoral_private.administrators` con rol `administrator` conservan el acceso de **operador de plataforma**, que puede administrar todas las instituciones. El comité histórico mantiene acceso a la institución inicial. Los nuevos encargados se asignan exclusivamente mediante `institution_staff` y los formularios autorizados. **No insertes los encargados nuevos en la tabla histórica de administradores: eso les otorgaría privilegios de operador.**

El aislamiento aplica a padrón, resúmenes, candidaturas, credenciales, mesas, auditorías y resultados. Las políticas restrictivas de Storage consultan la pertenencia a la elección. La papeleta sigue separada de identidad/mesa/turno y los resultados por lista permanecen bloqueados hasta el cierre. Los operadores de la plataforma y los propietarios de infraestructura son actores privilegiados; no se promete secreto frente a ellos ni frente a correlación de transacciones/WAL.

## Actualización desde la versión actual

La aplicación no ejecuta migraciones ni modifica servicios externos. Si ya aplicaste 001–006:

1. Respalda el proyecto y ensaya primero en una base separada con datos ficticios.
2. Revisa y ejecuta **una vez** `supabase/migrations/202610210007_institutional_configuration.sql`.
3. Después revisa y ejecuta **una vez** `supabase/migrations/202610210008_institution_isolation.sql`.
4. No repitas 001–006. Mantén `electoral_private` y `ballot_box` fuera de los esquemas expuestos de Data API. No concedas acceso directo a las tablas nuevas.
5. Comprueba que la elección institucional existente conserva el padrón, sus identificadores, la modalidad DNI, estado `draft` y `security_approved=false`. La actualización asigna los registros anteriores a la institución inicial sin borrarlos ni abrir elecciones.
6. Despliega el código revisado y realiza las comprobaciones alojadas descritas abajo antes de considerar una elección oficial preparada.

007 elimina el límite rígido de 230 y usa `expected_students` por elección (1–10000). Preserva el total 230 en los registros actuales. Las reglas de apertura, reemplazo y agregado validan el total de la elección. Solo se cambia configuración en borrador; no se reduce por debajo del padrón cargado. El total es el padrón definitivo previsto, no un modo de omitir electores pendientes.

008 agrega instituciones, personal y auditoría institucional con RLS, asigna la institución a las elecciones existentes, impide trasladar elecciones entre colegios y cambia permisos/RPC para comprobar el alcance institucional. No renombra ni elimina personas, listas, fotografías o votos.

## Incorporar otro colegio

1. El operador verifica al responsable y su correo institucional fuera de la aplicación.
2. En Supabase Auth crea una cuenta del responsable. Usa una contraseña inicial aleatoria que no se comparta en chat, y confirma la cuenta únicamente tras verificar al responsable y su correo. El encargado puede usar **Olvidé mi contraseña** para establecer su propia contraseña mediante el flujo de recuperación ya implementado; no necesita recibir la contraseña inicial. No dependas de enlaces de invitación distintos del flujo de recuperación documentado.
3. Copia solamente el UUID de la cuenta (no contraseñas, tokens o claves).
4. En **Panel electoral → Mi institución y equipo → Registrar otra institución**, indica nombre, UUID del encargado y electores previstos.
5. El encargado establece su contraseña si corresponde, inicia sesión y configura/verifica el autenticador MFA. En **Mi institución y equipo** completa el nombre y el total previsto.
6. En **Preparar elección** selecciona su institución, año y total definitivo. Se crea un borrador institucional en modalidad DNI; no se abre ni se aprueba su seguridad automáticamente.
7. Carga el padrón mediante Excel, listas y candidatos. La estructura académica soportada en esta entrega sigue siendo **Secundaria, grados 1–5 y secciones A/B/C**. No se presenta como soporte de Primaria, Inicial o secciones adicionales: requerirían extender esquema, importador, formularios y pruebas.
8. Para sumar miembros del comité, crea sus cuentas Auth y utiliza **Asignar o revocar personal autorizado** dentro del colegio. La revocación se consulta en la base para nuevas operaciones; los encargados no pueden quitarse a sí mismos ni asignar una cuenta perteneciente a otro colegio.

Actualizar el perfil afecta nuevas elecciones. Los datos de una elección existente y su acta se configuran en **Configuración**, únicamente mientras esté en borrador. Cada elección conserva sus datos históricos. El operador revisa duplicados de instituciones y legitimidad de encargados; la plataforma no acredita automáticamente identidad legal de un colegio.

## Interfaz operativa

La interfaz pública no muestra recorrido de demostración, simuladores, electores ficticios ni selector de elecciones de ensayo. Las rutas antiguas redirigen al sistema. Tampoco se inicializa el padrón ficticio en la sesión de producción.

El material histórico de demostración se conserva exclusivamente para regresiones automatizadas en un entorno explícito de loopback; no se habilita en dominios públicos aunque se cambie el indicador. Las pruebas automatizadas no se confunden con datos institucionales ni se insertan en Supabase alojado. No se eliminan registros existentes de la base solo por cambiar su presentación.

Los mensajes sobre borrador, aprobación pendiente, elección cerrada y bloqueo de resultados son estados reales del proceso y se mantienen. Quitar esos controles no convierte una elección en válida.

## Vercel y Supabase Auth

Conserva las variables de conexión existentes, `APP_ORIGIN` exactamente igual al origen HTTPS del despliegue, la configuración de recuperación de contraseña y el proveedor SMTP ya validado. No agregues `service_role`, claves secretas ni contraseñas al navegador.

La identidad pública de la plataforma se configura con:

```text
ELECTORAL_INSTITUTION_NAME=Plataforma de Municipios Escolares
ELECTORAL_INITIAL_YEAR=2026
ELECTORAL_EXPECTED_STUDENTS=230
ELECTORAL_DEMO_ENABLED=false
```

El nombre y el total de **cada colegio** se guardan en su perfil privado, no en estas variables compartidas. El total global de ejemplo es solo un valor inicial de formularios; no cuenta estudiantes ni modifica padrones.

Mantén Email/Password y TOTP habilitados y el registro público deshabilitado. Usa las Redirect URLs de `docs/RECUPERACION-CONTRASENA.md` y `docs/RECUPERACION-ENLACES-SEGUROS.md` para el dominio real. La instalación PWA utiliza el mismo origen y no exige una URL de Auth distinta.

Los indicadores `ELECTORAL_RPC_VOTING_ENABLED`, `ELECTORAL_OFFICIAL_VOTING_ENABLED` y `ELECTORAL_SUPERVISED_DNI_ENABLED` siguen en `false` en `.env.example`. Los indicadores son compartidos por despliegue: el estado y la aprobación de **cada elección** siguen siendo comprobaciones independientes de base. Ningún encargado puede aprobar seguridad cambiando su perfil. Las elecciones oficiales requieren la aprobación del operador autorizado de base después de los ensayos alojados y la apertura deliberada; no hay activación automática en esta entrega.

## Instalar como aplicación

La PWA incluye manifiesto, iconos y botón **Instalar aplicación** en la portada:

- Android/Chrome o computadora/Chrome/Edge: instalar desde el botón o menú del navegador.
- iPhone/iPad: Safari → Compartir → Añadir a pantalla de inicio.

Se abre con un icono y una ventana propia. No es un APK nativo ni una publicación en Play Store/App Store. La instalación y los avisos disponibles dependen del navegador y requieren HTTPS fuera de localhost.

La aplicación **requiere internet**. El service worker no usa Cache Storage, IndexedDB, localStorage, sincronización de fondo ni cola de votos. Solo intercepta navegaciones GET para mostrar un aviso de conexión ante fallos. No almacena respuestas autenticadas ni intercepta operaciones POST. Las cookies de sesión siguen siendo HttpOnly y las rutas protegidas mantienen `private, no-store`. Si se pierde una respuesta después de votar, comprueba el estado al volver la conexión; no repitas el voto automáticamente.

## Validación y condiciones para uso oficial

Ejecuta:

```bash
npm ci
npm run lint
npm run build
npm run type-check
npm run test:unit
npm run test:postgres
npm run test:connected
npm run test:smoke
npm run test:operational
```

`test:connected` y `test:operational` comparten el puerto del fixture HTTP y se ejecutan uno después del otro. En este entorno se utilizó `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. PostgreSQL se levanta como instancia local desechable: nunca se introduce una URL de producción para estas pruebas. No se usan estudiantes reales.

Antes de abrir una elección en Supabase alojado, comprueba con cuentas institucionales separadas: MFA/recuperación, carga Excel, denegación de consultas y mutaciones cruzadas, fotografías privadas, resultados cerrados, revocación de personal/equipos, dos computadoras votando simultáneamente, doble voto, corte de red, cierre concurrente y generación del acta con insignia y firmas. Valida copias de seguridad, límites del plan, monitoreo sin parámetros sensibles, procedimientos de mesa y autorizaciones institucionales.

Las pruebas locales acreditan el comportamiento del código y SQL ensayados, no certifican automáticamente la configuración o seguridad del servicio alojado. Los datos de menores no se guardan en Git, reportes de pruebas, analítica ni registros de solicitudes.

### Resultado local de esta entrega

Aprobaron lint, build y TypeScript, además de 78 pruebas: 19 unitarias, 21 con PostgreSQL real y conexiones independientes, 24 de SDK/HTTP local, 11 de navegación/regresión y 3 del flujo operativo/PWA. La actualización desde 006 se ensayó con 15 electores ficticios: conservó filas e identificadores, estado borrador, aprobación deshabilitada y acceso del administrador. No se ejecutaron SQL ni pruebas contra Supabase alojado.
