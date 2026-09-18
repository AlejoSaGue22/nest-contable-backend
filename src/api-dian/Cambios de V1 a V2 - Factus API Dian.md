Migración de Factus API V1 a V2

Esta guía describe los principales cambios que debes tener en cuenta al migrar de Factus API V1 a V2, o al realizar una nueva integración con la versión 2.

Los cambios incluyen:

Modificación de nombres y tipos de algunos campos.

Cambios en la estructura de los métodos de pago y anticipos.

Soporte para múltiples métodos de pago e impuestos por ítem.

Cambios en el manejo de precios e impuestos.

Sustitución de algunos identificadores (id) por códigos (code).

Nuevas tablas de referencia en formato JSON, que permiten consultar información sin consumir endpoints adicionales.

1. Métodos de pago
   payment_details

En la V1, los métodos de pago se manejaban mediante los campos:

payment_method_code

payment_form

Esta estructura permitía registrar un único método de pago.

En la V2, estos datos se manejan mediante payment_details, un array de objetos que permite registrar múltiples métodos de pago en una misma factura.

Cada objeto puede contener:

Campo Descripción
payment_form Forma de pago
payment_method_code Código del método de pago
reference_code Referencia del pago
amount Monto del pago
due_date Fecha de vencimiento

Ejemplo V2:

{
"payment_details": [
{
"payment_form": "2",
"payment_method_code": "10",
"reference_code": "pago-001",
"amount": "50000",
"due_date": "2026-03-25"
}
]
}

Consulta los códigos disponibles en Métodos de pago disponibles.

2. Redondeo de valores para medios de pago
   cash_rounding_amount

La V2 incorpora el campo cash_rounding_amount para realizar un ajuste opcional cuando existe una diferencia entre:

la suma de los valores registrados en payment_details, y

el total de la factura.

Esta diferencia puede generarse por las limitaciones de denominación de la moneda local.

El campo permite:

Valores negativos: redondeo hacia abajo.

Valores positivos: redondeo hacia arriba.

Valor máximo permitido: ±500.00.

Ejemplo:

{
"cash_rounding_amount": "50.00"
}

3. Anticipos
   prepayment_details

La V2 incorpora prepayment_details para manejar los anticipos de forma estructurada.

A diferencia de la V1, la nueva estructura permite registrar múltiples anticipos en una misma factura.

Cada anticipo puede contener:

Campo Descripción
prepayment_form Forma de pago del anticipo
prepayment_method_code Código del método de pago del anticipo
reference_code Referencia del anticipo
amount Monto del anticipo
due_date Fecha de vencimiento

Ejemplo V2:

{
"prepayment_details": [
{
"prepayment_form": "2",
"prepayment_method_code": "10",
"reference_code": "anticipo-001",
"amount": "50000",
"due_date": "2026-03-25"
}
]
}

4. Clientes

En el objeto customer se realizaron varios cambios relacionados principalmente con la sustitución de identificadores (id) por códigos (code).

4.1 identification_document_code

En la V1, el tipo de identificación se enviaba mediante:

identification_document_id

En la V2, el campo cambia a:

identification_document_code

Además del cambio de nombre, el valor pasa de ser un ID interno a un código que representa el tipo de identificación.

V1 V2
identification_document_id identification_document_code
ID Código

Ejemplo:

{
"customer": {
"identification_document_code": "13"
}
}

Consulta los códigos disponibles en Tipos de documentos disponibles.

4.2 legal_organization_code

En la V1, el tipo de organización se enviaba mediante:

legal_organization_id

En la V2, el campo cambia a:

legal_organization_code

El valor deja de representar un ID interno y pasa a representar el código del tipo de organización.

V1 V2
legal_organization_id legal_organization_code
ID Código

Ejemplo:

{
"customer": {
"legal_organization_code": "1"
}
}

Consulta los códigos disponibles en Tipos de organizaciones disponibles.

4.3 tribute_code

En la V1, el tributo del cliente se enviaba mediante:

tribute_id

En la V2, el campo cambia a:

tribute_code

V1 V2
tribute_id tribute_code
ID Código

Ejemplo:

{
"customer": {
"tribute_code": "01"
}
}

Consulta los códigos disponibles en Tipos de tributos disponibles.

4.4 municipality_code

En la V1, el municipio del cliente se identificaba mediante:

municipality_id

En la V2, el campo cambia a:

municipality_code.

V1 V2
municipality_id municipality_code
ID Código

Ejemplo:

{
"customer": {
"municipality_code": "1"
}
}

Nueva forma de consultar los municipios

En la V1 era necesario consumir un endpoint para obtener el ID correspondiente a un municipio.

En la V2, se proporciona un JSON con el listado completo de municipios, permitiendo que el integrador realice directamente la relación entre:

código del municipio, y

nombre del municipio.

Esto elimina la necesidad de consumir un endpoint adicional para consultar esta información.

Consulta Municipios disponibles.

5. Productos (items)

La V2 introduce cambios importantes en la estructura de los productos o ítems de una factura.

Los principales cambios están relacionados con:

Precio.

Unidad de medida.

Código estándar.

Impuestos.

Autoretenciones.

5.1 items.price

En la V1, el campo price se manejaba como un valor bruto, es decir, con los impuestos incluidos.

En la V2, price representa un valor neto, sin impuestos incluidos.

Versión Comportamiento
V1 Precio bruto, con impuestos incluidos
V2 Precio neto, sin impuestos incluidos

Ejemplo V2:

{
"items": [
{
"price": 100000
}
]
}

5.2 items.unit_measure_code

En la V1, la unidad de medida se identificaba mediante:

unit_measure_id

En la V2, el campo cambia a:

unit_measure_code

V1 V2
unit_measure_id unit_measure_code
ID Código

Ejemplo:

{
"items": [
{
"unit_measure_code": "1"
}
]
}

Nueva forma de consultar las unidades de medida

En la V1 era necesario consumir un endpoint para obtener el ID de la unidad de medida.

En la V2 se proporciona un JSON con el listado completo de unidades de medida, permitiendo relacionar directamente:

código de la unidad de medida, y

descripción de la unidad de medida.

Esto elimina la necesidad de consumir un endpoint adicional.

Consulta Unidades de medida disponibles.

5.3 items.standard_code

En la V1, el código estándar se identificaba mediante:

standard_id

En la V2, el campo cambia a:

standard_code.

V1 V2
standard_id standard_code
ID Código

Ejemplo:

{
"items": [
{
"standard_code": "999"
}
]
}

Consulta los códigos disponibles en Códigos de estándar disponibles.

5.4 items.taxes

La estructura de impuestos por ítem cambia significativamente en la V2.

En la V1, el impuesto se manejaba principalmente mediante:

tax_rate

tribute_id

En la V2, los impuestos se representan mediante un array de objetos, lo que permite registrar múltiples impuestos para un mismo ítem.

Cada impuesto contiene:

Campo Descripción
code Código del impuesto
rate Tarifa del impuesto

Ejemplo V2:

{
"items": [
{
"taxes": [
{
"code": "01",
"rate": 19
}
]
}
]
}

Nueva forma de consultar los impuestos

En la V1 era necesario consumir un endpoint para obtener el ID del tributo.

En la V2 se proporciona una tabla con el listado completo de tributos/impuestos, permitiendo relacionar directamente:

código del impuesto, y

descripción del impuesto.

Esto elimina la necesidad de consumir un endpoint adicional.

Consulta los tipos de impuestos en Códigos de impuestos disponibles.

5.5 items.taxes.is_excluded

Cuando un ítem está excluido de impuestos, se debe indicar mediante el campo:

is_excluded

establecido en true dentro del objeto correspondiente al impuesto.

Ejemplo:

{
"items": [
{
"taxes": [
{
"is_excluded": true
}
]
}
]
}

5.6 items.withholding_taxes

La forma de manejar las autoretenciones también cambia en la V2.

En la V1 era necesario consumir un endpoint para obtener el código correspondiente a la autoretención.

En la V2 se proporciona una tabla con el listado completo de autoretenciones, permitiendo que el integrador relacione directamente:

código de la autoretención, y

descripción de la autoretención.

Consulta los tipos de autoretenciones en Códigos de retenciones disponibles.

Cambio de withholding_tax_rate a rate

Además de la nueva estructura, el campo:

withholding_tax_rate

cambia a:

rate.

Ejemplo V2:

{
"withholding_taxes": [
{
"code": "05",
"rate": "15.00"
}
]
}

6. Resumen de cambios

La siguiente tabla resume los principales cambios de estructura entre V1 y V2:

Recurso V1 V2 Cambio
Métodos de pago payment_method_code + payment_form payment_details[] Permite múltiples métodos de pago
Redondeo No disponible cash_rounding_amount Nuevo campo
Anticipos — prepayment_details[] Nueva estructura
Identificación del cliente identification_document_id identification_document_code ID → código
Organización del cliente legal_organization_id legal_organization_code ID → código
Tributo del cliente tribute_id tribute_code ID → código
Municipio municipality_id municipality_code ID → código
Precio del ítem Precio bruto Precio neto Cambio de comportamiento
Unidad de medida unit_measure_id unit_measure_code ID → código
Código estándar standard_id standard_code ID → código
Impuestos tax_rate + tribute_id taxes[] Array y múltiples impuestos
Ítem excluido — taxes[].is_excluded Nuevo campo
Autoretenciones Consulta de endpoint Tabla de códigos Cambio en la fuente de referencia
Tarifa de autoretención withholding_tax_rate rate Cambio de nombre

7. Nuevas tablas de referencia

Una de las mejoras principales de la V2 es la incorporación de tablas de referencia en formato JSON.

Estas tablas permiten que el integrador consulte directamente los códigos y sus descripciones, reduciendo la necesidad de realizar solicitudes adicionales a la API.

Las principales referencias disponibles son:

- Métodos de pago disponibles

- Tipos de documentos disponibles

- Tipos de organizaciones disponibles

- Tipos de tributos disponibles

- Municipios disponibles

- Unidades de medida disponibles

- Códigos de estándar disponibles

- Códigos de impuestos disponibles

- Códigos de retenciones disponibles

Se recomienda consultar estas tablas durante la implementación para construir correctamente las relaciones entre los códigos utilizados por la V2 y sus respectivas descripciones.
