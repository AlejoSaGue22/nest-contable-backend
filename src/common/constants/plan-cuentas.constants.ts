import { NaturalezaCuenta, TipoCuenta } from "src/cuentas/entities/cuenta.entity";

const CATALOGO_EN_BD = [
	{
		"codigo" : "1524",
		"nombre" : "Equipo de Oficina",
		"descripcion" : "Computadores, muebles, etc.",
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "3",
		"nombre" : "PATRIMONIO",
		"descripcion" : null,
		"tipo" : "PATRIMONIO",
		"naturaleza" : "CREDITO",
		"nivel" : 1,
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "24",
		"nombre" : "IMPUESTOS, GRAVÁMENES Y TASAS",
		"descripcion" : null,
		"tipo" : "PASIVO",
		"naturaleza" : "CREDITO",
		"nivel" : 2,
		"cuentaPadreId" : "2",
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "3105",
		"nombre" : "Capital Suscrito y Pagado",
		"descripcion" : "Capital inicial de la empresa",
		"tipo" : "PATRIMONIO",
		"naturaleza" : "CREDITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "11",
		"nombre" : "DISPONIBLE",
		"descripcion" : null,
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 2,
		"cuentaPadreId" : "1",
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "6",
		"nombre" : "COSTOS DE VENTAS",
		"descripcion" : null,
		"tipo" : "COSTO",
		"naturaleza" : "DEBITO",
		"nivel" : 1,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "13",
		"nombre" : "DEUDORES",
		"descripcion" : null,
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 2,
		"cuentaPadreId" : "1",
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "1435",
		"nombre" : "Mercancías no Fabricadas por la Empresa",
		"descripcion" : "Inventario de productos para venta",
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "5",
		"nombre" : "GASTOS",
		"descripcion" : null,
		"tipo" : "GASTO",
		"naturaleza" : "DEBITO",
		"nivel" : 1,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "2",
		"nombre" : "PASIVO",
		"descripcion" : null,
		"tipo" : "PASIVO",
		"naturaleza" : "CREDITO",
		"nivel" : 1,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "4",
		"nombre" : "INGRESOS",
		"descripcion" : null,
		"tipo" : "INGRESO",
		"naturaleza" : "CREDITO",
		"nivel" : 1,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "15",
		"nombre" : "PROPIEDAD, PLANTA Y EQUIPO",
		"descripcion" : null,
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 2,
		"cuentaPadreId" : "1",
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "22",
		"nombre" : "PROVEEDORES",
		"descripcion" : null,
		"tipo" : "PASIVO",
		"naturaleza" : "CREDITO",
		"nivel" : 2,
		"cuentaPadreId" : "2",
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "6205",
		"nombre" : "Costo de Mercancía Vendida",
		"descripcion" : "Costo de productos vendidos",
		"tipo" : "COSTO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "5195",
		"nombre" : "Diversos",
		"descripcion" : "Gastos varios no clasificados",
		"tipo" : "GASTO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "5105",
		"nombre" : "Gastos de Personal",
		"descripcion" : "Sueldos, salarios, prestaciones",
		"tipo" : "GASTO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "2205",
		"nombre" : "Proveedores Nacionales",
		"descripcion" : "Cuentas por pagar a proveedores",
		"tipo" : "PASIVO",
		"naturaleza" : "CREDITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "1355",
		"nombre" : "Anticipo de Impuestos y Contribuciones",
		"descripcion" : "IVA descontable",
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "1",
		"nombre" : "ACTIVO",
		"descripcion" : null,
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 1,
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "5135",
		"nombre" : "Servicios",
		"descripcion" : "Servicios públicos, internet, teléfono",
		"tipo" : "GASTO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "1305",
		"nombre" : "Clientes",
		"descripcion" : "Cuentas por cobrar a clientes",
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "1105",
		"nombre" : "Caja",
		"descripcion" : "Dinero en efectivo en caja",
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "2408",
		"nombre" : "Impuesto sobre las Ventas por Pagar",
		"descripcion" : "IVA por pagar a la DIAN",
		"tipo" : "PASIVO",
		"naturaleza" : "CREDITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "31",
		"nombre" : "CAPITAL SOCIAL",
		"descripcion" : null,
		"tipo" : "PATRIMONIO",
		"naturaleza" : "CREDITO",
		"nivel" : 2,
		"cuentaPadreId" : "3",
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "1110",
		"nombre" : "Bancos",
		"descripcion" : "Cuentas bancarias",
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "51",
		"nombre" : "GASTOS OPERACIONALES DE ADMINISTRACIÓN",
		"descripcion" : null,
		"tipo" : "GASTO",
		"naturaleza" : "DEBITO",
		"nivel" : 2,
		"cuentaPadreId" : "5",
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "14",
		"nombre" : "INVENTARIOS",
		"descripcion" : null,
		"tipo" : "ACTIVO",
		"naturaleza" : "DEBITO",
		"nivel" : 2,
		"cuentaPadreId" : "1",
		"aceptaMovimiento" : false,
		"isActive" : true
	},
	{
		"codigo" : "5120",
		"nombre" : "Arrendamientos",
		"descripcion" : "Arriendo de oficina o local",
		"tipo" : "GASTO",
		"naturaleza" : "DEBITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "4135",
		"nombre" : "Comercio al por Mayor y al por Menor",
		"descripcion" : "Ingresos por venta de productos",
		"tipo" : "INGRESO",
		"naturaleza" : "CREDITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "4155",
		"nombre" : "Servicios",
		"descripcion" : "Ingresos por prestación de servicios",
		"tipo" : "INGRESO",
		"naturaleza" : "CREDITO",
		"nivel" : 3,
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "62",
		"nombre" : "COSTO DE VENTAS",
		"descripcion" : null,
		"tipo" : "COSTO",
		"naturaleza" : "DEBITO",
		"nivel" : 2,
		"cuentaPadreId" : "6",
		"aceptaMovimiento" : true,
		"isActive" : true
	},
	{
		"codigo" : "41",
		"nombre" : "INGRESOS OPERACIONALES",
		"descripcion" : null,
		"tipo" : "INGRESO",
		"naturaleza" : "CREDITO",
		"nivel" : 2,
		"cuentaPadreId" : "4",
		"aceptaMovimiento" : true,
		"isActive" : true
	}
];

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
        aceptaMovimiento: true,
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
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '5',
        nombre: 'GASTOS',
        tipo: TipoCuenta.GASTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 1,
        aceptaMovimiento: true,
        isActive: true
    },
    {
        codigo: '6',
        nombre: 'COSTOS DE VENTAS',
        tipo: TipoCuenta.COSTO,
        naturaleza: NaturalezaCuenta.DEBITO,
        nivel: 1,
        aceptaMovimiento: true,
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
        aceptaMovimiento: true,
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
        aceptaMovimiento: true,
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
        aceptaMovimiento: true,
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
        aceptaMovimiento: true,
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