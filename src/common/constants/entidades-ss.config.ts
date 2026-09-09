export interface EntidadSSConfig {
    codigo: string;
    nombre: string;
    tipo: 'EPS' | 'AFP' | 'CCF' | 'ARL';
}

export const ENTIDADES_SEGURO_SOCIAL: Record<string, EntidadSSConfig> = {
    'eps-susalud': { codigo: 'EPS001', nombre: 'Susalud', tipo: 'EPS' },
    'eps-nuevaeps': { codigo: 'EPS002', nombre: 'Nueva EPS', tipo: 'EPS' },
    'eps-sanitas': { codigo: 'EPS003', nombre: 'EPS Sanitas', tipo: 'EPS' },
    'eps-famisanar': { codigo: 'EPS004', nombre: 'Famisanar', tipo: 'EPS' },
    'eps-savia': { codigo: 'EPS005', nombre: 'Savia Salud', tipo: 'EPS' },
    'eps-compensar-eps': { codigo: 'EPS006', nombre: 'Compensar EPS', tipo: 'EPS' },
    'eps-coosalud': { codigo: 'EPS007', nombre: 'Coosalud', tipo: 'EPS' },
    'afp-proteccion': { codigo: 'AFP001', nombre: 'Protección', tipo: 'AFP' },
    'afp-colfondos': { codigo: 'AFP002', nombre: 'Colfondos', tipo: 'AFP' },
    'afp-porvenir': { codigo: 'AFP003', nombre: 'Porvenir', tipo: 'AFP' },
    'ccf-compensar': { codigo: 'CCF001', nombre: 'Compensar', tipo: 'CCF' },
    'ccf-colsubsidio': { codigo: 'CCF002', nombre: 'Colsubsidio', tipo: 'CCF' },
    'ccf-cafam': { codigo: 'CCF003', nombre: 'Cafam', tipo: 'CCF' },
    'arl-sura': { codigo: 'ARL01', nombre: 'Seguros de Vida Suramericana S.A. (ARL SURA)', tipo: 'ARL' },
    'arl-positiva': { codigo: 'ARL02', nombre: 'Positiva Compañía de Seguros S.A.', tipo: 'ARL' },
    'arl-bolivar': { codigo: 'ARL03', nombre: 'Seguros Bolívar S.A.', tipo: 'ARL' },
    'arl-colpatria': { codigo: 'ARL04', nombre: 'AXA Colpatria Seguros S.A.', tipo: 'ARL' },
    'arl-mapfre': { codigo: 'ARL05', nombre: 'Mapfre Colombia Vida Seguros S.A.', tipo: 'ARL' },
    'arl-aurora': { codigo: 'ARL06', nombre: 'Compañía de Seguros de Vida Aurora S.A.', tipo: 'ARL' },
};
