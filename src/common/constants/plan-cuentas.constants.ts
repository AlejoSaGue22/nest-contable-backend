import { NaturalezaCuenta, TipoCuenta } from "src/cuentas/entities/cuenta.entity";


export const PLAN_CUENTAS_MINIMO = [

    // ========================================
    // CUENTAS PADRE (Solo para jerarquía)
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
        nombre: 'COSTOS',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 1,
        aceptaMovimiento: false,
        isActive: true
    },

    // ========================================
    // CUENTAS DE MOVIMIENTO (Las que se usan)
    // ========================================

    // Para Asientos Contables
    {
        codigo: '1105',
        nombre: 'Caja',
        descripcion: 'Dinero en efectivo - Usada en asientos de venta y gasto',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '1',
        aceptaMovimiento: true,
        isActive: true
    },

    // IVA Descontable (Para Compras/Gastos)
    {
        codigo: '1355',
        nombre: 'IVA Descontable',
        descripcion: 'IVA que podemos descontar - Usado en compras y gastos',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '1',
        aceptaMovimiento: true,
        isActive: true
    },

    // Activos Fijos
    {
        codigo: '1524',
        nombre: 'Equipo de Oficina',
        descripcion: 'Computadores, muebles, etc.',
        tipo: TipoCuenta.ACTIVO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '1',
        aceptaMovimiento: true,
        isActive: true
    },

    // IVA por Pagar (Para Ventas)
    {
        codigo: '2408',
        nombre: 'IVA por Pagar',
        descripcion: 'IVA que debemos a la DIAN - Usado en ventas',
        tipo: TipoCuenta.PASIVO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '2',
        aceptaMovimiento: true,
        isActive: true
    },

    // Ingresos por Ventas
    {
        codigo: '4135',
        nombre: 'Venta de Productos',
        descripcion: 'Ingresos por venta de mercancía',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '4',
        aceptaMovimiento: true,
        isActive: true
    },

    // Ingresos por Servicios
    {
        codigo: '4155',
        nombre: 'Venta de Servicios',
        descripcion: 'Ingresos por prestación de servicios',
        tipo: TipoCuenta.INGRESO,
        naturaleza: NaturalezaCuenta.CREDITO,
        nivel: 3,
        cuentaPadreId: '4',
        aceptaMovimiento: true,
        isActive: true
    },

    // Gastos de Personal
    {
        codigo: '5105',
        nombre: 'Gastos de Personal',
        descripcion: 'Sueldos, salarios, bonos',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '5',
        aceptaMovimiento: true,
        isActive: true
    },

    // Gastos Diversos
    {
        codigo: '5195',
        nombre: 'Gastos Diversos',
        descripcion: 'Gastos operacionales del día a día',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '5',
        aceptaMovimiento: true,
        isActive: true
    },

    // Costo de Mercancía
    {
        codigo: '6205',
        nombre: 'Costo de Mercancía Vendida',
        descripcion: 'Costo de productos comprados para revender',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 3,
        cuentaPadreId: '6',
        aceptaMovimiento: true,
        isActive: true
    }
];