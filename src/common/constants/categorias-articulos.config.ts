
export enum TipoCategoria {
    VENTA = 'VENTA',
    COSTO = 'COSTO',
    GASTO = 'GASTO',
    SERVICIO = 'SERVICIO',
}

export type tipoCategoria = TipoCategoria;

export interface CategoriaConfig {
    codigo: string;
    nombre: string;
    tipo: TipoCategoria;
    cuentaPrincipalId: string;
    cuentaInventarioId: string;
    cuentaCostoId: string;
    descripcion: string;
}

export const CATEGORIAS_ARTICULOS: Record<string, CategoriaConfig> = {
    // VENTAS
    'productos': {
        codigo: 'productos',
        nombre: 'Productos',
        tipo: TipoCategoria.VENTA,
        cuentaPrincipalId: '4135', // Comercio al por mayor
        cuentaInventarioId: '1435',
        cuentaCostoId: '6205',
        descripcion: 'Para artículos que se venden y se compran'
    },
    'servicios': {
        codigo: 'servicios',
        nombre: 'Servicios',
        tipo: TipoCategoria.SERVICIO,
        cuentaPrincipalId: '4155', // Servicios
        cuentaInventarioId: 'N/A',
        cuentaCostoId: 'N/A',
        descripcion: 'Para servicios que se prestan'
    },

    'activos-fijos': {
        codigo: 'activos-fijos',
        nombre: 'Activos Fijos',
        tipo: TipoCategoria.COSTO,
        cuentaPrincipalId: '1524',
        cuentaInventarioId: 'N/A',
        cuentaCostoId: 'N/A',
        descripcion: 'Para compra de equipos, muebles, etc.'
    },
};