-- ========================================
-- PLAN DE CUENTAS COMPLETO
-- Sistema: Facturación Electrónica DIAN
-- Fecha: 2024
-- ========================================
UPDATE cuentas_contables
SET cuentaPadreId = 'a733ebd1-ec35-4c3f-b8db-7b0664f4c808'
WHERE codigo IN ('6135', '6155');
SELECT id,
    tipo,
    codigo,
    nombre,
    cuentaPadreId
FROM cuentas_contables
WHERE codigo IN ('6135', '6155');
-- IMPORTANTE: Este script crea un plan de cuentas intermedio (30-40 cuentas)
-- suficiente para operación comercial completa con facturación electrónica
BEGIN;
-- ========================================
-- 1. LIMPIAR DATOS EXISTENTES (Opcional)
-- ========================================
-- Descomentar solo si quieres empezar desde cero
-- DELETE FROM cuentas_contables;
-- ========================================
-- 2. ACTIVOS (Tipo: activo, Naturaleza: débito)
-- ========================================
SELECT codigo,
    COUNT(*) AS cantidad
FROM cuentas_contables
GROUP BY codigo
HAVING COUNT(*) > 1;
SELECT *
FROM cuentas_contables cc
WHERE cc.codigo = '1355';
-- 1355, , 1524, 2408, 5195, 4135, 4155, 5105
cc.descripcion is not null;
-- ACTIVOS CORRIENTES
INSERT INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '1105',
        'Caja',
        'ACTIVO',
        'debito',
        1,
        true,
        'Efectivo disponible en caja',
        NOW()
    ),
    (
        UUID(),
        '1110',
        'Bancos',
        'ACTIVO',
        'debito',
        1,
        true,
        'Recursos en cuentas bancarias',
        NOW()
    ),
    (
        UUID(),
        '1305',
        'Clientes',
        'ACTIVO',
        'debito',
        1,
        true,
        'Cuentas por cobrar a clientes por ventas a crédito',
        NOW()
    ),
    (
        UUID(),
        '1355',
        'Anticipo de Impuestos y Contribuciones',
        'ACTIVO',
        'debito',
        1,
        true,
        'IVA descontable, retenciones a favor, anticipos de impuestos',
        NOW()
    ),
    (
        UUID(),
        '1365',
        'Cuentas por Cobrar a Trabajadores',
        'ACTIVO',
        'debito',
        1,
        true,
        'Préstamos y anticipos a empleados',
        NOW()
    ),
    (
        UUID(),
        '1380',
        'Deudores Varios',
        'ACTIVO',
        'debito',
        1,
        true,
        'Otras cuentas por cobrar',
        NOW()
    );
INSERT INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        createdAt
    )
VALUES (
        UUID(),
        '3',
        'PATRIMONIO',
        'PATRIMONIO',
        'CREDITO',
        1,
        FALSE,
        NOW()
    );
-- MYSQ ACTIVOS NO CORRIENTES
INSERT IGNORE INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '1504',
        'Terrenos',
        'ACTIVO',
        'debito',
        1,
        true,
        'Terrenos propiedad de la empresa',
        NOW()
    ),
    (
        UUID(),
        '1516',
        'Construcciones y Edificaciones',
        'ACTIVO',
        'debito',
        1,
        true,
        'Edificios y construcciones',
        NOW()
    ),
    (
        UUID(),
        '1520',
        'Maquinaria y Equipo',
        'ACTIVO',
        'debito',
        1,
        true,
        'Maquinaria y equipos de producción',
        NOW()
    ),
    (
        UUID(),
        '1524',
        'Equipo de Oficina',
        'ACTIVO',
        'debito',
        1,
        true,
        'Muebles, archivadores, escritorios',
        NOW()
    ),
    (
        UUID(),
        '1528',
        'Equipo de Computación y Comunicación',
        'ACTIVO',
        'debito',
        1,
        true,
        'Computadoras, laptops, servidores, teléfonos',
        NOW()
    ),
    (
        UUID(),
        '1540',
        'Flota y Equipo de Transporte',
        'ACTIVO',
        'debito',
        1,
        true,
        'Vehículos de la empresa',
        NOW()
    ),
    (
        UUID(),
        '1592',
        'Depreciación Acumulada',
        'ACTIVO',
        'credito',
        1,
        true,
        'Depreciación acumulada de activos fijos (cuenta de valoración)',
        NOW()
    );
-- ACTIVOS NO CORRIENTES (Propiedad, Planta y Equipo)
-- ========================================
-- 3. PASIVOS (Tipo: pasivo, Naturaleza: crédito)
-- ========================================
-- PASIVOS CORRIENTES
-- MYSQL -- PASIVOS
INSERT IGNORE INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '2205',
        'Proveedores Nacionales',
        'PASIVO',
        'credito',
        1,
        true,
        'Cuentas por pagar a proveedores por compras a crédito',
        NOW()
    ),
    (
        UUID(),
        '2335',
        'Costos y Gastos por Pagar',
        'PASIVO',
        'credito',
        1,
        true,
        'Servicios y gastos pendientes de pago',
        NOW()
    ),
    (
        UUID(),
        '2365',
        'Retenciones y Aportes de Nómina',
        'PASIVO',
        'credito',
        1,
        true,
        'Retenciones de empleados por pagar a entidades',
        NOW()
    ),
    (
        UUID(),
        '2368',
        'Aportes Parafiscales',
        'PASIVO',
        'credito',
        1,
        true,
        'SENA, ICBF, Cajas de Compensación',
        NOW()
    ),
    (
        UUID(),
        '2370',
        'Retención en la Fuente',
        'PASIVO',
        'credito',
        1,
        true,
        'Retenciones practicadas por pagar a DIAN',
        NOW()
    ),
    (
        UUID(),
        '2408',
        'Impuesto a las Ventas por Pagar (IVA)',
        'PASIVO',
        'credito',
        1,
        true,
        'IVA generado en ventas menos IVA descontable',
        NOW()
    ),
    (
        UUID(),
        '2505',
        'Obligaciones Bancarias Nacionales',
        'PASIVO',
        'credito',
        1,
        true,
        'Préstamos bancarios y líneas de crédito',
        NOW()
    ),
    (
        UUID(),
        '2610',
        'Obligaciones Laborales',
        'PASIVO',
        'credito',
        1,
        true,
        'Salarios, cesantías, primas por pagar',
        NOW()
    );
-- ========================================
-- 4. PATRIMONIO (Tipo: patrimonio, Naturaleza: crédito)
-- ========================================
-- PATRIMONIO
INSERT IGNORE INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '3105',
        'Capital Social',
        'PATRIMONIO',
        'credito',
        1,
        false,
        'Capital aportado por los socios o accionistas',
        NOW()
    ),
    (
        UUID(),
        '3605',
        'Utilidades Retenidas',
        'PATRIMONIO',
        'credito',
        1,
        true,
        'Utilidades acumuladas de ejercicios anteriores',
        NOW()
    ),
    (
        UUID(),
        '3610',
        'Utilidad del Ejercicio',
        'PATRIMONIO',
        'credito',
        1,
        true,
        'Utilidad o pérdida del período actual',
        NOW()
    ),
    (
        UUID(),
        '3705',
        'Pérdidas Acumuladas',
        'PATRIMONIO',
        'debito',
        1,
        true,
        'Pérdidas de ejercicios anteriores',
        NOW()
    );
-- ========================================
-- 5. INGRESOS (Tipo: ingreso, Naturaleza: crédito)
-- ========================================
-- INGRESOS
INSERT IGNORE INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '4135',
        'Comercio al por Mayor y al por Menor',
        'INGRESO',
        'credito',
        1,
        true,
        'Ingresos operacionales por venta de productos - Facturas electrónicas DIAN',
        NOW()
    ),
    (
        UUID(),
        '4155',
        'Actividades de Servicios',
        'INGRESO',
        'credito',
        1,
        true,
        'Ingresos por prestación de servicios',
        NOW()
    ),
    (
        UUID(),
        '4210',
        'Financieros - Intereses',
        'INGRESO',
        'credito',
        1,
        true,
        'Ingresos por intereses bancarios',
        NOW()
    ),
    (
        UUID(),
        '4295',
        'Diversos - Otros Ingresos',
        'INGRESO',
        'credito',
        1,
        true,
        'Otros ingresos no operacionales',
        NOW()
    );
-- ========================================
-- 6. GASTOS OPERACIONALES (Tipo: gasto, Naturaleza: débito)
-- ========================================
-- GASTOS MYSQL
INSERT IGNORE INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '5105',
        'Gastos de Personal - Salarios',
        'GASTO',
        'debito',
        1,
        true,
        'Sueldos, salarios, bonificaciones',
        NOW()
    ),
    (
        UUID(),
        '5110',
        'Gastos de Personal - Prestaciones Sociales',
        'GASTO',
        'debito',
        1,
        true,
        'Cesantías, intereses cesantías, primas',
        NOW()
    ),
    (
        UUID(),
        '5115',
        'Gastos de Personal - Aportes Parafiscales',
        'GASTO',
        'debito',
        1,
        true,
        'SENA, ICBF, Cajas de Compensación',
        NOW()
    ),
    (
        UUID(),
        '5120',
        'Honorarios',
        'GASTO',
        'debito',
        1,
        true,
        'Honorarios profesionales (contador, abogado, consultor)',
        NOW()
    ),
    (
        UUID(),
        '5125',
        'Arrendamientos',
        'GASTO',
        'debito',
        1,
        true,
        'Arrendamiento de local, oficina, bodega',
        NOW()
    ),
    (
        UUID(),
        '5135',
        'Servicios Públicos',
        'GASTO',
        'debito',
        1,
        true,
        'Energía, agua, gas, teléfono, internet',
        NOW()
    ),
    (
        UUID(),
        '5140',
        'Mantenimiento y Reparaciones',
        'GASTO',
        'debito',
        1,
        true,
        'Mantenimiento de equipos, edificios, vehículos',
        NOW()
    ),
    (
        UUID(),
        '5145',
        'Seguros',
        'GASTO',
        'debito',
        1,
        true,
        'Seguros de vehículos, mercancías, responsabilidad civil',
        NOW()
    ),
    (
        UUID(),
        '5150',
        'Publicidad y Propaganda',
        'GASTO',
        'debito',
        1,
        true,
        'Gastos de marketing y publicidad',
        NOW()
    ),
    (
        UUID(),
        '5155',
        'Gastos de Viaje',
        'GASTO',
        'debito',
        1,
        true,
        'Viáticos, transporte, hospedaje',
        NOW()
    ),
    (
        UUID(),
        '5160',
        'Depreciación',
        'GASTO',
        'debito',
        1,
        true,
        'Depreciación de activos fijos',
        NOW()
    ),
    (
        UUID(),
        '5165',
        'Útiles y Papelería',
        'GASTO',
        'debito',
        1,
        true,
        'Material de oficina, papelería',
        NOW()
    ),
    (
        UUID(),
        '5195',
        'Gastos Diversos',
        'GASTO',
        'debito',
        1,
        true,
        'Otros gastos operacionales',
        NOW()
    ),
    (
        UUID(),
        '5305',
        'Gastos Financieros - Intereses',
        'GASTO',
        'debito',
        1,
        true,
        'Intereses sobre préstamos y obligaciones',
        NOW()
    ),
    (
        UUID(),
        '5310',
        'Gastos Financieros - Comisiones Bancarias',
        'GASTO',
        'debito',
        1,
        true,
        'Comisiones y servicios bancarios',
        NOW()
    );
-- ========================================
-- 7. COSTOS DE VENTA (Tipo: costo, Naturaleza: débito)
-- ========================================
-- COSTOS
INSERT IGNORE INTO cuentas_contables (
        id,
        codigo,
        nombre,
        tipo,
        naturaleza,
        nivel,
        aceptaMovimiento,
        descripcion,
        createdAt
    )
VALUES (
        UUID(),
        '6135',
        'Comercio al por Mayor y al por Menor',
        'COSTO',
        'debito',
        1,
        true,
        'Costo de la mercancía vendida',
        NOW()
    ),
    (
        UUID(),
        '6155',
        'Actividades de Servicios',
        'COSTO',
        'debito',
        1,
        true,
        'Costo de prestación de servicios',
        NOW()
    );
-- ========================================
-- 8. VERIFICAR RESULTADO
-- ========================================
-- Contar cuentas por tipo
SELECT tipo,
    COUNT(*) AS cantidad
FROM cuentas_contables
GROUP BY tipo
ORDER BY CASE
        tipo
        WHEN 'ACTIVO' THEN 1
        WHEN 'PASIVO' THEN 2
        WHEN 'PATRIMONIO' THEN 3
        WHEN 'INGRESO' THEN 4
        WHEN 'GASTO' THEN 5
        WHEN 'COSTO' THEN 6
    END;
-- ========================================
-- 9. CONSULTAS ÚTILES
-- ========================================
-- Ver todas las cuentas ordenadas
SELECT tipo,
    COUNT(*) as cantidad,
    GROUP_CONCAT(
        CONCAT(codigo, '-', LEFT(nombre, 30))
        ORDER BY codigo SEPARATOR ', '
    ) as cuentas
FROM cuentas_contables
GROUP BY tipo
ORDER BY CASE
        tipo
        WHEN 'ACTIVO' THEN 1
        WHEN 'PASIVO' THEN 2
        WHEN 'PATRIMONIO' THEN 3
        WHEN 'INGRESO' THEN 4
        WHEN 'GASTO' THEN 5
        WHEN 'COSTO' THEN 6
    END;
-- ========================================
-- NOTAS IMPORTANTES
-- ========================================
/*
 Este plan de cuentas incluye ~40 cuentas suficientes para:
 
 ✅ Operación comercial completa
 ✅ Facturación electrónica DIAN (cuenta 4135)
 ✅ Manejo de IVA correcto
 ✅ Nómina básica
 ✅ Control de activos fijos
 ✅ Balance General completo
 ✅ Estado de Resultados detallado
 
 CUENTAS CRÍTICAS PARA FACTURACIÓN ELECTRÓNICA:
 - 1105: Caja (efectivo de ventas)
 - 1110: Bancos (pagos electrónicos)
 - 1305: Clientes (ventas a crédito)
 - 1355: IVA Descontable (IVA en compras)
 - 2408: IVA por Pagar (IVA en ventas)
 - 4135: Ingresos por Ventas (FACTURAS ELECTRÓNICAS)
 - 6135: Costo de Ventas
 
 PRÓXIMOS PASOS:
 1. ✅ Plan de cuentas creado
 2. → Ejecutar migración de facturación electrónica
 3. → Configurar provee dor tecnológico DIAN
 4. → Probar emisión de facturas
 
 Para agregar más cuentas en el futuro, usar el mismo patrón:
 INSERT INTO cuentas_contables (id, codigo, nombre, tipo, naturaleza, nivel, es_movible, descripcion, created_at)
 VALUES (gen_random_uuid(), 'XXXX', 'Nombre', 'tipo', 'naturaleza', 1, true, 'Descripción', NOW());
 */