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
        codigo: '6205',
        nombre: 'Costo de Mercancía Vendida',
        descripcion: 'Costo de productos vendidos',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '62',
        aceptaMovimiento: true,
        isActive: true
    }
];