# Registrar candidato y plana de regiduría

En el panel de la elección abre **Registrar candidato y plana de regiduría**.

1. Escribe los nombres y apellidos del candidato a la alcaldía, su grado y sección.
2. Ingresa el nombre del partido y al menos una propuesta.
3. Sube la fotografía del candidato desde el celular o computadora.
4. Sube el símbolo del partido y confirma la autorización para usar las imágenes.
5. Registra el nombre, grado, sección y cargo específico del primer regidor.
   **Siguiente regidor** permite agregar el segundo y continuar hasta veinte.
   **Terminar registro** guarda la inscripción con al menos un regidor completo.

**Atrás** permite revisar sin perder lo escrito. El borrador permanece únicamente
en la pestaña: completa el registro antes de cerrarla o recargarla. Una fila final
de regidor totalmente vacía no impide terminar si ya existen regidores completos.

No se introducen números electorales ni posiciones. La base de datos asigna el
primer número disponible de la elección y el orden de la plana. El guardado de
partido y candidatos es una sola operación: si un dato no es válido, no se guarda
una inscripción incompleta. Un reintento del mismo envío no duplica el registro.

Las imágenes admiten JPG, PNG y WebP: máximo 3 MiB por archivo y 4 MiB entre ambas.
Se previsualizan antes de guardar. El servidor comprueba su contenido, elimina
metadatos y las guarda en Storage privado con la sesión autorizada del personal.
No se suben archivos al avanzar entre pasos. Si falla el guardado posterior a la
subida, pueden quedar archivos privados sin vincular; no se borran datos como
compensación automática.

## Mostrar candidatos

La opción independiente **Mostrar candidatos** presenta foto, símbolo en una
esquina, número electoral, nombre del partido y nombre del candidato. **Ver plana
de regiduría** despliega los integrantes, sus cargos y las propuestas.

En PC, seis candidatos ocupan tres columnas y dos filas; cuatro candidatos,
dos columnas y dos filas. En tableta se muestran dos columnas y en celulares
estrechos una. Se muestran únicamente las inscripciones guardadas. Si un registro
anterior no tiene foto o símbolo, se indica sin inventar una imagen.

**Corregir registros existentes**, dentro del registro, permite editar al candidato
y a sus regidores, o agregar regidores. La edición sigue limitada al borrador.

## Activación en Supabase y Vercel

1. Con las migraciones 001–009 ya aplicadas, abre
   [202610220010_guided_slate_registration.sql](../supabase/migrations/202610220010_guided_slate_registration.sql).
2. Copia todo su contenido al editor SQL del mismo proyecto de Supabase y pulsa
   **Run** una sola vez. No vuelvas a ejecutar las migraciones anteriores.
3. Espera a que el despliegue actualizado de producción aparezca **Ready/Listo**
   en Vercel y recarga la plataforma.

No hacen falta nuevas claves ni variables de entorno. La migración conserva
padrones, candidaturas y votos existentes. No aprueba ni abre ninguna elección.
Antes de aplicar 010, la pantalla informa de la actualización pendiente y evita
iniciar un formulario que todavía no podría guardarse.

Las funciones verifican sesión, segundo factor, permiso sobre la institución y
estado de borrador. Los comprobantes de envío quedan aislados por elección y
usuario. Si una inscripción se elimina posteriormente, repetir su envío antiguo
no la vuelve a crear. La consulta de candidatos mantiene los permisos electorales
existentes; no publica imágenes ni datos privados para visitantes anónimos.

## Capturas de verificación

Estas capturas utilizan exclusivamente datos ficticios del entorno local.

![Galería de seis candidatos en PC](images/galeria-seis-pc.png)

![Galería en celular](images/galeria-candidatos-movil.png)
