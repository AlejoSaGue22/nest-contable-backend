export class Reporte { }


export interface EstadoResultados {
    periodo: {
        inicio: string;
        fin: string;
    };
    ingresos: {
        total: number;
        detalle: Array<{ cuenta: string; valor: number }>;
    };
    costos: {
        total: number;
        detalle: Array<{ cuenta: string; valor: number }>;
    };
    utilidadBruta: number;
    gastos: {
        total: number;
        detalle: Array<{ cuenta: string; valor: number }>;
    };
    utilidadNeta: number;
}

export interface FlujoCaja {
    periodo: {
        inicio: string;
        fin: string;
    };
    entradas: {
        total: number;
        detalle: Array<{ concepto: string; valor: number; fecha: Date }>;
    };
    salidas: {
        total: number;
        detalle: Array<{ concepto: string; valor: number; fecha: Date }>;
    };
    flujoNeto: number;
    saldoInicial: number;
    saldoFinal: number;
}

export interface BalanceGeneral {
    fecha: string;
    activos: {
        total: number;
        corrientes: number;
        noCorrientes: number;
        detalle: Array<{ cuenta: string; codigo: string; saldo: number }>;
    };
    pasivos: {
        total: number;
        corrientes: number;
        noCorrientes: number;
        detalle: Array<{ cuenta: string; codigo: string; saldo: number }>;
    };
    patrimonio: {
        total: number;
        detalle: Array<{ cuenta: string; codigo: string; saldo: number }>;
    };
}
