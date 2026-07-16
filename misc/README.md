# BUUUUUUUS - BGA Project Documentation

Este archivo proporciona un resumen detallado del diseño de software, estructura de archivos y lógica de estados de la implementación digital del juego de cartas **BUUUUUUUS** en la plataforma Board Game Arena.

---

## 📋 Resumen del Proyecto

**BUUUUUUUS** es una implementación digital adaptada al framework moderno de Board Game Arena (BGA) utilizando:
* **PHP 8.2+** en el servidor con namespaces y estados basados en clases independientes.
* **JavaScript (ESM)** en el cliente con clases de estado que implementan el *State Pattern* para sincronizarse dinámicamente con los estados del servidor.
* **Base de datos (MySQL/InnoDB)** estructurada con tablas de cartas (`card`) y pilas de resolución (`stack`).
* **Estilos CSS con espacio de nombres (`buu_`)** para evitar conflictos de colisión de clases visuales en BGA.

El juego consta de 2 rondas de turnos rotativos donde los jugadores colocan autobuses en la plataforma, embarcan pasajeros correspondientes (tanto obligatorios de la sala de espera como opcionales de sus manos) y puntúan al hacer partir los autobuses o restan puntos al final de la ronda por cartas infelices en hand o penalizaciones.

---

## 📂 Estructura de Carpetas y Archivos

```plaintext
buuuuuuus/
├── buuuuuuus.css            # Estilo principal compilado de SASS
├── dbmodel.sql              # Estructura de base de datos (cartas, pila de estados, etc.)
├── gameinfos.jsonc          # Metadatos del juego en Board Game Arena
├── gameoptions.jsonc        # Opciones configurables de la mesa
├── gamepreferences.jsonc    # Preferencias visuales o de jugador
├── material.inc.php         # Constantes de capacidades y tipos de pasajeros
├── stats.json               # Definiciones de estadísticas de la mesa y de jugadores
├── tsconfig.json            # Configuración de compilación de TypeScript (si aplica)
├── rollup.config.mjs        # Configuración del empaquetador Rollup para JS
├── package.json             # Dependencias del lado del cliente y scripts de watch/build
│
├── misc/
│   └── README.md            # Este manual explicativo del diseño del proyecto
│
└── modules/
    ├── README               # Nota informativa del framework
    ├── css/                 # Archivos SASS del diseño visual
    ├── js/
    │   └── Game.js          # Lógica principal del cliente (controlador y estados JS)
    └── php/
        ├── Game.php         # Clase central de la lógica del juego (tabla BGA)
        ├── Objects/
        │   └── Card.php     # Representación OOP de una Carta (Bus o Pasajero)
        ├── Managers/
        │   ├── CardManager.php   # Consultas de BD, barajado, robado y movimiento de cartas
        │   └── StackManager.php  # Pila de resolución de acciones pendientes (Atoms)
        └── States/          # Clases PHP individuales para cada estado de juego BGA
            ├── ActiveBus.php       # Fase 1: Jugar o seleccionar autobús activo
            ├── WaitingRoom.php     # Fase 2: Embarcar pasajeros de la sala de espera (Obligatorio)
            ├── TravelersHand.php   # Fase 3: Embarcar pasajeros de la mano (Opcional)
            ├── Penalty.php         # Fase 4: Descartar una carta a Unhappies si no hubo embarques
            ├── RefillHand.php      # Fase 5: Rellenar la mano (Buses y Pasajeros)
            ├── NextPlayer.php      # Fase 6: Reordenado de colas de espera, recarga y fin de ronda
            ├── EndScore.php        # Recuento de puntos, preparación de ronda 2 o fin del juego
            ├── CorrupterSwap.php   # Habilidad especial: Intercambios del Corruptor
            └── DrunkardChoice.php  # Habilidad especial: Selección de víctimas del Borracho
```

---

## ⚙️ Resumen de Archivos Relevantes

### 1. Núcleo y Managers (`modules/php/`)
* **[Game.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/Game.php)**: Clase controladora de la mesa de juego. Contiene configuraciones iniciales, cálculo de progresión de la partida, recolección de datos iniciales (`getAllDatas`) y validaciones globales como `getBoardingError` (que controla si un pasajero puede subir a un bus según su color y capacidad).
* **[Card.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/Objects/Card.php)**: Clase entidad que mapea cada registro de la base de datos de cartas, aportando helpers prácticos como `getColor()` o `getArg()`.
* **[CardManager.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/Managers/CardManager.php)**: Encapsula el acceso y movimiento de cartas en la base de datos. Administra las ubicaciones lógicas (`hand`, `garage`, `waiting_room`, `platform`, `in_bus`, `passengers`, `unhappies`, `departed_buses`).
* **[StackManager.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/Managers/StackManager.php)**: Maneja una tabla pila para registrar átomos de resolución en cadenas de acciones complejas, útil para efectos anidados como intercambios o elecciones consecutivas.

### 2. Máquina de Estados PHP (`modules/php/States/`)
* **[ActiveBus.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/ActiveBus.php)**: Determina si el jugador tiene movimientos posibles o está atascado. Permite colocar un bus desde la mano o seleccionar uno ya activo de la plataforma.
* **[WaitingRoom.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/WaitingRoom.php)**: Fuerza el embarque obligatorio de los pasajeros de la fila del Waiting Room que coincidan en color y quepan en el autobús actual.
* **[TravelersHand.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/TravelersHand.php)**: Permite la acción de embarcar opcionalmente cualquier cantidad de pasajeros válidos desde la mano del jugador activo hacia el autobús.
* **[Penalty.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/Penalty.php)**: Aplica una penalización si el jugador colocó un autobús pero no logró embarcar a nadie en su turno. El jugador debe elegir una carta para enviar a la zona "Unhappies" (puntos negativos). Cuenta con una salvaguarda automática que si el jugador se queda con mano vacía, evita atascos y avanza.
* **[RefillHand.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/RefillHand.php)**: Gestiona el reabastecimiento de la mano hasta el límite reglamentario. Incorpora la lógica para transicionar a la puntuación inmediatamente si el jugador tiene `0` cartas en mano (evitando bloqueos en el cliente).
* **[NextPlayer.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/NextPlayer.php)**: Limpia y desliza hacia adelante la cola de espera de la Waiting Room, priorizando Bebés en la fila, rellena el garaje de autobuses y comprueba las condiciones globales de fin de ronda (incluyendo mano vacía).
* **[EndScore.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/EndScore.php)**: Realiza el cálculo formal de puntuación basándose en pasajeros transportados, parejas de enamorados felices (+4), penalizaciones en Unhappies (-1) y buses sobrantes en mano. Prepara el tablero para la Ronda 2 o finaliza la partida si ya es la ronda definitiva.
* **[CorrupterSwap.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/CorrupterSwap.php)** y **[DrunkardChoice.php](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/php/States/DrunkardChoice.php)**: Controlan las decisiones exclusivas de las habilidades especiales del Corruptor e interrupciones del Borracho.

### 3. Código del Cliente (`modules/js/`)
* **[Game.js](file:///C:/Users/PC%20PRIDE%20WHITE%20WOLF/OneDrive/Documentos2/BGA/buuuuuuus/modules/js/Game.js)**: Lector central JS de BGA. Declara e inicializa todos los manejadores del cliente para las animaciones de cartas, arrastres, visualización de estados en la barra superior del juego y la gestión de selección de cartas en el navegador de los jugadores. Contiene las notificaciones que disparan los sonidos y reubicaciones visuales en tiempo real (`passengerBoarded`, `busPlaced`, `scoring`, etc.).
