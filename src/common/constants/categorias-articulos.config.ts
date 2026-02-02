
export interface CategoriaConfig {
    codigo: string;
    nombre: string;
    tipo: 'venta' | 'compra' | 'gasto';
    cuentaContableCodigo: string;
    cuentaIvaCodigo: string;
    descripcion: string;
}

export const CATEGORIAS_ARTICULOS: Record<string, CategoriaConfig> = {
    // VENTAS
    'venta-productos': {
        codigo: 'venta-productos',
        nombre: 'Venta de Productos',
        tipo: 'venta',
        cuentaContableCodigo: '4135', // Comercio al por mayor
        cuentaIvaCodigo: '2408',       // IVA por pagar
        descripcion: 'Para artículos que se venden'
    },
    'venta-servicios': {
        codigo: 'venta-servicios',
        nombre: 'Venta de Servicios',
        tipo: 'venta',
        cuentaContableCodigo: '4155', // Servicios
        cuentaIvaCodigo: '2408',
        descripcion: 'Para servicios que se prestan'
    },

    // COMPRAS
    'compra-mercancia': {
        codigo: 'compra-mercancia',
        nombre: 'Compra de Mercancía',
        tipo: 'compra',
        cuentaContableCodigo: '6205', // Costo de mercancía vendida
        cuentaIvaCodigo: '1355',       // IVA descontable
        descripcion: 'Para mercancía que se compra para revender'
    },
    'compra-activos': {
        codigo: 'compra-activos',
        nombre: 'Compra de Activos Fijos',
        tipo: 'compra',
        cuentaContableCodigo: '1524', // Equipo de oficina
        cuentaIvaCodigo: '1355',
        descripcion: 'Para compra de equipos, muebles, etc.'
    },

    // GASTOS
    'gastos-operacionales': {
        codigo: 'gastos-operacionales',
        nombre: 'Gastos Operacionales',
        tipo: 'gasto',
        cuentaContableCodigo: '5195', // Gastos diversos
        cuentaIvaCodigo: '1355',
        descripcion: 'Gastos del día a día del negocio'
    },
    'gastos-personal': {
        codigo: 'gastos-personal',
        nombre: 'Gastos de Personal',
        tipo: 'gasto',
        cuentaContableCodigo: '5105', // Gastos de personal
        cuentaIvaCodigo: '1355',
        descripcion: 'Sueldos, bonos, capacitaciones'
    }
};