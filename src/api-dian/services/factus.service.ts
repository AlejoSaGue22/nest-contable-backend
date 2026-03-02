import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';
import { FacturaDianResponse, FactusTokenResponse, filtroMunicipios } from '../interfaces/api-dian-interface';
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
            // const token = await this.obtenerToken();

            // Validar datos requeridos
            this.validarDatosFactura(factura);

            // Construir payload según estructura de Factus
            const payload = this.construirPayloadFactus(factura);

            this.logger.log(`📤 Enviando factura ${factura.comprobante_completo} a Factus...`);

            // const response = await firstValueFrom(
            //     this.httpService.post(
            //         `${this.apiUrl}/v1/bills/validate`,
            //         payload,
            //         {
            //             headers: {
            //                 'Authorization': `Bearer ${token}`,
            //                 'Accept': 'application/json',
            //                 'Content-Type': 'application/json'
            //             },
            //             timeout: 60000 // 60 segundos
            //         }
            //     )
            // );

            this.logger.log('✅ Respuesta recibida de Factus');

            // Procesar respuesta de Factus
            // return this.procesarRespuestaFactus(response.data);
            return payload;

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
    private construirPayloadFactus(factura: FacturasVenta): any {
        // Generar código de referencia único (tu sistema)
        const referenceCode = `${factura.comprobante}_${Date.now()}`;

        return {
            // Código de documento: "01" = Factura de Venta
            document: "01",

            // ID del rango de numeración (obtener de Factus)
            numbering_range_id: this.configService.get<number>('FACTUS_NUMBERING_RANGE_ID'),

            // Código de referencia único (tu sistema)
            reference_code: referenceCode,

            // Observaciones (opcional)
            //   observation: factura?.observaciones || "",

            // Forma de pago: "1" = Contado, "2" = Crédito
            payment_form: factura.formaPago,

            // Fecha de vencimiento - Requerido solo cuando la forma de pago (payment_form) contiene el valor de 2 (pago a crédito).
            payment_due_date: factura.fechaVencimiento,

            // Método de pago: "10" = Efectivo
            payment_method_code: factura.metodoPago,

            // Datos del establecimiento/sucursal
            establishment: {
                name: this.configService.get<string>('FACTUS_ESTABLISHMENT_NAME', 'Sucursal Principal'),
                address: this.configService.get<string>('FACTUS_ESTABLISHMENT_ADDRESS'),
                phone_number: this.configService.get<string>('FACTUS_ESTABLISHMENT_PHONE'),
                email: this.configService.get<string>('FACTUS_ESTABLISHMENT_EMAIL'),
                municipality_id: this.configService.get<number>('FACTUS_ESTABLISHMENT_MUNICIPALITY_ID')
            },

            // Datos del cliente
            customer: {
                identification: factura.client.numeroDocumento,
                dv: factura.client.dv || null,
                company: factura.client.razonSocial || factura.client.nombre + " " + factura.client.apellido,
                trade_name: factura.client.nombre + " " + factura.client.apellido || factura.client.razonSocial,
                names: factura.client.nombre,
                address: factura.client.direccion,
                email: factura.client.email,
                phone: factura.client.telefono,
                legal_organization_id: factura.client.tipoPersona == 'PN' ? 2 : 1,   // 2 = Persona Natural, 1 = Persona Juridica
                tribute_id: factura.client.tributo || "21", // 21 = No aplica
                identification_document_id: factura.client.tipoDocumento, // this.mapearTipoDocumento(factura.client.tipoDocumento),
                municipality_id: factura.client.ciudad || "980" // ID del municipio en Factus
            },

            // Items de la factura
            items: factura.items.map(item => ({
                code_reference: item.articuloId || item.description.substring(0, 10),
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
            allowance_charges: this.construirCargosAdicionales(factura)
        };
    }

    /**
     * Construir cargos adicionales (propinas, recargos, descuentos)
     */
    private construirCargosAdicionales(factura: FacturasVenta): any[] {
        const cargos: any[] = [];

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
    async crearNotaCredito(facturaOriginal: FacturasVenta, motivo: string): Promise<any> {
        try {
            const token = await this.obtenerToken();

            // TODO: Implementar estructura de nota crédito según Factus
            // Similar a crear factura pero con document: "NC" y referenciando factura original

            const payload = {
                document: "91", // Código para nota crédito
                numbering_range_id: this.configService.get<number>('FACTUS_NC_NUMBERING_RANGE_ID'),
                reference_code: `NC_${facturaOriginal.comprobante}_${Date.now()}`,
                observation: motivo,
                // ... resto de campos similares a factura
                // + campos específicos de nota crédito (factura referenciada)
            };

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v1/credit-notes/validate`, // TODO: Verificar endpoint correcto
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

            return response.data;

        } catch (error) {
            this.logger.error('Error creando nota crédito en Factus:', error);
            throw new BadRequestException('Error al crear nota crédito');
        }
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
     * Descargar PDF de factura usando CUFE
     */
    async descargarPDF(cufe: string): Promise<Buffer> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/bills/${cufe}/pdf`, // TODO: Verificar endpoint correcto
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/pdf'
                        },
                        responseType: 'arraybuffer'
                    }
                )
            );

            return Buffer.from(response.data);

        } catch (error) {
            this.logger.error('Error descargando PDF:', error);
            throw new BadRequestException('Error al descargar PDF');
        }
    }

    /**
     * Descargar XML de factura usando CUFE
     */
    async descargarXML(cufe: string): Promise<Buffer> {
        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v1/bills/${cufe}/xml`, // TODO: Verificar endpoint correcto
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/xml'
                        },
                        responseType: 'arraybuffer'
                    }
                )
            );

            return Buffer.from(response.data);

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