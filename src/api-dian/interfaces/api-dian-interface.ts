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

export interface FactusPayload {
  document: string,
  numbering_range_id: number,
  reference_code: string,
  observation: string,
  payment_method_code: string,
  establishment: {
    name: string,
    address: string,
    phone_number: string,
    email: string,
    municipality_id: number
  },
  customer: {
    identification: string,
    dv: string | null,
    company: string,
    trade_name: string,
    names: string,
    address: string,
    email: string,
    phone: string,
    legal_organization_id: number,
    tribute_id: number,
    identification_document_id: number | string,
    municipality_id: number
  },
  items: ItemsFacturaVentaFactus[],
  allowance_charges: AllowanceChargesFactus[]
}

export interface ItemsFacturaVentaFactus {
      code_reference: string,
      name: string,
      quantity: number,
      discount_rate: number,
      price: number,
      tax_rate: string,
      unit_measure_id: number,
      standard_code_id: number,
      is_excluded: number,
      tribute_id: number,
      withholding_taxes: [
        {
          code: string,
          withholding_tax_rate: number
        }
      ]
}

export interface AllowanceChargesFactus {
  concept_type: string,
  is_surcharge: boolean,
  reason: string,
  base_amount: string,
  amount: string
}
  
