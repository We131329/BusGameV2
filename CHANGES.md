# 📋 Tareas Pendientes para la Siguiente Sesión - Proyecto BUUUUUUUS

---

## 1. 🃏 Habilidad del Corrupter: Pausa Inmediata al Abordar
* **Comportamiento requerido:**
  * Cuando un jugador selecciona múltiples pasajeros para abordar un autobús y entre ellos está el **Corrupter**, el juego debe **pausarse inmediatamente en el momento exacto en que el Corrupter sube al autobús**.
  * No debe esperar a que suban los demás pasajeros seleccionados.
* **Implementación técnica:**
  * En `PlayerTurn.php` (`actPlayFromHand`), al iterar la lista de pasajeros que abordan, si se detecta un *Corrupter*:
    1. Pausar el bucle de abordaje.
    2. Guardar en la sesión/estado las cartas restantes que faltaban por abordar.
    3. Empujar la transición al estado `CorrupterSwap` mediante el `StackManager`.
    4. Al finalizar la acción de `CorrupterSwap`, reanudar automáticamente el abordaje de los pasajeros restantes.

---

## 2. ↩️ Sistema de Botón 'Go Back' (Deshacer Acción de Turno)
* **Comportamiento requerido:**
  * Agregar un botón **'Go Back'** en todas las fases/sub-estados del turno del jugador (excepto en el inicio del turno).
  * Al presionar el botón, el juego debe revertir todas las acciones realizadas durante ese sub-estado y regresar la mesa / base de datos a como estaba al inicio de la fase.
* **Implementación técnica:**
  * Generar un Snapshot/Checkpoint temporal del estado de la base de datos al entrar a cada estado activo del jugador.
  * Implementar la acción `actGoBack` para restaurar el Checkpoint y refrescar la UI mediante notificaciones.

---

## 📑 Resumen de Cambios Completados en esta Sesión

* ✅ **Cartas de Autobús en la Mano:** Formato vertical (90px x 130px) con rotación de imagen de 90°.
* ✅ **Cartas de Autobús en Garage y Plataforma:** Formato horizontal (130px x 90px) sin rotación.
* ✅ **Orden de la Mano:** Primero se muestran todos los Pasajeros y después los Autobuses.
* ✅ **Cartas Seleccionables:** Contorno verde punteado (`4px dashed #2ecc71`) en Mano, Waiting Room y Garage.
* ✅ **Opacidad de No Seleccionables:** `.buu_card.buu_unselectable-visual` ajustado a opacidad `0.6`.
* ✅ **Autobuses Bloqueados:** Se eliminó la animación de sacudida (`shake`) conservando el contorno punteado rojo.
* ✅ **Layout Responsivo Unificado:** Estructura unificada en 3 niveles (Mano arriba -> 3 Columnas [Waiting Room | Platform | Garage] al centro -> Tableros abajo) en escritorio y móvil.
* ✅ **Grid de la Plataforma (2x4):** Área de la Plataforma configurada en cuadrícula de 4 columnas x 2 filas para alojar 8 autobuses.
* ✅ **Mecánica del Garage:** Columna vertical donde solo la carta inferior es elegible. Al tomarla, las cartas superiores se desplazan hacia abajo y los espacios vacíos se rellenan desde el mazo.
* ✅ **Dimensiones del Garage:** Ancho de `#garage` configurado al `70%` en escritorio y `95%` en responsivo.
