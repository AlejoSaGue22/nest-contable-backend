
export interface CategoriaConfig {
    codigo: string;
    nombre: string;
    tipo: tipoCategoria;
    cuentaPrincipalId: string;
    cuentaInventarioId: string;
    cuentaCostoId: string;
    descripcion: string;
}

export type tipoCategoria = 'venta' | 'costo' | 'gasto' | 'servicio';

export const CATEGORIAS_ARTICULOS: Record<string, CategoriaConfig> = {
    // VENTAS
    'venta-productos': {
        codigo: 'venta-productos',
        nombre: 'Venta de Productos',
        tipo: 'venta',
        cuentaPrincipalId: '4135', // Comercio al por mayor
        cuentaInventarioId: '1435',
        cuentaCostoId: '6205',
        descripcion: 'Para artículos que se venden'
    },
    'venta-servicios': {
        codigo: 'venta-servicios',
        nombre: 'Venta de Servicios',
        tipo: 'servicio',
        cuentaPrincipalId: '4155', // Servicios
        cuentaInventarioId: 'N/A',
        cuentaCostoId: 'N/A',
        descripcion: 'Para servicios que se prestan'
    },

    // COMPRAS
    'compra-mercancia': {
        codigo: 'compra-mercancia',
        nombre: 'Compra de Mercancía',
        tipo: 'costo',
        cuentaPrincipalId: '6205', // Costo de mercancía vendida
        cuentaInventarioId: '1435',
        cuentaCostoId: '6205',
        descripcion: 'Para mercancía que se compra para revender'
    },
    'compra-activos': {
        codigo: 'compra-activos',
        nombre: 'Compra de Activos Fijos',
        tipo: 'costo',
        cuentaPrincipalId: '1524', // Equipo de oficina
        cuentaInventarioId: 'N/A',
        cuentaCostoId: 'N/A',
        descripcion: 'Para compra de equipos, muebles, etc.'
    },

    // GASTOS
    'gastos-operacionales': {
        codigo: 'gastos-operacionales',
        nombre: 'Gastos Operacionales',
        tipo: 'gasto',
        cuentaPrincipalId: '5195', // Gastos diversos
        cuentaInventarioId: 'N/A',
        cuentaCostoId: 'N/A',
        descripcion: 'Gastos del día a día del negocio'
    },
    'gastos-personal': {
        codigo: 'gastos-personal',
        nombre: 'Gastos de Personal',
        tipo: 'gasto',
        cuentaPrincipalId: '5105', // Gastos de personal
        cuentaInventarioId: 'N/A',
        cuentaCostoId: 'N/A',
        descripcion: 'Sueldos, bonos, capacitaciones'
    }
};