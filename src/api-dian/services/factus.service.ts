import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import * as qs from 'qs';
import * as fs from 'fs';
import * as path from 'path';
import { AllowanceChargesFactus, FacturaDianResponse, FactusTokenResponse, FactusV2BillPayload, FactusV2Customer, FactusV2Item, FactusV2NotaAjustePayload, FactusV2PaymentDetail, FactusV2PrepaymentDetail } from '../interfaces/api-dian-interface';
import { FacturasVenta } from 'src/facturas-ventas/entities/facturas-venta.entity';
import { ItemNotaAjuste } from 'src/notas-ajuste/entities/items-notas-ajuste.entity';
import { EmpresaService } from 'src/settings/empresa/empresa.service';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Municipality } from 'src/core/municipalities/entities/municipality.entity';
import { UnidadMedida } from 'src/core/catalogs/entities/unidad-medida.entity';
import { AnticipoAplicacion, AplicacionEstado } from 'src/pagos/entities/anticipo-aplicacion.entity';

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
    private readonly storageDir: string;
    private accessToken: string | null = null;
    private refreshToken: string | null = null;
    private tokenExpiry: Date | null = null;

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
        private readonly empresaService: EmpresaService,
        @InjectRepository(Municipality)
        private readonly municipalityRepository: Repository<Municipality>,
        @InjectRepository(UnidadMedida)
        private readonly unidadMedidaRepository: Repository<UnidadMedida>,
        @InjectRepository(AnticipoAplicacion)
        private readonly anticipoAplicacionRepository: Repository<AnticipoAplicacion>,
    ) {
        // Ambiente: sandbox para pruebas, producción para real
        const environment = this.configService.get<string>('FACTUS_ENVIRONMENT', 'sandbox');

        if (environment === 'sandbox') {
            this.apiUrl = 'https://api-sandbox.factus.com.co';
            this.oauthUrl = 'https://api-sandbox.factus.com.co/oauth/token';
        } else {
            this.apiUrl = 'https://api.factus.com.co';
            this.oauthUrl = 'https://api.factus.com.co/oauth/token';
        }

        this.logger.log(`🔌 Factus Service inicializado en modo: ${environment}`);

        this.storageDir = path.join(process.cwd(), 'storage', 'facturas');
        this.ensureStorageDir();
    }

    private ensureStorageDir(): void {
        if (!fs.existsSync(this.storageDir)) {
            fs.mkdirSync(this.storageDir, { recursive: true });
            this.logger.log(`📁 Directorio de caché creado: ${this.storageDir}`);
        }
    }

    /**
     * Obtener token de acceso OAuth2
     * El token de Factus expira normalmente en una hora.
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

            const credentials = {
                client_id: this.configService.get<string>('FACTUS_CLIENT_ID'),
                client_secret: this.configService.get<string>('FACTUS_CLIENT_SECRET'),
                username: this.configService.get<string>('FACTUS_USERNAME'),
                password: this.configService.get<string>('FACTUS_PASSWORD'),
            };

            if (Object.values(credentials).some(value => !value)) {
                throw new Error('Faltan credenciales FACTUS para autenticación');
            }

            const data = qs.stringify({ grant_type: 'password', ...credentials });

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

            // Renovar antes de la expiración para evitar solicitudes con token vencido.
            const expiresIn = response.data.expires_in || 3600;
            const safetyWindow = Math.min(60, Math.max(1, expiresIn - 1));
            this.tokenExpiry = new Date(Date.now() + ((expiresIn - safetyWindow) * 1000));

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
            const safetyWindow = Math.min(60, Math.max(1, expiresIn - 1));
            this.tokenExpiry = new Date(Date.now() + ((expiresIn - safetyWindow) * 1000));

            this.logger.log(`✅ Token renovado exitosamente. Expira en ${expiresIn} segundos`);

        } catch (error) {
            this.logger.error('❌ Error renovando token', error.response?.data);
            throw error;
        }
    }

    private getCachedFilePath(numeroCompleto: string, type: 'pdf' | 'xml'): string | null {
        const fileName = `${numeroCompleto}.${type}`;
        const filePath = path.join(this.storageDir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        return null;
    }

    private saveToCache(numeroCompleto: string, type: 'pdf' | 'xml', buffer: Buffer): void {
        const fileName = `${numeroCompleto}.${type}`;
        const filePath = path.join(this.storageDir, fileName);
        fs.writeFileSync(filePath, buffer);
        this.logger.log(`💾 ${type.toUpperCase()} cacheado: ${fileName}`);
    }

    async getCachedPDF(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string } | null> {
        const filePath = this.getCachedFilePath(numeroCompleto, 'pdf');
        if (filePath) {
            this.logger.log(`📄 PDF servido desde caché: ${numeroCompleto}`);
            return {
                buffer: fs.readFileSync(filePath),
                fileName: `${numeroCompleto}.pdf`,
            };
        }
        return null;
    }

    async getCachedXML(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string } | null> {
        const filePath = this.getCachedFilePath(numeroCompleto, 'xml');
        if (filePath) {
            this.logger.log(`📄 XML servido desde caché: ${numeroCompleto}`);
            return {
                buffer: fs.readFileSync(filePath),
                fileName: `${numeroCompleto}.xml`,
            };
        }
        return null;
    }

    async verFacturaByNumero(numeroCompleto: string): Promise<any> {
        try {
            const token = await this.obtenerToken();
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/bills/${numeroCompleto}`,
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
            this.logger.error('Error consultando factura:', error.response?.data || error.message);
            throw new BadRequestException('Error al consultar factura en Factus/DIAN');
        }
    }

    /**
     * Consultar nota por número (crédito o débito)
     */
    async verNotaByNumero(numeroCompleto: string, tipo: 'credito' | 'debito'): Promise<any> {
        try {
            const token = await this.obtenerToken();
            const endpoint = tipo === 'credito' ? 'credit-notes' : 'debit-notes';

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/${endpoint}/${numeroCompleto}`,
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
            this.logger.error(`Error consultando nota ${tipo}:`, error.response?.data || error.message);
            throw new BadRequestException(`Error al consultar nota ${tipo} en Factus/DIAN`);
        }
    }


    /**
     * Crear y validar factura en Factus/DIAN
     */
    async crearYValidarFactura(factura: FacturasVenta, numero: string): Promise<FacturaDianResponse> {
        try {
            const token = await this.obtenerToken();
            this.validarDatosFactura(factura);

            const payload = await this.construirPayloadFactus(factura, numero);

            this.logger.log(`📤 Enviando factura ${factura.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v2/bills/validate`,
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
                const errors = error.response.data?.errors || error.response.data?.data.errors || {};
                const mensajesError = Object.values(errors).flat();
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error?.message || 'Error al enviar factura a Factus/DIAN');
        }
    }

    /**
     * Resolver datos del establecimiento a partir de la configuración de la empresa.
     * Prioridad del municipio (V2 municipality_code):
     * 1. Empresa.ciudad configurada en la aplicación (tabla local de municipios).
     * 2. Variables FACTUS_ESTABLISHMENT_MUNICIPALITY_CODE / _ID como respaldo legacy.
     * El bloque establishment es opcional: se omite si no hay código configurado.
     */
    private async obtenerDatosEstablecimiento(empresa: Empresa) {
        let municipalityCode: string | undefined;

        if (empresa.ciudadRel?.code) {
            municipalityCode = String(empresa.ciudadRel.code);
        } else if (empresa.ciudad !== undefined && empresa.ciudad !== null) {
            const municipio = await this.municipalityRepository.findOne({ where: { id: Number(empresa.ciudad) } });
            if (municipio?.code) {
                municipalityCode = String(municipio.code);
            }
        }

        if (!municipalityCode) {
            municipalityCode =
                this.configService.get<string>('FACTUS_ESTABLISHMENT_MUNICIPALITY_CODE') ||
                this.configService.get<string>('FACTUS_ESTABLISHMENT_MUNICIPALITY_ID') ||
                undefined;
        }

        if (!municipalityCode) {
            return undefined;
        }

        return {
            name: empresa.razonSocial || this.configService.get<string>('FACTUS_ESTABLISHMENT_NAME', 'Sucursal Principal'),
            address: empresa.direccion || this.configService.get<string>('FACTUS_ESTABLISHMENT_ADDRESS') || 'Sin dirección',
            phone_number: empresa.telefono || this.configService.get<string>('FACTUS_ESTABLISHMENT_PHONE') || '0000000',
            email: empresa.email || this.configService.get<string>('FACTUS_ESTABLISHMENT_EMAIL') || 'sin-correo@empresa.co',
            municipality_code: String(municipalityCode),
        };
    }

    private toDecimalString(value: number | string | null | undefined): string {
        const num = Number(value ?? 0);
        if (!Number.isFinite(num)) return '0.00';
        return num.toFixed(2);
    }

    private toDateOnly(value: Date | string | null | undefined): string | undefined {
        if (!value) return undefined;
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return undefined;
        return date.toISOString().slice(0, 10);
    }

    /**
     * Mapear tipo de documento interno (tipos_documento.id) a código DIAN V2.
     * Catálogo local: 1 RC, 2 TI, 3 CC, 4 TE, 5 CE, 6 NIT, 7 PAS, 8 DIE, 9 PEP, 10 NIT otro país, 11 NUIP.
     */
    private mapearTipoDocumentoCodigo(tipoDocumentoId: number | string): string {
        const mapa: Record<string, string> = {
            '1': '11', // Registro civil
            '2': '12', // Tarjeta de identidad
            '3': '13', // Cédula de ciudadanía
            '4': '21', // Tarjeta de extranjería
            '5': '22', // Cédula de extranjería
            '6': '31', // NIT
            '7': '41', // Pasaporte
            '8': '42', // Documento de identificación extranjero
            '9': '47', // PEP
            '10': '50', // NIT de otro país
            '11': '91', // NUIP
        };
        return mapa[String(tipoDocumentoId)] || '13';
    }

    private async resolverMunicipalityCode(ciudadId: number): Promise<string> {
        const municipio = await this.municipalityRepository.findOne({ where: { id: Number(ciudadId) } });
        if (!municipio?.code) {
            throw new BadRequestException(
                `El cliente tiene un municipio sin código V2 (ciudad=${ciudadId}). Sincronice municipios antes de emitir.`,
            );
        }
        return String(municipio.code);
    }

    private async resolverUnidadMedidaCode(unidadMedidaId: string | number | null | undefined): Promise<string> {
        if (unidadMedidaId === null || unidadMedidaId === undefined || unidadMedidaId === '') {
            return '94';
        }
        const unidad = await this.unidadMedidaRepository.findOne({ where: { id: String(unidadMedidaId) } as any });
        return unidad?.codigo || '94';
    }

    private async construirCustomerV2(factura: FacturasVenta): Promise<FactusV2Customer> {
        const nombreCliente = factura.client.razonSocial || `${factura.client.nombre} ${factura.client.apellido}`;
        const esPersonaNatural = factura.client.tipoPersona === 'PN';
        const esResponsableIva = Number(factura.client.tributo) === 18;

        const customer: FactusV2Customer = {
            identification_document_code: this.mapearTipoDocumentoCodigo(factura.client.tipoDocumento),
            identification: String(factura.client.numeroDocumento),
            dv: factura.client.dv || null,
            legal_organization_code: esPersonaNatural ? '2' : '1',
            tribute_code: esResponsableIva ? '01' : 'ZZ',
            responsibilities: esResponsableIva ? ['O-48'] : ['R-99-PN'],
            address: factura.client.direccion,
            email: factura.client.email,
            phone: factura.client.telefono,
            country_code: 'CO',
            municipality_code: await this.resolverMunicipalityCode(factura.client.ciudad),
        };

        if (esPersonaNatural) {
            customer.names = nombreCliente;
            customer.trade_name = nombreCliente;
        } else {
            customer.company = nombreCliente;
            customer.trade_name = nombreCliente;
        }

        return customer;
    }

    private construirPaymentDetailsV2(factura: FacturasVenta): FactusV2PaymentDetail[] {
        const esCredito = factura.formaPago === 'CREDITO';
        const detail: FactusV2PaymentDetail = {
            payment_form: esCredito ? '2' : '1',
            payment_method_code: factura.metodoPago || '10',
            amount: this.toDecimalString(factura.total),
        };

        if (esCredito) {
            const dueDate = this.toDateOnly(factura.fechaVencimiento);
            if (!dueDate) {
                throw new BadRequestException('La factura a crédito requiere fecha de vencimiento (due_date) para DIAN V2');
            }
            detail.due_date = dueDate;
        }

        return [detail];
    }

    private async construirPrepaymentDetailsV2(facturaId: string): Promise<FactusV2PrepaymentDetail[] | undefined> {
        const aplicaciones = await this.anticipoAplicacionRepository.find({
            where: {
                facturaVentaId: facturaId,
                estado: In([AplicacionEstado.BORRADOR, AplicacionEstado.ACTIVO]),
            },
            relations: ['anticipo'],
        });

        if (!aplicaciones.length) return undefined;

        return aplicaciones.map((app) => ({
            reference_code: app.anticipo?.numero || app.anticipoId,
            received_date: this.toDateOnly(app.anticipo?.fecha || app.fecha) || new Date().toISOString().slice(0, 10),
            amount: this.toDecimalString(app.montoAplicado),
            note: `Anticipo ${app.anticipo?.numero || ''}`.trim(),
        }));
    }

    private async construirItemsV2(factura: FacturasVenta): Promise<FactusV2Item[]> {
        return Promise.all(
            factura.items.map(async (item) => {
                const tasaIva = Number(item.iva) || 0;
                return {
                    code_reference: item.articulo?.codigo || String(item.articuloId),
                    name: item.articulo?.nombre || item.description || 'Ítem',
                    quantity: this.toDecimalString(item.quantity),
                    discount_rate: this.toDecimalString(item.discount || 0),
                    price: this.toDecimalString(item.unitPrice),
                    unit_measure_code: await this.resolverUnidadMedidaCode(item.articulo?.unidadmedida),
                    standard_code: '999',
                    note: item.description?.slice(0, 500) || undefined,
                    taxes: [
                        {
                            code: '01',
                            rate: this.toDecimalString(tasaIva),
                            ...(tasaIva === 0 ? { is_excluded: true } : {}),
                        },
                    ],
                };
            }),
        );
    }

    /**
     * Construir payload V2 para Factus (/v2/bills/validate)
     */
    private async construirPayloadFactus(factura: FacturasVenta, numero: string): Promise<FactusV2BillPayload> {
        const empresa = await this.empresaService.getEmpresaEntity();
        const establishment = await this.obtenerDatosEstablecimiento(empresa);
        const paymentDetails = this.construirPaymentDetailsV2(factura);
        const prepaymentDetails = await this.construirPrepaymentDetailsV2(factura.id);

        const numberingRangeId = await this.resolverNumberingRangeId('FACTUS_NUMBERING_RANGE_ID', '01');

        const payload: FactusV2BillPayload = {
            reference_code: numero,
            document: '01',
            operation_type: '10',
            observation: factura.observaciones?.slice(0, 250) || undefined,
            cash_rounding_amount: '0.00',
            payment_details: paymentDetails,
            customer: await this.construirCustomerV2(factura),
            items: await this.construirItemsV2(factura),
        };

        if (numberingRangeId !== undefined) {
            payload.numbering_range_id = numberingRangeId;
        }
        if (establishment) {
            payload.establishment = establishment;
        }
        if (prepaymentDetails) {
            payload.prepayment_details = prepaymentDetails;
        }

        const cargos = this.construirCargosAdicionales(factura);
        if (cargos.length > 0) {
            payload.allowance_charges = cargos;
        }

        this.logger.log(`📤 Payload V2 construido para Factus (ref=${numero})`);
        return payload;
    }

    /**
     * Construir cargos adicionales (propinas, recargos, descuentos)
     */
    private construirCargosAdicionales(factura: FacturasVenta): AllowanceChargesFactus[] {
        const cargos: AllowanceChargesFactus[] = [];

        // Si hay descuento global
        if (factura.descuento > 0 && 1 != 1) {
            cargos.push({
                concept_type: "03", // 03 = Recargo condicionado
                is_surcharge: false,
                reason: "Descuento",
                base_amount: this.toDecimalString(factura.subtotal),
                amount: this.toDecimalString(factura.descuento)
            });
        }



        // Aquí podrías agregar otros cargos como propinas, etc.

        return cargos;
    }

    private extraerAdvertenciasDian(errors: any): string[] {
        if (!errors || typeof errors !== 'object') return [];
        const advertencias: string[] = [];
        for (const [codigo, detalle] of Object.entries(errors)) {
            if (Array.isArray(detalle)) {
                advertencias.push(`${codigo}: ${detalle.join(', ')}`);
            } else if (typeof detalle === 'string') {
                advertencias.push(`${codigo}: ${detalle}`);
            } else {
                advertencias.push(`${codigo}: ${JSON.stringify(detalle)}`);
            }
        }
        return advertencias;
    }

    /**
     * Procesar respuesta V2 de Factus.
     * La fuente de verdad es data.is_validated, no solo status === 'Created'.
     */
    private procesarRespuestaFactus(responseData: any): FacturaDianResponse {
        const status: string = responseData?.status || '';
        const data: any = responseData?.data || {};
        const warnings = this.extraerAdvertenciasDian(data?.errors);

        if (status === 'Created' && data?.is_validated !== false && data?.cufe && data?.number) {
            const qr: string = data?.links?.qr || '';
            const publicUrl: string = data?.links?.public_url || '';
            const qrImage: string = data?.qr_image || '';

            return {
                cufe: data.cufe,
                xmlUrl: publicUrl || qr,
                pdfUrl: publicUrl || qr,
                qrCode: qr,
                qrImageBase64: qrImage,
                publicUrl: publicUrl || undefined,
                numeroCompleto: data.number,
                estado: 'aceptada',
                mensaje: warnings.length > 0
                    ? `${responseData.message} | Advertencias DIAN: ${warnings.join('; ')}`
                    : responseData.message,
                respuestaCompleta: responseData,
                warnings,
                errors: data?.errors || {},
            };
        }

        // Si no es "Created" con is_validated, es un rechazo o error
        return {
            cufe: '',
            xmlUrl: '',
            pdfUrl: '',
            qrCode: '',
            qrImageBase64: '',
            numeroCompleto: '',
            estado: 'rechazada',
            mensaje: responseData.message || 'Factura rechazada',
            respuestaCompleta: responseData,
            warnings,
            errors: data?.errors || responseData?.errors || {},
        };
    }

    /**
     * Crear nota crédito (anulación de factura)
     */
    async crearNotaCredito(referenceCode: string, facturaOriginal: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: ItemNotaAjuste[]): Promise<any> {
        try {
            const token = await this.obtenerToken();

            const payload = await this.construirPayloadNotaAjusteFactus(referenceCode, facturaOriginal, motivo, metodoPago, concepto, items, 'credito');

            this.logger.log(`📤 Enviando nota crédito referenciando factura ${facturaOriginal.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v2/credit-notes/validate`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000
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
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar nota crédito a Factus/DIAN');
        }
    }

    /**
     * Crear Nota Débito en DIAN
     */
    async crearNotaDebito(referenceCode: string, facturaOriginal: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: ItemNotaAjuste[]): Promise<any> {
        try {
            const token = await this.obtenerToken();

            const payload = await this.construirPayloadNotaAjusteFactus(referenceCode, facturaOriginal, motivo, metodoPago, concepto, items, 'debito');

            this.logger.log(`📤 Enviando nota débito referenciando factura ${facturaOriginal.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v2/debit-notes/validate`,
                    payload,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        timeout: 60000
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
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar nota débito a Factus/DIAN');
        }
    }


    /**
     * Construir payload V2 de Nota Ajuste para Factus (NC o ND).
     * V2 referencia la factura por bill_number (número oficial DIAN) y usa
     * customer/items con códigos, payment_details[] y cash_rounding_amount.
     */
    private async construirPayloadNotaAjusteFactus(referenceCode: string, factura: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: ItemNotaAjuste[], tipo: 'credito' | 'debito'): Promise<FactusV2NotaAjustePayload> {
        const prefix = tipo === 'credito' ? 'NC' : 'ND';
        const referenceCodeNew = `${prefix}-${referenceCode}_${factura.comprobante_completo}`;

        const isNC = tipo === 'credito';
        const configKey = isNC ? 'FACTUS_NC_NUMBERING_RANGE_ID' : 'FACTUS_ND_NUMBERING_RANGE_ID';

        const empresa = await this.empresaService.getEmpresaEntity();
        const establishment = await this.obtenerDatosEstablecimiento(empresa);
        const numberingRangeId = await this.resolverNumberingRangeId(configKey);

        const totalNota = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

        const payload: FactusV2NotaAjustePayload = {
            reference_code: referenceCodeNew,
            correction_concept_code: String(concepto),
            // 20 = Nota Crédito que referencia una factura electrónica.
            // 30 = Nota Débito que referencia una factura electrónica.
            customization_id: isNC ? '20' : '30',
            bill_number: factura.comprobante_completo,
            observation: (motivo || '').slice(0, 500),
            cash_rounding_amount: '0.00',
            payment_details: [
                {
                    payment_form: '1',
                    payment_method_code: metodoPago || factura.metodoPago || '10',
                    amount: this.toDecimalString(totalNota),
                },
            ],
            customer: await this.construirCustomerV2(factura),
            items: await Promise.all(
                items.map(async (item) => {
                    const tasaIva = Number(item.porcentajeIVA) || 0;
                    return {
                        code_reference: item.articulo?.codigo || String(item.articuloId || 'ITEM'),
                        name: item.articulo?.nombre || 'Ítem',
                        quantity: this.toDecimalString(item.cantidad),
                        discount_rate: this.toDecimalString(item.descuento || 0),
                        price: this.toDecimalString(item.valorUnitario),
                        unit_measure_code: await this.resolverUnidadMedidaCode(item.articulo?.unidadmedida),
                        standard_code: '999',
                        taxes: [
                            {
                                code: '01',
                                rate: this.toDecimalString(tasaIva),
                                ...(tasaIva === 0 ? { is_excluded: true } : {}),
                            },
                        ],
                    };
                }),
            ),
        };

        if (numberingRangeId !== undefined) {
            payload.numbering_range_id = numberingRangeId;
        }
        if (establishment) {
            payload.establishment = establishment;
        }

        return payload;
    }

    /**
     * Procesar respuesta V2 de Factus para Notas de Ajuste.
     * La fuente de verdad es data.is_validated, no solo status === 'Created'.
     */
    private procesarRespuestaNotaAjusteFactus(responseData: any, tipo: 'credito' | 'debito'): any {
        const status: string = responseData?.status || '';
        const data: any = responseData?.data || {};
        const nota: any = tipo === 'credito' ? data.credit_note : data.debit_note;
        const warnings = this.extraerAdvertenciasDian(nota?.errors || data?.errors);

        if (status === 'Created' && nota?.is_validated !== false && nota?.number) {
            const qr: string = nota?.links?.qr || nota?.qr || '';
            const publicUrl: string = nota?.links?.public_url || '';
            const qrImage: string = nota?.qr_image || '';

            return {
                cufe: nota.cufe || '',
                cude: nota.cude || '',
                xmlUrl: publicUrl || qr,
                pdfUrl: publicUrl || qr,
                qrCode: qr,
                qrImageBase64: qrImage,
                publicUrl: publicUrl || undefined,
                numeroCompleto: nota.number,
                estado: 'aceptada',
                mensaje: warnings.length > 0
                    ? `${responseData.message} | Advertencias DIAN: ${warnings.join('; ')}`
                    : responseData.message,
                respuestaCompleta: responseData,
                warnings,
                errors: nota?.errors || data?.errors || {},
            };
        }

        return {
            cufe: '',
            cude: '',
            xmlUrl: '',
            pdfUrl: '',
            qrCode: '',
            qrImageBase64: '',
            numeroCompleto: '',
            estado: 'rechazada',
            mensaje: responseData.message || 'Nota rechazada',
            respuestaCompleta: responseData,
            warnings,
            errors: nota?.errors || data?.errors || responseData?.errors || {},
        };
    }

    async sendEmail(numberFull: string, email: string, pdfBase64?: string): Promise<void> {
        try {
            const token = await this.obtenerToken();

            await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v2/bills/${numberFull}/send-email`,
                    {
                        email: email
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                    }
                )
            );

            this.logger.log(`📧 Email factura ${numberFull} enviado exitosamente: ${email}`);

        } catch (error) {
            this.logger.error(`❌ Error enviando email factura ${numberFull}:`, error.response?.data || error.message);
            throw error;
        }
    }


    // ========== ENDPOINTS DE REFERENCIA ==========

    /**
     * Obtener rangos de numeración disponibles (V2).
     * Acepta filtros opcionales de documento y estado.
     */
    async obtenerRangosNumeracion(filtros?: { document?: string; isActive?: boolean }): Promise<any[]> {
        try {
            const token = await this.obtenerToken();

            const params = new URLSearchParams();
            if (filtros?.document) params.append('filter[document]', filtros.document);
            if (filtros?.isActive !== undefined) params.append('filter[is_active]', filtros.isActive ? '1' : '0');

            const query = params.toString() ? `?${params.toString()}` : '';
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/numbering-ranges${query}`,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            const body = response.data?.data;
            if (Array.isArray(body)) return body;
            if (Array.isArray(body?.data)) return body.data;
            return [];

        } catch (error) {
            this.logger.error('Error obteniendo rangos de numeración:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Resolver el rango de numeración a usar:
     * 1. Variable de entorno (configKey) si está definida.
     * 2. Selección automática del primer rango activo y vigente
     *    (opcionalmente filtrado por código de documento).
     * Retorna undefined para que Factus use el único rango activo por defecto.
     */
    private async resolverNumberingRangeId(configKey: string, documentCode?: string): Promise<number | string | undefined> {
        const rawRangeId = this.configService.get<string | number>(configKey);
        if (rawRangeId !== undefined && rawRangeId !== null && String(rawRangeId).trim() !== '') {
            return Number.isNaN(Number(rawRangeId)) ? rawRangeId : Number(rawRangeId);
        }

        try {
            const rangos = await this.obtenerRangosNumeracion({ document: documentCode, isActive: true });
            const vigentes = rangos.filter((r) => Number(r.is_active) === 1 && Number(r.is_expired) !== 1);
            const candidatos = vigentes.length > 0 ? vigentes : rangos.filter((r) => Number(r.is_active) === 1);
            if (candidatos.length === 0) return undefined;
            if (candidatos.length > 1) {
                this.logger.log(`ℹ️ ${candidatos.length} rangos activos para ${documentCode || 'documento'}; usando ${candidatos[0].id}`);
            }
            return candidatos[0].id;
        } catch {
            return undefined;
        }
    }

    /**
     * Descargar PDF de factura usando el numero del documento (en Factus ej. 'fv09008257590002400000241')
     */
    async descargarPDF(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string }> {
        const cached = await this.getCachedPDF(numeroCompleto);
        if (cached) return cached;

        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/bills/${numeroCompleto}/download-pdf`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            const buffer = Buffer.from(response.data.data.pdf_base_64_encoded, 'base64');
            const fileName = response.data.data.file_name;
            this.saveToCache(numeroCompleto, 'pdf', buffer);

            return { buffer, fileName };

        } catch (error) {
            this.logger.error('Error descargando PDF:', error);
            throw new BadRequestException('Error al descargar PDF');
        }
    }

    /**
     * Descargar XML de factura usando el numero del documento (en Factus ej. 'fv09008257590002400000241')
     */
    async descargarXML(numeroCompleto: string): Promise<{ buffer: Buffer, fileName: string }> {
        const cached = await this.getCachedXML(numeroCompleto);
        if (cached) return cached;

        try {
            const token = await this.obtenerToken();

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/bills/${numeroCompleto}/download-xml`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            const xmlBase64 = response.data.data.xml_base_64_encoded || response.data.data.xml_base64_encoded;
            const buffer = Buffer.from(xmlBase64, 'base64');
            const fileName = response.data.data.file_name;
            this.saveToCache(numeroCompleto, 'xml', buffer);

            return { buffer, fileName };

        } catch (error) {
            this.logger.error('Error descargando XML:', error);
            throw new BadRequestException('Error al descargar XML');
        }
    }


    /**
     * Descargar PDF de Nota Ajuste usando el numero de la Nota
     */
    async descargarPDFNota(numeroCompleto: string, tipo: 'credito' | 'debito' = 'credito'): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();
            const endpoint = tipo === 'credito' ? 'credit-notes' : 'debit-notes';

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/${endpoint}/${numeroCompleto}/download-pdf`,
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
    async descargarXMLNota(numeroCompleto: string, tipo: 'credito' | 'debito' = 'credito'): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();
            const endpoint = tipo === 'credito' ? 'credit-notes' : 'debit-notes';

            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/${endpoint}/${numeroCompleto}/download-xml`,
                    {
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'Accept': 'application/json'
                        }
                    }
                )
            );

            const xmlBase64 = response.data.data.xml_base_64_encoded || response.data.data.xml_base64_encoded;
            return {
                buffer: Buffer.from(xmlBase64, 'base64'),
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
     * @deprecated V1: usar mapearTipoDocumentoCodigo() para V2.
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

        if (!factura.client.nombre && !factura.client.razonSocial) {
            errores.push('El cliente debe tener nombre o razón social');
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
