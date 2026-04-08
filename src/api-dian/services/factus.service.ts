import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';
import { AllowanceChargesFactus, FacturaDianResponse, FactusPayload, FactusTokenResponse, filtroMunicipios } from '../interfaces/api-dian-interface';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';

/**
 * Servicio de integración con Factus
 * Proveedor tecnológico colombiano para facturación electrónica DIAN
 * 
 * Documentación: https://developers.factus.com.co/
 */
@Injectable()
export class FactusService {
    private readonly logger = new Logger(FactusService.name);
    private readonly apiUrl: string;
    private readonly oauthUrl: string;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        // Ambiente: sandbox para pruebas, producción para real
        const environment = this.configService.get<string>('FACTUS_ENVIRONMENT', 'sandbox');

        if (environment === 'sandbox') {
            this.apiUrl = 'https://api-sandbox.factus.com.co';
            this.oauthUrl = 'https://api-sandbox.factus.com.co/oauth/token';
        } else {
            this.apiUrl = 'https://api-factus-produccion.com.co'; // Producción
            this.oauthUrl = 'https://api-factus-produccion.com.co/oauth/token';
        }

        this.logger.log(`🔌 Factus Service inicializado en modo: ${environment}`);
    }

    /**
     * Obtener token de acceso OAuth2
     * Token expira en 600 segundos (10 minutos)
     */
    private async obtenerToken(): Promise<string> {
        // Si tenemos token válido, retornarlo
        if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
            return this.accessToken;
        }

        // Si tenemos refresh token, intentar renovar
        if (this.refreshToken && this.tokenExpiry && new Date() >= this.tokenExpiry) {
            try {
                await this.renovarToken();
                return this.accessToken!;
            } catch (error) {
                this.logger.warn('No se pudo renovar token, obteniendo uno nuevo...');
            }
        }

        // Obtener nuevo token
        try {
            this.logger.log('🔐 Obteniendo nuevo token de Factus...');

            const data = qs.stringify({
                grant_type: 'password',
                client_id: this.configService.get<string>('FACTUS_CLIENT_ID'),
                client_secret: this.configService.get<string>('FACTUS_CLIENT_SECRET'),
                username: this.configService.get<string>('FACTUS_USERNAME'),
                password: this.configService.get<string>('FACTUS_PASSWORD')
            });

            console.log('data de token: ', data);

            const response = await firstValueFrom(
                this.httpService.post<FactusTokenResponse>(this.oauthUrl, data, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            );

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;

            // Token expira en 600 segundos, guardamos fecha de expiración
            const expiresIn = response.data.expires_in || 600;
            this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

            this.logger.log(`✅ Token obtenido exitosamente. Expira en ${expiresIn} segundos`);

            return this.accessToken;

        } catch (error) {
            this.logger.error('❌ Error obteniendo token de Factus', error.response?.data || error.message);
            throw new BadRequestException('Error de autenticación con Factus');
        }
    }

    /**
     * Renovar token usando refresh token
     */
    private async renovarToken(): Promise<void> {
        try {
            this.logger.log('🔄 Renovando token de Factus...');

            const data = qs.stringify({
                grant_type: 'refresh_token',
                client_id: this.configService.get<string>('FACTUS_CLIENT_ID'),
                client_secret: this.configService.get<string>('FACTUS_CLIENT_SECRET'),
                refresh_token: this.refreshToken
            });

            const response = await firstValueFrom(
                this.httpService.post(this.oauthUrl, data, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                })
            );

            this.accessToken = response.data.access_token;
            this.refreshToken = response.data.refresh_token;

            const expiresIn = response.data.expires_in || 3600;
            this.tokenExpiry = new Date(Date.now() + (expiresIn * 1000));

            this.logger.log(`✅ Token renovado exitosamente. Expira en ${expiresIn} segundos`);

        } catch (error) {
            this.logger.error('❌ Error renovando token', error.response?.data);
            throw error;
        }
    }

    /**
     * Crear y validar factura en Factus/DIAN
     */
    async crearYValidarFactura(factura: FacturasVenta): Promise<FacturaDianResponse> {
        try {
            const token = await this.obtenerToken();

            // Validar datos requeridos
            this.validarDatosFactura(factura);

            // Construir payload según estructura de Factus
            const payload = this.construirPayloadFactus(factura);

            this.logger.log(`📤 Enviando factura ${factura.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v1/bills/validate`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000 // 60 segundos
                    }
                )
            );

            this.logger.log('✅ Respuesta recibida de Factus');

            // Procesar respuesta de Factus
            return this.procesarRespuestaFactus(response.data);

        } catch (error) {
            this.logger.error('❌ Error en Factus:', error.response?.data || error.message);

            // Manejar errores específicos de Factus
            if (error.response?.status === 409) {
                throw new BadRequestException('Ya existe una factura pendiente por enviar a DIAN con ese código de referencia');
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar factura a Factus/DIAN');
        }
    }

    /**
     * Construir payload para Factus según su estructura exacta
     */
    private construirPayloadFactus(factura: FacturasVenta) {
        // Generar código de referencia único (tu sistema)
        const referenceCode = `${factura.comprobante}_${Date.now()}`;

        const payload = {
            // Código de documento: "01" = Factura de Venta
            document: "01",

            // ID del rango de numeración (obtener de Factus)
            numbering_range_id: this.configService.get<number>('FACTUS_NUMBERING_RANGE_ID')!,

            // Código de referencia único (tu sistema)
            reference_code: referenceCode,

            // Forma de pago: Contado, Crédito
            payment_form: factura.formaPago == 'CONTADO' ? '1' : '2',

            // Fecha de vencimiento
            payment_due_date: factura.fechaVencimiento,
            
          // Observaciones (opcional)
            //   observation: factura?.observaciones || "",


            // Método de pago: "10" = Efectivo
            payment_method_code: factura.metodoPago || '10',

          // Datos del establecimiento/sucursal
            establishment: {
                name: this.configService.get<string>('FACTUS_ESTABLISHMENT_NAME', 'Sucursal Principal'),
                address: this.configService.get<string>('FACTUS_ESTABLISHMENT_ADDRESS')!,
                phone_number: this.configService.get<string>('FACTUS_ESTABLISHMENT_PHONE')!,
                email: this.configService.get<string>('FACTUS_ESTABLISHMENT_EMAIL')!,
                municipality_id: this.configService.get<number>('FACTUS_ESTABLISHMENT_MUNICIPALITY_ID')!
            },

            // Datos del cliente
            customer: {
                identification: factura.client.numeroDocumento,
                dv: factura.client.dv || null,
                company: factura.client.razonSocial, // (Opcional) Razón social. Obligatorio si el cliente es persona jurídica.
                trade_name: factura.client.nombre + " " + factura.client.apellido, // (Opcional) Nombre comercial
                names: factura.client.nombre + " " + factura.client.apellido, // (Opcional) Nombre del cliente. Solo aplica para los clientes que son personas naturales.
                address: factura.client.direccion,
                email: factura.client.email,
                phone: factura.client.telefono,
                legal_organization_id: factura.client.tipoPersona == 'PN' ? 2 : 1,   // 2 = Persona Natural, 1 = Persona Juridica
                tribute_id: factura.client.tributo || 21, // 21 = No aplica
                identification_document_id: factura.client.tipoDocumento, // this.mapearTipoDocumento(factura.client.tipoDocumento),
                municipality_id: factura.client.ciudad // ID del municipio en Factus
            },

            // Items de la factura
            items: factura.items.map(item => ({
                code_reference: item.articulo.codigo,
                name: item.articulo.nombre,
                quantity: item.quantity,
                discount_rate: item.discount || 0,
                price: item.unitPrice,
                tax_rate: item.iva.toString(),
                unit_measure_id: item.articulo.unidadmedida, // 70 = "unidad" (código 94)
                standard_code_id: 1, // 1 = Estándar del contribuyente (999)
                is_excluded: 0, // 0 = No excluido de IVA
                tribute_id: 1, // 1 = IVA (código 01)
                withholding_taxes: [] // Retenciones (opcional)
            })),

            // Cargos adicionales (descuentos globales, recargos)
            ...(this.construirCargosAdicionales(factura).length > 0 ? { allowance_charges: this.construirCargosAdicionales(factura) } : ''),
        };

      return payload;
    }

    /**
     * Construir cargos adicionales (propinas, recargos, descuentos)
     */
    private construirCargosAdicionales(factura: FacturasVenta): AllowanceChargesFactus[] {
        const cargos: AllowanceChargesFactus[] = [];

        // Si hay descuento global
        if (factura.descuento > 0) {
            cargos.push({
                concept_type: "00", // 00 = Descuento general
                is_surcharge: false,
                reason: "Descuento",
                base_amount: factura.subtotal.toString(),
                amount: factura.descuento.toString()
            });
        }

        // Aquí podrías agregar otros cargos como propinas, etc.

        return cargos;
    }

    /**
     * Procesar respuesta de Factus
     */
    private procesarRespuestaFactus(responseData: any): FacturaDianResponse {
        // Factus devuelve status: "Created" cuando es exitoso
        if (responseData.status === 'Created') {
            const bill = responseData.data.bill;

            return {
                cufe: bill.cufe,
                xmlUrl: bill.qr, // URL del QR que también sirve para validar
                pdfUrl: bill.qr, // Factus no devuelve PDF directo, usar CUFE para generar
                qrCode: bill.qr,
                qrImageBase64: bill.qr_image,
                numeroCompleto: bill.number,
                estado: 'aceptada',
                mensaje: responseData.message,
                respuestaCompleta: responseData
            };
        }

        // Si no es "Created", es un rechazo o error
        return {
            cufe: '',
            xmlUrl: '',
            pdfUrl: '',
            qrCode: '',
            qrImageBase64: '',
            numeroCompleto: '',
            estado: 'rechazada',
            mensaje: responseData.message || 'Factura rechazada',
            respuestaCompleta: responseData
        };
    }

    /**
     * Crear nota crédito (anulación de factura)
     */
    async crearNotaCredito(facturaOriginal: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: Array<{}>): Promise<any> {
        try {
            const token = await this.obtenerToken();

            // Construir payload con los datos corregidos para NC
            const payload = this.construirPayloadNotaAjusteFactus(facturaOriginal, motivo, metodoPago, concepto, items, 'credito');

            this.logger.log(`📤 Enviando nota crédito referenciando factura ${facturaOriginal.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v1/credit-notes/validate`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }
                )
            );

            this.logger.log('✅ Respuesta recibida de Factus');

            return this.procesarRespuestaNotaAjusteFactus(response.data, 'credito');

        } catch (error) {
            this.logger.error('❌ Error en Factus:', error.response?.data || error.message);

            if (error.response?.status === 409) {
                throw new BadRequestException('Ya existe una nota crédito pendiente por enviar a DIAN con ese código de referencia');
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar nota crédito a Factus/DIAN');
        }
    }

    /**
     * Crear Nota Débito en DIAN
     */
    async crearNotaDebito(facturaOriginal: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: Array<{}>) {
        try {
            const token = await this.obtenerToken();

            const payload = this.construirPayloadNotaAjusteFactus(facturaOriginal, motivo, metodoPago, concepto, items, 'debito');

            this.logger.log(`📤 Enviando nota débito referenciando factura ${facturaOriginal.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v1/debit-notes/validate`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    }
                )
            );

            this.logger.log('✅ Respuesta recibida de Factus');

            return this.procesarRespuestaNotaAjusteFactus(response.data, 'debito');

        } catch (error) {
            this.logger.error('❌ Error en Factus:', error.response?.data || error.message);

            if (error.response?.status === 409) {
                throw new BadRequestException('Ya existe una nota débito pendiente por enviar a DIAN con ese código de referencia');
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar nota débito a Factus/DIAN');
        }
    }


    /**
     * Construir payload Nota Ajuste para Factus (NC o ND)
     */
    private construirPayloadNotaAjusteFactus(factura: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: any[], tipo: 'credito' | 'debito') {
        const referenceCode = `${factura.comprobante}_${Date.now()}`;

        const isNC = tipo === 'credito';
        
        // Obtener el ID de la factura en el sistema de Factus si existe
        const billId = factura.proveedorResponse?.data?.bill?.id || 
                       factura.proveedorResponse?.data?.id;

        const payload: any = {
            // ID del rango de numeración para NC o ND
            numbering_range_id: this.configService.get<number>(isNC ? 'FACTUS_NC_NUMBERING_RANGE_ID' : 'FACTUS_ND_NUMBERING_RANGE_ID')!,
            
            // Concepto de corrección (según DIAN/Factus)
            correction_concept_code: parseInt(concepto),
            
            // 20 = Nota Crédito que referencia una factura electrónica.
            // 30 = Nota Débito que referencia una factura electrónica.
            customization_id: isNC ? 20 : 30,
            
            // ID de la factura en Factus
            bill_id: billId,
            
            reference_code: referenceCode,
            observation: motivo,

            // Metadatos de la factura original para facilitar procesamiento
            payment_form: factura.formaPago == 'CONTADO' ? '1' : '2',
            payment_due_date: factura.fechaVencimiento || factura.fecha,
            payment_method_code: metodoPago || '10',

            // Datos del establecimiento/sucursal
            establishment: {
                name: this.configService.get<string>('FACTUS_ESTABLISHMENT_NAME', 'Sucursal Principal'),
                address: this.configService.get<string>('FACTUS_ESTABLISHMENT_ADDRESS')!,
                phone_number: this.configService.get<string>('FACTUS_ESTABLISHMENT_PHONE')!,
                email: this.configService.get<string>('FACTUS_ESTABLISHMENT_EMAIL')!,
                municipality_id: this.configService.get<number>('FACTUS_ESTABLISHMENT_MUNICIPALITY_ID')!
            },

            // Datos del cliente
            customer: {
                identification: factura.client.numeroDocumento,
                dv: factura.client.dv || null,
                company: factura.client.razonSocial || "",
                trade_name: factura.client.nombre + " " + factura.client.apellido,
                names: factura.client.nombre + " " + factura.client.apellido,
                address: factura.client.direccion,
                email: factura.client.email,
                phone: factura.client.telefono,
                legal_organization_id: factura.client.tipoPersona == 'PN' ? 2 : 1,
                tribute_id: factura.client.tributo || 21,
                identification_document_id: factura.client.tipoDocumento,
                municipality_id: factura.client.ciudad
            },

            // Items de la nota (ya vienen mapeados por el servicio de Notas de Ajuste)
            items: items.map(item => ({
                code_reference: item.codigo_referencia || 'Generico', // Fallback si no hay código
                name: item.descripcion,
                quantity: item.cantidad,
                discount_rate: 0,
                price: item.valorUnitario,
                tax_rate: (item.porcentajeIVA || 0).toString(),
                unit_measure_id: item.articulo.unidadmedida, // unidad
                standard_code_id: 1, // estandar
                is_excluded: 0,
                tribute_id: 1, // IVA
                withholding_taxes: []
            })),
        };

        return payload;
    }

    /**
     * Procesar respuesta de Factus para Notas de Ajuste
     */
    private procesarRespuestaNotaAjusteFactus(responseData: any, tipo: 'credito' | 'debito'): any {
        if (responseData.status === 'Created') {
            const data = responseData.data;
            const nota = tipo === 'credito' ? data.credit_note : data.debit_note;

            return {
                cufe: nota.cude || nota.cufe, // CUDE para notas de ajuste
                xmlUrl: nota.qr,
                pdfUrl: nota.qr,
                qrCode: nota.qr,
                qrImageBase64: nota.qr_image,
                numeroCompleto: nota.number,
                estado: 'aceptada',
                mensaje: responseData.message,
                respuestaCompleta: responseData
            };
        }

        return {
            cufe: '',
            xmlUrl: '',
            pdfUrl: '',
            qrCode: '',
            qrImageBase64: '',
            numeroCompleto: '',
            estado: 'rechazada',
            mensaje: responseData.message || 'Nota rechazada',
            respuestaCompleta: responseData
        };
    }

    
    // ========== ENDPOINTS DE REFERENCIA ==========

    /**
     * Obtener rangos de numeración disponibles
     */
    async obtenerRangosNumeracion(): Promise<any[]> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/numbering-ranges`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            return response.data.data.data || [];

        } catch (error) {
            this.logger.error('Error obteniendo rangos de numeración:', error);
            return [];
        }
    }

    /**
     * Obtener lista de municipios con códigos
     */
    async obtenerMunicipios(filtros?: filtroMunicipios): Promise<any[]> {
        try {
            const token = await this.obtenerToken();

            let url = `${this.apiUrl}/v1/municipalities`;

            // Agregar filtros si existen
            if (filtros) {
                const params = new URLSearchParams();
                if (filtros.departamento) params.append('filter[department]', filtros.departamento);
                if (filtros.nombre) params.append('filter[name]', filtros.nombre);

                if (params.toString()) {
                    url += `?${params.toString()}`;
                }
            }

            const response = await firstValueFrom(
                this.httpService.get(url, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                })
            );

            return response.data.data || [];

        } catch (error) {
            this.logger.error('Error obteniendo municipios:', error);
            return [];
        }
    }

    /**
     * Descargar PDF de factura usando el numero del documento (en Factus ej. 'fv09008257590002400000241')
     */
    async descargarPDF(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/bills/download-pdf/${numeroCompleto}`, // TODO: Verificar endpoint correcto
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            return {
                buffer: Buffer.from(response.data.data.pdf_base_64_encoded, 'base64'),
                fileName: response.data.data.file_name
            };

        } catch (error) {
            this.logger.error('Error descargando PDF:', error);
            throw new BadRequestException('Error al descargar PDF');
        }
    }

    /**
     * Descargar XML de factura usando el numero del documento (en Factus ej. 'fv09008257590002400000241')
     */
    async descargarXML(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/bills/download-xml/${numeroCompleto}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            return {
                buffer: Buffer.from(response.data.data.xml_base_64_encoded, 'base64'),
                fileName: response.data.data.file_name
            };

        } catch (error) {
            this.logger.error('Error descargando XML:', error);
            throw new BadRequestException('Error al descargar XML');
        }
    }


    /**
     * Descargar PDF de Nota Ajuste usando el numero de la Nota
     */
    async descargarPDFNota(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/credit-notes/download-pdf/${numeroCompleto}`, // TODO: Verificar endpoint correcto
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            return {
                buffer: Buffer.from(response.data.data.pdf_base_64_encoded, 'base64'),
                fileName: response.data.data.file_name
            };

        } catch (error) {
            this.logger.error('Error descargando PDF:', error);
            throw new BadRequestException('Error al descargar PDF');
        }
    }

    /**
     * Descargar XML de Nota Ajuste usando el numero de la Nota
     */
    async descargarXMLNota(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/credit-notes/download-xml/${numeroCompleto}`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            return {
                buffer: Buffer.from(response.data.data.xml_base_64_encoded, 'base64'),
                fileName: response.data.data.file_name
            };

        } catch (error) {
            this.logger.error('Error descargando XML:', error);
            throw new BadRequestException('Error al descargar XML');
        }
    }

    // ========== MÉTODOS AUXILIARES ==========

    /**
     * Mapear método de pago del sistema a código Factus
     */
    private mapearMetodoPago(formaPago: string): string {
        const mapeo: Record<string, string> = {
            'contado': '10',      // Efectivo
            'credito': '1',       // Instrumento no definido
            // 'tarjeta': '48',      // Tarjeta de crédito
            // 'transferencia': '42', // Consignación bancaria
            // 'cheque': '20'        // Cheque
        };
        return mapeo[formaPago.toLowerCase()] || '10';
    }

    /**
     * Mapear tipo de documento de identidad
     */
    private mapearTipoDocumento(tipoDoc: string): number {
        const mapeo: Record<string, number> = {
            'CC': 3,   // Cédula de Ciudadanía
            'CE': 4,   // Cédula de Extranjería
            'NIT': 6,  // NIT
            'TI': 7,   // Tarjeta de Identidad
            'PAS': 5   // Pasaporte
        };
        return mapeo[tipoDoc?.toUpperCase()] || 3;
    }

    /**
     * Validar que tenemos todos los datos necesarios
     */
    private validarDatosFactura(factura: FacturasVenta): void {
        const errores: string[] = [];

        if (!factura.client.numeroDocumento) {
            errores.push('El cliente debe tener número de documento');
        }

        if (!factura.client.email) {
            errores.push('El cliente debe tener email');
        }

        if (!factura.client.nombre) {
            errores.push('El cliente debe tener nombre');
        }

        if (!factura.items || factura.items.length === 0) {
            errores.push('La factura debe tener al menos un item');
        }

        if (errores.length > 0) {
            throw new BadRequestException(
                `Datos incompletos para enviar a DIAN: ${errores.join(', ')}`
            );
        }
    }

    /**
     * Limpiar tokens (útil para testing o logout)
     */
    clearTokens(): void {
        this.accessToken = null;
        this.refreshToken = null;
        this.tokenExpiry = null;
        this.logger.log('🔓 Tokens limpiados');
    }
}