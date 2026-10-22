# Cajero Virtual v40 · Depósitos financiados por Tesorería

## Abrir la aplicación

1. Extrae la carpeta `Cajero_Virtual_Web`.
2. Abre `index.html` con doble clic.
3. No necesitas instalar Python, Node.js, un servidor ni conexión a internet para utilizar la aplicación.

La versión estable anterior se conserva por separado en `Cajero_Virtual_Web_v28_Limites_Operaciones_Cupo.zip`; esta carpeta es una nueva versión de trabajo.

## Reglas financieras vigentes

- Depósitos: máximo **$20.000.000** por operación; el importe bruto sale del saldo de Tesorería, el cliente recibe el neto y la comisión fija de **$20.000** se registra aparte. No se procesa si Tesorería no tiene fondos suficientes.
- Retiros: máximo **$20.000.000** por operación; el importe retirado se acredita automáticamente a la Tesorería independiente **•••• 0004** y la comisión fija de **$20.000** se descuenta por separado.
- Transferencias: máximo **$20.000.000** por operación; el destinatario recibe el importe completo y al emisor se le cobra una comisión de **$20.000**.
- Saldo máximo de las tres cuentas de clientes: **$200.000.000** cada una. La Tesorería no es una cuenta de ahorro ni tiene tarjeta o créditos.
- Avances desde la tarjeta a ahorros: solo a **6 o 12 cuotas**, con comisión de **$20.000**; los fondos trasladados no cuentan como otro desembolso original.
- Créditos personales: máximo **$100.000.000** por solicitud, sujetos al capital disponible del analista y al cupo autorizado del cliente.
- Fondo inicial ilustrativo del analista: **$500.000.000**, más intereses y comisiones efectivamente cobrados, menos los créditos activos y los fondos que aún siguen en las tarjetas.
- Aumento de cupo: solo se solicita un incremento de **$50.000.000**. Al aprobarlo, la tarjeta recibe los fondos y el crédito se activa a **12 cuotas con tasa ilustrativa del 2,13 % mensual** únicamente cuando el cliente realiza avances. El cupo máximo de demostración es **$500.000.000**.
- Deuda: cada titular mantiene como máximo una deuda activa unificada. Los pagos separan capital e intereses; el capital pagado recupera disponibilidad de avance, mientras que los intereses solo se cuentan como ganancia una vez pagados.

## Novedades v29

### Auditoría financiera

El acceso de analista incluye una sección para ejecutar comprobaciones de solo lectura. Revisa, entre otros puntos:

- Saldos de ahorro frente a los movimientos de entrada y salida registrados.
- Límites y fondos de tarjeta, exposición de crédito y deuda activa unificada por titular.
- Conciliación del capital desembolsado y reutilizado menos el capital pagado.
- Desglose de cada cuota entre capital e intereses.
- Conciliación de comisiones por operación y avance, e intereses cobrados.
- Correspondencia entre solicitudes desembolsadas y créditos registrados.
- Solicitudes pendientes duplicadas e identificadores repetidos.

Algunos datos heredados de versiones antiguas pueden mostrar una advertencia si no conservaban todo el libro de movimientos. La auditoría informa de esas diferencias; no corrige ni elimina movimientos automáticamente.

### Registro cronológico

Se conserva un máximo de **5.000 eventos recientes**, con fecha, tipo, titular, importe, referencia y detalles de la operación. Registra movimientos de ahorros y tarjeta, solicitudes, decisiones del analista, copias de seguridad y reinicios. No se registran los PIN en el registro de auditoría.

El registro se puede filtrar por categoría y buscar por titular, acción o referencia. El analista puede exportarlo a CSV.

### Informe financiero mensual

El analista puede seleccionar un mes y exportar un CSV con depósitos brutos y netos, retiros, transferencias, desembolsos, capital recuperado, intereses efectivamente cobrados, comisiones, cuotas, cartera pendiente y otros indicadores.

**Importante:** los movimientos, pagos e intereses reflejan el mes seleccionado. El saldo actual de ahorros y el capital pendiente son una fotografía del momento en que se genera el informe, no una reconstrucción del saldo al cierre histórico de ese mes.

### Copias de seguridad

- Exporta la base como un archivo JSON con versión de esquema e información de integridad.
- La aplicación usa SHA-256 cuando Web Crypto está disponible; si no, utiliza una suma de comprobación FNV-1a-32 para detectar corrupción accidental.
- Al importar, valida la estructura, los saldos máximos, los movimientos, los pagos y las referencias antes de pedir confirmación para sustituir los datos.
- Sigue admitiendo copias antiguas de esquema 1, que no incluyen suma de comprobación.
- Si el archivo guardado localmente parece dañado o incompleto, la aplicación bloquea nuevas escrituras para evitar sobrescribirlo silenciosamente. Recupera una copia válida o utiliza el borrado total explícito, después de confirmar.

La suma de comprobación detecta daños accidentales; **no es una firma criptográfica de origen ni protege contra una modificación deliberada**. Las copias pueden incluir saldos, movimientos y PIN de prueba: guárdalas en un lugar privado.

### Protección entre pestañas

Antes de guardar se compara la versión almacenada con la última versión leída. Las operaciones con cuadros de confirmación también verifican que la base no haya cambiado mientras el usuario decidía. Si se detecta una modificación externa, se descarta la escritura obsoleta, se recargan los datos actuales y se muestra un aviso en vez de sobrescribir silenciosamente otra operación.

Esta protección reduce conflictos comunes entre pestañas, pero el almacenamiento del navegador no es una base de datos transaccional de servidor y no garantiza atomicidad absoluta frente a todos los procesos simultáneos.

### Reinicio seguro

El botón **Borrar todos los datos del sistema** exige confirmación. Si una escritura de reinicio falla, intenta recuperar el estado anterior; además, evita restaurar un respaldo antiguo encima de un valor distinto que otra pestaña haya guardado entretanto.

## Organización del código

- `src/html/`: fragmentos editables de HTML por pantalla y componente.
- `css/modules/`: hojas CSS pequeñas por sección, cargadas directamente.
- `src/js/`: módulos JavaScript independientes y ordenados numéricamente. No se genera ni se incluye el antiguo `js/app.js`.
- `tools/build_modules.py`: genera `index.html` desde los fragmentos HTML y comprueba rutas, identificadores únicos, funciones duplicadas y hojas CSS idénticas.

Después de modificar los fragmentos HTML, ejecuta desde la carpeta `Cajero_Virtual_Web`:

```bash
python tools/build_modules.py
```

En Windows también puedes usar:

```bat
py tools/build_modules.py
```

Los estilos y scripts se cargan directamente desde sus módulos; no necesitan un proceso de compilación aparte. Mantén el orden numérico de los archivos JS, porque son scripts clásicos que comparten ámbito.

## Datos y límites de seguridad

Los datos se guardan en el navegador y se comparten entre pestañas del mismo perfil, mientras la selección de cuenta se mantiene por pestaña. No se sincronizan entre computadores ni entre perfiles de navegador.

Este proyecto es una simulación educativa local. No está conectado a una entidad financiera, no consulta centrales de riesgo y no debe utilizarse para administrar dinero real ni credenciales bancarias reales.


## Novedades v30: panel del analista separado por secciones

El panel del analista ahora se organiza en pantallas independientes: **Resumen, Solicitudes, Copias de seguridad, Auditoría, Informes y Registro**. La navegación mantiene el mismo diseño visual y evita mostrar todas las secciones largas a la vez.

El filtro compartido **Filtrar por cliente** afecta las solicitudes de crédito, los aumentos de cupo, las comprobaciones de auditoría asociadas a cada titular, el informe mensual y el registro cronológico. El selector conserva su valor al cambiar de sección. Las cifras del fondo del analista se mantienen globales para evitar confundir un filtro de titular con el capital total disponible.

La auditoría completa sigue ejecutándose sobre el sistema; al seleccionar un titular, la pantalla presenta las comprobaciones asociadas a ese cliente junto a unas pocas comprobaciones globales relevantes. Los informes mensuales suman los movimientos, cuotas y desembolsos de la cuenta elegida.

Al modificar fragmentos HTML, ejecuta `python tools/build_modules.py` para regenerar `index.html`. El módulo `src/js/22-analyst-pages-and-client-filter.js` controla la navegación y el selector compartido, y `css/modules/17-reviewer-sections-and-client-filter.css` contiene sus estilos.


## Novedades v31: comisión por operación y resumen acumulado del cliente

- El panel del analista muestra una tarjeta independiente para comisiones por depósitos, retiros, transferencias y avances. Cada cifra procede de los movimientos históricos registrados.
- En el informe mensual, los cuatro tipos de comisión tienen tarjetas independientes, además del total. El CSV incluye las categorías por separado.
- El filtro compartido por cliente actualiza el resumen acumulado: total pagado en cuotas, abonos y comisiones; capital amortizado; intereses cobrados; cada tipo de comisión; saldo de ahorros actual; fondos disponibles en tarjeta; capital pendiente; desembolsos originales; depósitos, retiros, transferencias y avances.
- El resumen acumulado es histórico; los saldos de ahorros, tarjeta y capital pendiente son fotografías actuales. El informe mensual continúa filtrando por titular y por mes.
- Se compactaron las tarjetas de cuenta, resumen, acciones, tarjeta bancaria y panel de analista para reducir espacio vertical, manteniendo el diseño oscuro y la legibilidad.
- El cálculo de total pagado en todo suma pagos de cuotas y abonos más comisiones de operaciones y avances. No suma depósitos, transferencias ni avances como si fueran pagos a la entidad.

El nuevo módulo `src/js/23-reviewer-client-summary-and-fees.js` calcula el resumen por cliente y llena las cuatro tarjetas globales de comisiones. Su correspondiente HTML está en `src/html/15-analyst-dashboard-and-capital.html`, y las reglas visuales nuevas para el resumen compacto están en `css/modules/18-client-financial-summary-compact.css`.


## Novedades v32: sincronización en tiempo real

Las operaciones guardadas notifican a las demás pestañas del mismo navegador mediante `BroadcastChannel`; `storage` queda como respaldo. El canal solo envía avisos, no saldos ni datos del cliente. Cada pestaña vuelve a leer la base persistida y actualiza la vista del cliente o la sección visible del analista, incluida la auditoría, el informe mensual y el registro cronológico; el filtro actual por cliente se conserva. Al volver a una pestaña suspendida se comprueba de nuevo el almacenamiento con `focus`, `pageshow` y `visibilitychange`.

El indicador muestra “En tiempo real”, “Sincronizado”, “Sincronización automática” o una advertencia si los datos no son válidos. Si otra pestaña cambia la base mientras hay una operación abierta, se cancela la escritura obsoleta en vez de sobrescribir el cambio remoto.

Para ejecutar la prueba de humo del mecanismo de actualización (solo durante desarrollo; no hace falta Node para abrir la aplicación):

```bash
node tools/test_realtime_sync.js
```

Esta prueba simula dos pestañas, confirma que cliente y analista se redibujan, que la sección de informes visible se actualiza y que un mismo aviso recibido por `BroadcastChannel` y `storage` no provoca un doble renderizado.

La sincronización funciona cuando las pestañas comparten el almacenamiento local del mismo archivo y perfil. No sincroniza entre computadores ni entre perfiles distintos, y `localStorage` no ofrece transacciones absolutas frente a escrituras simultáneas de varias pestañas.


## Novedades v33: interfaz compacta y actualización automática de créditos

### Resumen del cliente

- Se redujo el alto de la tarjeta principal de saldo, las tarjetas de estadísticas, las acciones y los movimientos recientes.
- Se ajustaron espacios, iconos, etiquetas y tamaños tipográficos para que el resumen muestre más información sin perder contraste ni legibilidad.
- En Tarjeta se redujo la altura de la tarjeta física, de los indicadores de desembolsos/disponible para avances y del formulario Realizar avance. La sección para solicitar aumento de cupo también ocupa menos espacio.
- Las reglas compactas se agregaron en `css/modules/20-client-overview-and-card-compact.css`, sin borrar los estilos base existentes.

### Estado de créditos y aumentos de cupo en tiempo real

- Cada vez que cambia la base compartida, se refrescan las solicitudes de crédito, su estado y el estado del botón de envío, incluso si la pantalla de Créditos está oculta.
- También se actualiza el historial de solicitudes de aumento de cupo, el cupo autorizado que muestra la sección y su botón de solicitud, aunque Tarjeta no sea la pantalla visible.
- Los formularios de las cuotas solo se reconstruyen cuando el cliente está viendo la pantalla Créditos, para no borrar innecesariamente un importe que estuviera escribiendo en otra sección.
- Cuando el cliente cambia a Tarjeta o Créditos, se vuelven a pintar los datos a partir de la base más reciente; no hace falta pulsar F5 ni volver a iniciar sesión.

### Mantenimiento y pruebas

- El constructor actualiza `index.html` y las rutas de los 47 módulos JavaScript sin generar un `app.js` gigante.
- La versión mostrada en la navegación y la versión incluida en las copias de seguridad pasan a `v33.0`.
- Ejecuta `node tools/test-client-credit-refresh.js` y `node tools/test_realtime_sync.js` para comprobar el refresco de solicitudes/créditos y el aviso entre pestañas.
- Abre `index.html` con doble clic para utilizar la aplicación; no se requiere servidor ni Python.


## Novedades v34: saldos en vivo en solicitudes y tarjetas en paralelo

- Las tarjetas de solicitudes de crédito y de aumento de cupo se presentan en dos columnas en escritorio y en una columna en pantallas pequeñas.
- Cada solicitud muestra una ficha compacta de estado financiero actual calculada directamente desde la base vigente: ahorros, desembolsos originales acumulados, fondos de tarjeta sin trasladar, capital recuperado, cupo autorizado y deuda pendiente total.
- Al pagar cuotas, registrar abonos, mover fondos o aprobar un desembolso, el panel del analista vuelve a leer la base compartida y presenta los saldos actuales; no se toman importes de la solicitud como si fueran balances actuales.
- Las solicitudes de aumento distinguen el cupo antes de solicitar, el cupo actual de la tarjeta y el cupo solicitado. Esto evita mostrar como actual el límite anterior una vez aprobado el aumento.
- Los estilos para la cuadrícula de solicitudes se integraron en los módulos CSS existentes para evitar añadir una hoja de sobreescrituras duplicadas.
- El constructor sigue generando `index.html` desde los fragmentos, sin bundle JavaScript duplicado.


Pruebas de regresión adicionales para v34:

```bash
node tools/test-analyst-live-card-balances.js
node tools/test-client-credit-refresh.js
node tools/test_realtime_sync.js
```

La prueba `test-analyst-live-card-balances.js` modifica en memoria los saldos, fondos de tarjeta, cupo y deuda; vuelve a renderizar las solicitudes y comprueba que las tarjetas reflejen los importes actuales, además de verificar el diseño de dos columnas para escritorio.

## Novedades v35: fondos en tarjeta y activación del crédito por avance

- Al desembolsar una solicitud, el dinero queda disponible en la tarjeta y no crea préstamos ni cuotas. Cada avance activa crédito solo por la parte trasladada a ahorros; el resto permanece en tarjeta sin generar cuotas.
- Los fondos sin avanzar ocupan cupo del cliente y capital del analista. La tarjeta más grande muestra los desembolsos cargados y los fondos que siguen disponibles.
- Los aumentos de cupo son únicamente de **$50.000.000**. El crédito de esos fondos conserva el plazo de **12 meses** y se activa con el avance.
- Las solicitudes del analista tienen pestañas separadas de **Créditos** y **Aumento de cupo**. **Copias de seguridad**, **Auditoría** e **Informes** aparecen juntas en Herramientas; el filtro por cliente queda junto a Registro.
- La vista del analista se vuelve a dibujar en el momento del desembolso. La sincronización existente también actualiza las otras pestañas abiertas.

La prueba de activación diferida se ejecuta con:

```bash
node tools/test-deferred-credit-activation.js
```

Ejecuta también el constructor y las tres pruebas de regresión listadas en la sección v34.

## Novedades v36: tarjeta sincronizada y cupo máximo claro

- Al actualizarse la tarjeta sin deuda, sus cifras de desembolsos y avances también se vuelven a dibujar correctamente.
- Los fondos de un aumento aprobado aparecen en la tarjeta y en la sección de aumentos; solo pasan a la lista de créditos cuando el cliente hace un avance.
- Se compactó la tarjeta de solicitud de aumento y, al llegar a **$500.000.000**, se ocultan los controles y se muestra un aviso claro del cupo máximo.
- Si todavía no se alcanzó exactamente el máximo pero no cabe otro incremento de **$50.000.000**, se explica que ese aumento lo superaría.

Para comprobar estos casos, ejecuta:

```bash
node tools/test-card-limit-refresh-and-max.js
node tools/test-deferred-credit-activation.js
node tools/test-analyst-live-card-balances.js
node tools/test-client-credit-refresh.js
node tools/test_realtime_sync.js
```
## Novedades v37: primer modelo de cuenta receptora

La versión intermedia v37 añadió la receptora como una cuarta cuenta de cliente. En v38 sus saldos e historial se migran a la tesorería independiente que se describe abajo; se quita el perfil de cliente que se usaba para esa función.

## Novedades v38: tesorería independiente

- La Tesorería de retiros tiene acceso propio con PIN de demostración **3456**, separado del analista y de las tres cuentas cliente.
- Los retiros de Edwin, Pedro y Reinel abonan automáticamente el importe a Tesorería. La comisión de **$20.000** sigue descontándose y registrándose por separado.
- Su cronómetro agrega **$1 por segundo** al saldo y recupera el tiempo transcurrido al volver a abrir la aplicación.
- Tesorería no tiene tarjeta, créditos, depósitos ni retiros. Su única operación financiera es transferir fondos, sin comisión, a una de las tres cuentas cliente.
- Los datos locales y copias de seguridad de v37 se migran conservando el saldo y el historial de la antigua cuenta receptora. Los productos de crédito asociados a ese perfil intermedio se retiran de la lista activa.
- Los avances de tarjeta permanecen limitados a **6 y 12 cuotas** en la interfaz y en la validación de la operación.

La prueba `node tools/test-withdrawal-recipient-account.js` comprueba la migración de la receptora anterior, el cobro por segundo, los retiros automáticos, la conservación separada de comisiones y las transferencias desde Tesorería.


## Novedades v39: carga de Tesorería y cuotas exactas

- La pantalla independiente de Tesorería se muestra como vista raíz, fuera del panel oculto del analista.
- Los avances de créditos personales respetan el plazo elegido de **6 o 12 cuotas**, incluso cuando ya existe una deuda activa; los avances de aumento de cupo mantienen sus **12 cuotas**.
- La última cuota cubre el capital y los intereses pendientes, de modo que el crédito se cierre sin dejar pesos residuales por redondeo.
- Las pruebas de Tesorería, selección del plazo y liquidación final están en `tools/test-withdrawal-recipient-account.js`, `tools/test-deferred-credit-activation.js` y `tools/test-advance-final-installment.js`.


## Novedades v40: depósitos desde Tesorería

- Los depósitos de los clientes se financian con el saldo de Tesorería. Se descuenta de ella el importe bruto, se abona a ahorros el importe neto después de la comisión de **$20.000** y se rechaza la operación si falta saldo.
- El cronómetro de Tesorería ahora suma **$5 por segundo**. El saldo y los ingresos históricos del ritmo anterior se conservan al actualizar; la nueva tarifa solo se aplica al tiempo posterior.
- El comprobante de Tesorería y su auditoría registran cada depósito financiado.

Para verificarlo, ejecuta `node tools/test-withdrawal-recipient-account.js`; el resto de las regresiones se mantiene en las pruebas incluidas en `tools/`.
