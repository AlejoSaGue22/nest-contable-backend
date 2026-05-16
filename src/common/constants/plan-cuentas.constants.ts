import { NaturalezaCuenta, TipoCuenta } from "src/cuentas/entities/cuenta.entity";



export const PLAN_CUENTAS_MINIMO = [
    // ========================================
    // NIVEL 1: CLASES (Padre)
    // ========================================
    {
        codigo: '1',
        nombre: 'ACTIVO',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '2',
        nombre: 'PASIVO',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '3',
        nombre: 'PATRIMONIO',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '4',
        nombre: 'INGRESOS',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '5',
        nombre: 'GASTOS',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '6',
        nombre: 'COSTOS DE VENTAS',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },

    // ========================================
    // NIVEL 2: GRUPOS
    // ========================================
    {
        codigo: '11',
        nombre: 'DISPONIBLE',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '1',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '13',
        nombre: 'DEUDORES',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '1',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '14',
        nombre: 'INVENTARIOS',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '1',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '15',
        nombre: 'PROPIEDAD, PLANTA Y EQUIPO',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '1',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '22',
        nombre: 'PROVEEDORES',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '2',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '24',
        nombre: 'IMPUESTOS, GRAVÁMENES Y TASAS',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '2',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '31',
        nombre: 'CAPITAL SOCIAL',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '3',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '41',
        nombre: 'INGRESOS OPERACIONALES',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '4',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '51',
        nombre: 'GASTOS OPERACIONALES DE ADMINISTRACIÓN',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '5',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '62',
        nombre: 'COSTO DE VENTAS',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '6',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '23',
        nombre: 'CUENTAS POR PAGAR',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '2',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '25',
        nombre: 'OBLIGACIONES LABORALES',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '2',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '26',
        nombre: 'PASIVOS ESTIMADOS Y PROVISIONES',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '2',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '36',
        nombre: 'RESULTADOS DEL EJERCICIO',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '3',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '37',
        nombre: 'RESULTADOS DE EJERCICIOS ANTERIORES',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '3',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '42',
        nombre: 'INGRESOS NO OPERACIONALES',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 2,
        cuentaPadreId: '4',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '53',
        nombre: 'GASTOS NO OPERACIONALES',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '5',
        aceptaMovimiento: false,
        isActive: true
    },
    {
        codigo: '61',
        nombre: 'COSTO DE VENTAS Y DE PRESTACIÓN DE SERVICIOS',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 2,
        cuentaPadreId: '6',
        aceptaMovimiento: false,
        isActive: true
    },


    // ========================================
    // NIVEL 3: CUENTAS DE MOVIMIENTO
    // ========================================
    {
        codigo: '1105',
        nombre: 'Caja',
        descripcion: 'Dinero en efectivo en caja',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '11',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1110',
        nombre: 'Bancos',
        descripcion: 'Cuentas bancarias',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '11',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1305',
        nombre: 'Clientes',
        descripcion: 'Cuentas por cobrar a clientes',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '13',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1355',
        nombre: 'Anticipo de Impuestos y Contribuciones',
        descripcion: 'IVA descontable',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '13',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1365',
        nombre: 'Cuentas por Cobrar a Trabajadores',
        descripcion: 'Préstamos y anticipos a empleados',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '13',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1380',
        nombre: 'Deudores Varios',
        descripcion: 'Otras cuentas por cobrar',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '13',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1435',
        nombre: 'Mercancías no Fabricadas por la Empresa',
        descripcion: 'Inventario de productos para venta',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '14',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1504',
        nombre: 'Terrenos',
        descripcion: 'Terrenos propiedad de la empresa',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1516',
        nombre: 'Construcciones y Edificaciones',
        descripcion: 'Edificios y construcciones',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1520',
        nombre: 'Maquinaria y Equipo',
        descripcion: 'Maquinaria y equipos de producción',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1524',
        nombre: 'Equipo de Oficina',
        descripcion: 'Computadores, muebles, etc.',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1528',
        nombre: 'Equipo de Computación y Comunicación',
        descripcion: 'Computadoras, laptops, servidores, teléfonos',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1540',
        nombre: 'Flota y Equipo de Transporte',
        descripcion: 'Vehículos de la empresa',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '1592',
        nombre: 'Depreciación Acumulada',
        descripcion: 'Depreciación acumulada de activos fijos',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '15',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2205',
        nombre: 'Proveedores Nacionales',
        descripcion: 'Cuentas por pagar a proveedores',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '22',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2335',
        nombre: 'Costos y Gastos por Pagar',
        descripcion: 'Servicios y gastos pendientes de pago',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '23',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2365',
        nombre: 'Retenciones y Aportes de Nómina',
        descripcion: 'Retenciones de empleados por pagar a entidades',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '23',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2368',
        nombre: 'Aportes Parafiscales',
        descripcion: 'SENA, ICBF, Cajas de Compensación',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '23',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2370',
        nombre: 'Retención en la Fuente',
        descripcion: 'Retenciones practicadas por pagar a DIAN',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '23',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2408',
        nombre: 'Impuesto sobre las Ventas por Pagar',
        descripcion: 'IVA por pagar a la DIAN',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '24',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2505',
        nombre: 'Obligaciones Bancarias Nacionales',
        descripcion: 'Préstamos bancarios y líneas de crédito',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '25',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '2610',
        nombre: 'Obligaciones Laborales',
        descripcion: 'Salarios, cesantías, primas por pagar',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '26',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '3105',
        nombre: 'Capital Suscrito y Pagado',
        descripcion: 'Capital inicial de la empresa',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '31',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '3605',
        nombre: 'Utilidades Retenidas',
        descripcion: 'Utilidades acumuladas de ejercicios anteriores',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '36',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '3610',
        nombre: 'Utilidad del Ejercicio',
        descripcion: 'Utilidad o pérdida del período actual',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '36',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '3705',
        nombre: 'Pérdidas Acumuladas',
        descripcion: 'Pérdidas de ejercicios anteriores',
        tipo: TipoCuenta.PATRIMONIO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '37',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '4135',
        nombre: 'Comercio al por Mayor y al por Menor',
        descripcion: 'Ingresos por venta de productos',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '41',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '4155',
        nombre: 'Servicios',
        descripcion: 'Ingresos por prestación de servicios',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '41',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '4210',
        nombre: 'Financieros - Intereses',
        descripcion: 'Ingresos por intereses bancarios',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '42',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '4295',
        nombre: 'Diversos - Otros Ingresos',
        descripcion: 'Otros ingresos no operacionales',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '42',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5105',
        nombre: 'Gastos de Personal',
        descripcion: 'Sueldos, salarios, prestaciones',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5110',
        nombre: 'Gastos de Personal - Prestaciones Sociales',
        descripcion: 'Cesantías, intereses cesantías, primas',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5115',
        nombre: 'Gastos de Personal - Aportes Parafiscales',
        descripcion: 'SENA, ICBF, Cajas de Compensación',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5120',
        nombre: 'Arrendamientos',
        descripcion: 'Arriendo de oficina o local',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5135',
        nombre: 'Servicios',
        descripcion: 'Servicios públicos, internet, teléfono',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5195',
        nombre: 'Diversos',
        descripcion: 'Gastos varios no clasificados',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5140',
        nombre: 'Mantenimiento y Reparaciones',
        descripcion: 'Mantenimiento de equipos, edificios, vehículos',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5145',
        nombre: 'Seguros',
        descripcion: 'Seguros de vehículos, mercancías, responsabilidad civil',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5150',
        nombre: 'Publicidad y Propaganda',
        descripcion: 'Gastos de marketing y publicidad',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5155',
        nombre: 'Gastos de Viaje',
        descripcion: 'Viáticos, transporte, hospedaje',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5160',
        nombre: 'Depreciación',
        descripcion: 'Depreciación de activos fijos',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5165',
        nombre: 'Útiles y Papelería',
        descripcion: 'Material de oficina, papelería',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '51',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5305',
        nombre: 'Gastos Financieros - Intereses',
        descripcion: 'Intereses sobre préstamos y obligaciones',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '53',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5310',
        nombre: 'Gastos Financieros - Comisiones Bancarias',
        descripcion: 'Comisiones y servicios bancarios',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '53',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '6205',
        nombre: 'Costo de Mercancía Vendida',
        descripcion: 'Costo de productos vendidos',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '62',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '6135',
        nombre: 'Comercio al por Mayor y al por Menor',
        descripcion: 'Costo de la mercancía vendida',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '61',
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '6155',
        nombre: 'Actividades de Servicios',
        descripcion: 'Costo de prestación de servicios',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '61',
        aceptaMovimiento: true,
        isActive: true
    }
];