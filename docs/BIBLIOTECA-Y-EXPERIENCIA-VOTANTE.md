# Biblioteca de imágenes y experiencia del votante

El menú electoral usa las tarjetas grandes como acceso a cada tarea. Se retiró
la fila horizontal de pestañas de las pantallas interiores. **Volver a la elección**
regresa al menú de tarjetas, sin depender del historial del navegador.

El fondo compartido es verde claro, con texto oscuro, encabezados de distintos
colores, botones grandes y opciones de voto que resaltan al seleccionarlas.
El diseño se adapta a PC, tableta y celular y respeta movimiento reducido.

## Fotografías y símbolos

Esta tarjeta abre una biblioteca privada de la elección. Las imágenes que ya se
habían subido al almacenamiento aparecen aquí; antes no existía una galería para
consultarlas. No se necesitan rutas ni enlaces externos.

1. Abre **Fotografías y símbolos** en la elección.
2. Selecciona **Foto o símbolo desde mi equipo**, confirma la autorización y pulsa
   **Guardar en la biblioteca**. JPG, PNG y WebP: máximo 3 MB por archivo.
3. La galería se actualiza al guardar. **Actualizar imágenes** permite consultar
   archivos subidos desde otra computadora. Hay paginación de cien archivos.
4. En el registro guiado, cada paso de imagen ofrece **Subir desde mi equipo** y
   **Usar imagen guardada**. Elige **Usar esta imagen** en la biblioteca y continúa.
5. También se puede usar una imagen guardada al corregir la foto de un candidato
   o regidor. No se vuelve a subir el archivo al seleccionarlo.

Cada biblioteca corresponde a una elección. No mezcla instituciones ni muestra
imágenes de otros colegios. La visualización usa endpoints autenticados sin caché
pública; no se convierte el bucket en público. Solo el personal autorizado con
MFA puede consultar la biblioteca. El servidor verifica el acceso al archivo al
guardar, aunque alguien intente manipular la selección desde el navegador.

Las imágenes nuevas se validan, se convierten a WebP y se eliminan metadatos antes
de subirlas. Elegir archivos desde el equipo en el asistente no los sube hasta
**Terminar registro**. El límite combinado de subida de foto y símbolo sigue
siendo 4 MB. Los archivos ya guardados no vuelven a enviarse como adjuntos.

Solo se suben o vinculan imágenes mientras la elección está en borrador. Después
se conserva la biblioteca para consulta del personal. No hay eliminación automática
de archivos ni cambios en las inscripciones anteriores.

## Bienvenida y agradecimiento

El alumno encuentra un personaje ilustrado en 3D con terno y el mensaje
**¡Bienvenido a tus elecciones escolares!**. **Entrar a mis elecciones** continúa
al menú del elector o al ingreso de DNI de la computadora habilitada. El personal
administrativo mantiene su interfaz y sus herramientas, sin esta pantalla previa.

Después de confirmar la participación mediante la operación electoral aparece
**¡Gracias por tu voto! Tu voz cuenta. Hoy ayudaste a construir una mejor escuela
para todos.** La pantalla no muestra la selección ni el nombre del votante.
Una operación rechazada o sin confirmar no presenta un agradecimiento de éxito.

En la mesa presencial, **Terminar y limpiar pantalla** conserva el procedimiento
de limpieza y vuelve a la bienvenida para el siguiente estudiante. Nunca se
habilita un voto al pulsar Entrar: siguen vigentes el padrón, la verificación del
comité, las autorizaciones y los controles de voto único.

El personaje es un recurso ilustrado generado para la interfaz, sin representar
a un alumno real. Se usa un archivo WebP local de aproximadamente 52 KB, sin
proveedores externos de imágenes ni generación durante la votación.

## Activación

Esta actualización no añade migraciones ni claves. Con 001–010 ya aplicadas,
basta con el despliegue actualizado de Vercel y recargar la plataforma cuando
aparezca Ready/Listo. Las políticas privadas de Storage existentes siguen
protegiendo tanto la biblioteca como los archivos. No se abre ninguna elección.

Las pruebas utilizan exclusivamente usuarios y archivos ficticios locales.
