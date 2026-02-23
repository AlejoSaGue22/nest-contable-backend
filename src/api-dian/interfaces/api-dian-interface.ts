export interface FacturaDianResponse {
    cufe: string;
    xmlUrl: string;
    pdfUrl: string;
    qrCode: string;
    qrImageBase64: string;
    numeroCompleto: string;
    estado: 'aceptada' | 'rechazada';
    mensaje?: string;
    respuestaCompleta: any;
}

export interface filtroMunicipios {
    departamento?: string;
    nombre?: string;
}

export interface FactusTokenResponse {
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
}