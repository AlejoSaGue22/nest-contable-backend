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

export interface FacturaDianPdfResponse {
  status: string;
  message: string;
  data: {
    file_name: string;
    pdf_base_64_encoded: string;
  }

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