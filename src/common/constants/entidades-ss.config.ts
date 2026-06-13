export interface EntidadSSConfig {
    codigo: string;
    nombre: string;
    tipo: 'EPS' | 'AFP' | 'CCF';
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
};
