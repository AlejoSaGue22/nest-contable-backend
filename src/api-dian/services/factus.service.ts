import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as fs from 'fs';
import * as path from 'path';
import { AllowanceChargesFactus, FacturaDianResponse, FactusPayrollResult, FactusV2BillPayload, FactusV2Customer, FactusV2Item, FactusV2NotaAjustePayload, FactusV2PaymentDetail, FactusV2PayrollPayload, FactusV2PayrollPayment, FactusV2PayrollSettlement, FactusV2PayrollWorker, FactusV2PrepaymentDetail } from '../interfaces/api-dian-interface';
import { PeriodoNomina } from 'src/nomina/entities/periodo-nomina.entity';
import { Liquidacion } from 'src/nomina/entities/liquidacion.entity';
import { Empleado } from 'src/nomina/entities/empleado.entity';
import { FactusAuthService } from './factus-auth.service';
import { FactusNumberingRangeService, NumberingRangeSnapshot } from 'src/numbering-ranges/factus-numbering-range.service';
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
    private readonly storageDir: string;

    constructor(
        private readonly httpService: HttpService,
        private readonly authService: FactusAuthService,
        private readonly numberingRangeService: FactusNumberingRangeService,
        private readonly empresaService: EmpresaService,
        @InjectRepository(Municipality)
        private readonly municipalityRepository: Repository<Municipality>,
        @InjectRepository(UnidadMedida)
        private readonly unidadMedidaRepository: Repository<UnidadMedida>,
        @InjectRepository(AnticipoAplicacion)
        private readonly anticipoAplicacionRepository: Repository<AnticipoAplicacion>,
    ) {
        this.apiUrl = this.authService.getApiUrl();

        this.logger.log(`🔌 Factus Service inicializado en modo: ${this.authService.getEnvironment()}`);

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
     * Obtener token de acceso OAuth2 (delegado a FactusAuthService con caché).
     */
    private async obtenerToken(): Promise<string> {
        return this.authService.getToken();
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

            const rangeSnapshot = await this.resolverNumberingRangeSnapshot('FACTUS_NUMBERING_RANGE_ID', '01');
            const payload = await this.construirPayloadFactus(factura, numero, rangeSnapshot?.id);

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
            return this.procesarRespuestaFactus(response.data, rangeSnapshot);

        } catch (error) {
            this.logger.error('❌ Error en Factus:', error.response?.data || error.message);

            // Manejar errores específicos de Factus
            if (error.response?.status === 409) {
                throw new BadRequestException('Ya existe una factura pendiente por enviar a DIAN con ese código de referencia');
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                // Invalidación reactiva SOLO si el error 422 está relacionado con el rango/resolución
                if (this.esErrorDeRangoNumeracion(errors, mensajesError)) {
                    await this.numberingRangeService.invalidateCache('billing').catch(() => undefined);
                }
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
            return undefined;
        }

        return {
            name: empresa.razonSocial,
            address: empresa.direccion,
            phone_number: empresa.telefono,
            email: empresa.email,
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

    /**
     * Mapear responsabilidades fiscales según el catálogo oficial de la API V2 de Factus:
     * - O-13: Gran contribuyente
     * - O-15: Autorretenedor
     * - O-23: Agente de retención de IVA
     * - O-47: Régimen simple de tributación
     * - R-99-PN: No responsable (default)
     */
    private resolverResponsabilidadesFactus(client: any): string[] {
        const codigosValidos = new Set(['O-13', 'O-15', 'O-23', 'O-47', 'R-99-PN']);

        let respInput: string[] = [];
        if (Array.isArray(client?.responsabilidades)) {
            respInput = client.responsabilidades.map((r: any) => String(r).trim().toUpperCase());
        } else if (typeof client?.responsabilidades === 'string' && client.responsabilidades.trim()) {
            respInput = client.responsabilidades.split(',').map((r: string) => r.trim().toUpperCase());
        } else if (typeof client?.responsabilidadFiscal === 'string' && client.responsabilidadFiscal.trim()) {
            respInput = client.responsabilidadFiscal.split(',').map((r: string) => r.trim().toUpperCase());
        } else if (typeof client?.responsabilidad === 'string' && client.responsabilidad.trim()) {
            respInput = client.responsabilidad.split(',').map((r: string) => r.trim().toUpperCase());
        }

        // Mapear código no válido en V2 (como O-48) a R-99-PN si no se especifica otra responsabilidad especial
        const filtrados = respInput
            .map((code) => (code === 'O-48' ? 'R-99-PN' : code))
            .filter((code) => codigosValidos.has(code));

        if (filtrados.length > 0) {
            return Array.from(new Set(filtrados));
        }

        return ['R-99-PN'];
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
            responsibilities: this.resolverResponsabilidadesFactus(factura.client),
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
    private async construirPayloadFactus(factura: FacturasVenta, numero: string, numberingRangeId?: number | string): Promise<FactusV2BillPayload> {
        const empresa = await this.empresaService.getEmpresaEntity();
        const establishment = await this.obtenerDatosEstablecimiento(empresa);
        const paymentDetails = this.construirPaymentDetailsV2(factura);
        const prepaymentDetails = await this.construirPrepaymentDetailsV2(factura.id);

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
        if (factura.descuento > 0) {
            cargos.push({
                concept_type: "03", // 03 = Recargo condicionado
                is_surcharge: false,
                reason: "Descuento",
                base_amount: this.toDecimalString(factura.subtotal),
                amount: this.toDecimalString(factura.descuento)
            });
        }

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
    private procesarRespuestaFactus(responseData: any, rangeSnapshot?: NumberingRangeSnapshot | null): FacturaDianResponse {
        const status: string = responseData?.status || '';
        const data: any = responseData?.data || {};
        const warnings = this.extraerAdvertenciasDian(data?.errors);

        if (status === 'Created' && data?.is_validated !== false && data?.cufe && data?.number) {
            const qr: string = data?.links?.qr || '';
            const publicUrl: string = data?.links?.public_url || '';
            const qrImage: string = data?.qr_image || '';

            return {
                cufe: data.cufe,
                xmlUrl: publicUrl,
                pdfUrl: publicUrl,
                qrCode: qr,
                qrImageBase64: qrImage,
                publicUrl: publicUrl,
                numeroCompleto: data.number,
                estado: 'aceptada',
                mensaje: warnings.length > 0
                    ? `${responseData.message} | Advertencias DIAN: ${warnings.join('; ')}`
                    : responseData.message,
                respuestaCompleta: responseData,
                warnings,
                errors: data?.errors || {},
                numberingRangeId: rangeSnapshot?.id ?? null,
                resolutionNumber: rangeSnapshot?.resolutionNumber ?? null,
                rangePrefix: rangeSnapshot?.prefix ?? null,
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
            numberingRangeId: rangeSnapshot?.id ?? null,
            resolutionNumber: rangeSnapshot?.resolutionNumber ?? null,
            rangePrefix: rangeSnapshot?.prefix ?? null,
        };
    }

    /**
     * reference_code estable para NC/ND. Se persiste ANTES de enviar
     * (idempotencia: ante timeout/409 se reconcilia por este código).
     */
    buildNotaReferenceCode(tipo: 'credito' | 'debito', numeroLocal: string, billNumber: string): string {
        const prefix = tipo === 'credito' ? 'NC' : 'ND';
        return `${prefix}-${numeroLocal}_${billNumber}`;
    }

    /**
     * Crear nota crédito (anulación de factura)
     */
    async crearNotaCredito(referenceCode: string, facturaOriginal: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: ItemNotaAjuste[], paymentDetails?: FactusV2PaymentDetail[]): Promise<any> {
        try {
            const token = await this.obtenerToken();

            const rangeSnapshot = await this.resolverNumberingRangeSnapshot('FACTUS_NC_NUMBERING_RANGE_ID', 'NC');
            const payload = await this.construirPayloadNotaAjusteFactus(referenceCode, facturaOriginal, motivo, metodoPago, concepto, items, 'credito', rangeSnapshot?.id, paymentDetails);

            this.logger.log(`📤 Enviando nota crédito referenciando factura ${facturaOriginal.comprobante_completo} a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v2/credit-notes/validate`, payload,
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

            console.log(response.data);
            const sentReference = this.buildNotaReferenceCode('credito', referenceCode, facturaOriginal.comprobante_completo);
            return this.procesarRespuestaNotaAjusteFactus(response.data, 'credito', rangeSnapshot, sentReference);

        } catch (error) {
            this.logger.error('❌ Error en Factus:', error.response?.data || error.message);

            if (error.response?.status === 409) {
                throw new BadRequestException('Ya existe una nota crédito pendiente por enviar a DIAN con ese código de referencia');
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                if (this.esErrorDeRangoNumeracion(errors, mensajesError)) {
                    await this.numberingRangeService.invalidateCache('billing').catch(() => undefined);
                }
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar nota crédito a Factus/DIAN');
        }
    }

    /**
     * Crear Nota Débito en DIAN
     */
    async crearNotaDebito(referenceCode: string, facturaOriginal: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: ItemNotaAjuste[], paymentDetails?: FactusV2PaymentDetail[]): Promise<any> {
        try {
            const token = await this.obtenerToken();

            const rangeSnapshot = await this.resolverNumberingRangeSnapshot('FACTUS_ND_NUMBERING_RANGE_ID', 'ND');
            const payload = await this.construirPayloadNotaAjusteFactus(referenceCode, facturaOriginal, motivo, metodoPago, concepto, items, 'debito', rangeSnapshot?.id, paymentDetails);

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

            const sentReference = this.buildNotaReferenceCode('debito', referenceCode, facturaOriginal.comprobante_completo);
            return this.procesarRespuestaNotaAjusteFactus(response.data, 'debito', rangeSnapshot, sentReference);

        } catch (error) {
            this.logger.error('❌ Error en Factus:', error.response?.data || error.message);

            if (error.response?.status === 409) {
                throw new BadRequestException('Ya existe una nota débito pendiente por enviar a DIAN con ese código de referencia');
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                if (this.esErrorDeRangoNumeracion(errors, mensajesError)) {
                    await this.numberingRangeService.invalidateCache('billing').catch(() => undefined);
                }
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
    private async construirPayloadNotaAjusteFactus(referenceCode: string, factura: FacturasVenta, motivo: string, metodoPago: string, concepto: string, items: ItemNotaAjuste[], tipo: 'credito' | 'debito', numberingRangeId?: number | string, paymentDetails?: FactusV2PaymentDetail[]): Promise<FactusV2NotaAjustePayload> {
        const referenceCodeNew = this.buildNotaReferenceCode(tipo, referenceCode, factura.comprobante_completo);

        const isNC = tipo === 'credito';

        const empresa = await this.empresaService.getEmpresaEntity();
        const establishment = await this.obtenerDatosEstablecimiento(empresa);

        const totalNota = items.reduce((sum, item) => sum + Number(item.total || 0), 0);

        // payment_details lo resuelve el llamador (PaymentDetailsResolver).
        // Legacy: contado + método de la nota/factura. No exponer en UI.
        const resolvedPaymentDetails = paymentDetails ?? [
            {
                payment_form: '1',
                payment_method_code: metodoPago || factura.metodoPago || '10',
                amount: this.toDecimalString(totalNota),
            },
        ];

        const payload: FactusV2NotaAjustePayload = {
            reference_code: referenceCodeNew,
            correction_concept_code: String(concepto),
            // 20 = Nota Crédito que referencia una factura electrónica.
            // 30 = Nota Débito que referencia una factura electrónica.
            customization_id: isNC ? '20' : '30',
            bill_number: factura.comprobante_completo,
            observation: (motivo || '').slice(0, 500),
            cash_rounding_amount: '0.00',
            payment_details: resolvedPaymentDetails,
            customer: await this.construirCustomerV2(factura),
            items: await Promise.all(
                items.map(async (item) => {
                    const tasaIva = Number(item.porcentajeIVA) || 0;
                    const esDescuento = ['3', '5', '6'].includes(String(concepto));
                    // Las líneas de la NC son el CRÉDITO (resultado calculado):
                    // - Devolución/anulación/ajuste: qty × precio acreditado.
                    // - Descuento (3/5/6): línea monetaria 1 × D (item.subtotal
                    //   ya es D + el IVA va en taxes). El descuento ES el
                    //   crédito: discount_rate siempre 0 desde el mapper.
                    const esV2 = item.descuentoValorInput !== null && item.descuentoValorInput !== undefined;
                    const quantity = esDescuento ? 1 : Number(item.cantidad);
                    const price = esDescuento
                        ? Number(item.subtotal)
                        : Number(item.valorUnitario);
                    const note = esDescuento
                        ? `Descuento concepto ${concepto} s/ base ${(Number(item.subtotalOriginal ?? 0)).toFixed(2)}${esV2 && item.descuentoTasaInput ? ` (${item.descuentoTasaInput}%)` : ''}`.slice(0, 500)
                        : concepto === '4' && item.precioNuevo !== null && item.precioNuevo !== undefined
                            ? `Ajuste precio: ${Number(item.precioOriginal ?? 0).toFixed(2)} → ${Number(item.precioNuevo).toFixed(2)}`.slice(0, 500)
                            : undefined;
                    return {
                        code_reference: item.articulo?.codigo || String(item.articuloId || 'ITEM'),
                        name: item.articulo?.nombre || 'Ítem',
                        quantity: this.toDecimalString(quantity),
                        discount_rate: this.toDecimalString(0),
                        price: this.toDecimalString(price),
                        unit_measure_code: await this.resolverUnidadMedidaCode(item.articulo?.unidadmedida),
                        standard_code: '999',
                        ...(note ? { note } : {}),
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
    private procesarRespuestaNotaAjusteFactus(responseData: any, tipo: 'credito' | 'debito', rangeSnapshot?: NumberingRangeSnapshot | null, sentReference?: string): any {
        const status: string = responseData?.status || '';
        const data: any = responseData?.data || {};
        const nota: any = tipo === 'credito' ? data.credit_note : data.debit_note;
        const warnings = this.extraerAdvertenciasDian(data?.errors || []);

        if (status === 'Created' && data?.is_validated !== false && data?.number) {
            const qr: string = data?.links?.qr || data?.qr || '';
            const publicUrl: string = data?.links?.public_url || '';
            const qrImage: string = data?.qr || '';

            return {
                referenceCode: sentReference ?? '',
                cufe: data.bill.cufe || '',
                cude: data.cude || '',
                xmlUrl: publicUrl,
                pdfUrl: publicUrl,
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
                numberingRangeId: rangeSnapshot?.id ?? null,
                resolutionNumber: rangeSnapshot?.resolutionNumber ?? null,
                rangePrefix: rangeSnapshot?.prefix ?? null,
            };
        }

        return {
            referenceCode: sentReference ?? '',
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
            errors: data?.errors || {},
            numberingRangeId: rangeSnapshot?.id ?? null,
            resolutionNumber: rangeSnapshot?.resolutionNumber ?? null,
            rangePrefix: rangeSnapshot?.prefix ?? null,
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

    // ========== NÓMINA ELECTRÓNICA (V2 payroll, un documento por trabajador) ==========

    /**
     * Resolver el snapshot del rango de nómina (dominio payroll, caché local).
     * Sin rango vigente → bloquea el envío con mensaje guiado.
     */
    async resolverSnapshotNomina(): Promise<NumberingRangeSnapshot> {
        return this.numberingRangeService.resolveSnapshot(
            'FACTUS_NOMINA_NUMBERING_RANGE_ID',
            undefined,
            { domain: 'payroll' },
        );
    }

    /**
     * Crear y validar la nómina de UN trabajador en Factus/DIAN.
     * POST /v2/payroll/validate
     */
    async crearYValidarNomina(periodo: PeriodoNomina, liquidacion: Liquidacion, empleado: Empleado, referenceCode: string, rangeSnapshot?: NumberingRangeSnapshot | null): Promise<FactusPayrollResult> {
        const snapshot = rangeSnapshot ?? await this.resolverSnapshotNomina();
        const payload = await this.construirPayloadNomina(periodo, liquidacion, empleado, referenceCode, snapshot?.id);

        try {
            const token = await this.obtenerToken();
            this.logger.log(`📤 Enviando nómina ${referenceCode} (trabajador ${empleado.numeroDocumento}) a Factus...`);

            const response = await firstValueFrom(
                this.httpService.post(
                    `${this.apiUrl}/v2/payroll/validate`,
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

            this.logger.log('✅ Respuesta de nómina recibida de Factus');
            return this.procesarRespuestaNomina(response.data, referenceCode, snapshot);

        } catch (error) {
            this.logger.error('❌ Error en Factus (nómina):', error.response?.data || error.message);

            if (error.response?.status === 409) {
                throw new BadRequestException(`Ya existe una nómina pendiente por enviar a DIAN con la referencia ${referenceCode}`);
            }

            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                if (this.esErrorDeRangoNumeracion(errors, mensajesError)) {
                    await this.numberingRangeService.invalidateCache('payroll').catch(() => undefined);
                }
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }

            throw new BadRequestException(error.response?.data?.message || 'Error al enviar nómina a Factus/DIAN');
        }
    }

    /**
     * Construir payload V2 de nómina para UN trabajador.
     * Mapea el modelo local (Empleado/Liquidacion) a los códigos DIAN/Factus.
     */
    private async construirPayloadNomina(periodo: PeriodoNomina, liquidacion: Liquidacion, empleado: Empleado, referenceCode: string, numberingRangeId?: number | string): Promise<FactusV2PayrollPayload> {
        const fin = periodo.fechaFin instanceof Date ? periodo.fechaFin : new Date(periodo.fechaFin);
        const settlement: FactusV2PayrollSettlement = {
            month: fin.getMonth() + 1,
            year: fin.getFullYear(),
            payroll_period_code: periodo.tipo === 'QUINCENAL' ? '4' : '5',
        };
        if (settlement.payroll_period_code === '4') {
            settlement.pay_period_half = fin.getDate() <= 15 ? '1' : '2';
        }

        const payload: FactusV2PayrollPayload = {
            reference_code: referenceCode,
            observation: `Nómina ${periodo.nombre} - ${empleado.primerNombre} ${empleado.primerApellido}`.slice(0, 250),
            settlement_period: settlement,
            payment: this.construirPagoNomina(periodo, empleado),
            worker: await this.construirWorkerNomina(liquidacion, empleado),
            accruals: this.construirDevengadosNomina(liquidacion),
            deductions: this.construirDeduccionesNomina(liquidacion),
        };

        if (numberingRangeId !== undefined && numberingRangeId !== null) {
            payload.numbering_range_id = numberingRangeId;
        }

        return payload;
    }

    private construirPagoNomina(periodo: PeriodoNomina, empleado: Empleado): FactusV2PayrollPayment {
        const payment: FactusV2PayrollPayment = {
            payment_method_code: this.mapearMetodoPagoNomina(empleado.metodoPago),
            payment_date: this.toDateOnly(periodo.fechaPago) || this.toDateOnly(periodo.fechaFin) || new Date().toISOString().slice(0, 10),
        };

        if (['42', '47', '98'].includes(payment.payment_method_code)) {
            if (empleado.banco?.nombre) payment.bank_name = empleado.banco.nombre;
            if (empleado.tipoCuentaBancaria) payment.account_type = this.mapearTipoCuentaNomina(empleado.tipoCuentaBancaria);
            if (empleado.numeroCuentaBancaria) payment.account_number = empleado.numeroCuentaBancaria;
        }

        return payment;
    }

    private mapearMetodoPagoNomina(metodoPago: string | null | undefined): string {
        if (!metodoPago) return '10';
        const raw = String(metodoPago).trim();
        if (/^\d{2}$/.test(raw)) return raw;
        const norm = raw.toLowerCase();
        if (norm.includes('transfer')) return '47';
        if (norm.includes('consign')) return '42';
        if (norm.includes('cheque')) return '20';
        if (norm.includes('nequi') || norm.includes('daviplata') || norm.includes('cats')) return '98';
        if (norm.includes('efectivo') || norm.includes('contado')) return '10';
        this.logger.warn(`⚠️ Método de pago de nómina no reconocido ("${metodoPago}"); usando 10 (efectivo)`);
        return '10';
    }

    private mapearTipoCuentaNomina(tipo: string): string {
        const norm = String(tipo).toLowerCase();
        if (norm.includes('corriente')) return '3';
        if (norm.includes('ahorro')) return '2';
        if (norm.includes('nomina')) return '1';
        return String(tipo);
    }

    private async construirWorkerNomina(liquidacion: Liquidacion, empleado: Empleado): Promise<FactusV2PayrollWorker> {
        if (!empleado.direccion) {
            throw new BadRequestException(
                `El trabajador ${empleado.numeroDocumento} no tiene dirección registrada (requerida por DIAN para nómina)`,
            );
        }

        const worker: FactusV2PayrollWorker = {
            identification_document_code: this.mapearTipoDocumentoNomina(empleado.tipoDocumento),
            identification_number: String(empleado.numeroDocumento),
            first_name: empleado.primerNombre,
            first_surname: empleado.primerApellido,
            second_surname: empleado.segundoApellido || '',
            address: empleado.direccion,
            country_code: 'CO',
            municipality_code: await this.resolverWorkerMunicipalityCode(),
            has_integral_salary: Boolean(empleado.salarioIntegral),
            // D. 2090/2003: clases de riesgo IV y V son alto riesgo.
            has_high_risk: Number(empleado.arlNivelRiesgo || 0) >= 4,
            worker_type_code: '01',
            worker_subtype: '00',
            contract_type: this.mapearTipoContratoNomina(empleado),
            employee_code: empleado.id,
            salary: this.toDecimalString(empleado.salarioBase),
            entry_date: this.toDateOnly(empleado.fechaIngreso) || new Date().toISOString().slice(0, 10),
            days_worked: String(liquidacion.diasTrabajados ?? 30),
        };

        if (empleado.segundoNombre) worker.other_names = empleado.segundoNombre;
        if (empleado.fechaRetiro) {
            const retiro = this.toDateOnly(empleado.fechaRetiro);
            if (retiro) worker.retirement_date = retiro;
        }

        return worker;
    }

    private mapearTipoDocumentoNomina(tipo: string): string {
        const mapa: Record<string, string> = { CC: '13', CE: '22', NIT: '31', TI: '12', PP: '41' };
        const code = mapa[String(tipo)?.toUpperCase()];
        if (!code) {
            throw new BadRequestException(`Tipo de documento "${tipo}" sin equivalencia DIAN para nómina (CC/CE/NIT/TI/PP)`);
        }
        return code;
    }

    private mapearTipoContratoNomina(empleado: Empleado): string {
        const mapa: Record<string, string> = { FIJO: '1', INDEFINIDO: '2', OBRA_LABOR: '3', APRENDIZAJE: '4' };
        const code = mapa[String(empleado.tipoContrato)?.toUpperCase()];
        if (!code) {
            throw new BadRequestException(
                `El trabajador ${empleado.numeroDocumento} tiene contrato "${empleado.tipoContrato}" sin equivalencia en nómina DIAN (fijo/indefinido/obra/aprendizaje)`,
            );
        }
        return code;
    }

    /**
     * Municipio del trabajador. El modelo local no guarda ciudad por empleado,
     * así que se usa la sede de la empresa como valor por defecto (documentado),
     * con override por variable para casos especiales.
     */
    private async resolverWorkerMunicipalityCode(): Promise<string> {
        const override = this.authService.get('FACTUS_WORKER_MUNICIPALITY_CODE');
        if (override) return String(override);

        const empresa = await this.empresaService.getEmpresaEntity();
        if (empresa.ciudadRel?.code) return String(empresa.ciudadRel.code);
        if (empresa.ciudad !== undefined && empresa.ciudad !== null) {
            const municipio = await this.municipalityRepository.findOne({ where: { id: Number(empresa.ciudad) } });
            if (municipio?.code) return String(municipio.code);
        }
        throw new BadRequestException(
            'No hay municipio para nómina DIAN: configure Empresa.ciudad o FACTUS_WORKER_MUNICIPALITY_CODE',
        );
    }

    private construirDevengadosNomina(liq: Liquidacion): Record<string, unknown> {
        const accruals: Record<string, unknown> = {
            suel: { amount: this.toDecimalString(liq.salarioDevengado) },
        };

        if (Number(liq.auxilioTransporte) > 0) {
            accruals.tra = [{ amount: this.toDecimalString(liq.auxilioTransporte), accrual_type_code: '1' }];
        }
        if (liq.horasExtras?.length) {
            accruals.hora = liq.horasExtras.map((h) => {
                const code = this.mapearTipoHoraExtra(h.tipo);
                return {
                    quantity: Number(h.cantidad) || 0,
                    // Recargos legales estándar por código (Ley 50/1990, CST).
                    percentage: this.porcentajeHoraExtra(code),
                    amount: this.toDecimalString(h.valor),
                    accrual_type_code: code,
                };
            });
        }
        if (liq.bonificaciones?.length) {
            accruals.boni = liq.bonificaciones.map((b) => ({
                amount: this.toDecimalString(b.valor),
                accrual_type_code: b.salarial ? '1' : '2',
            }));
        }
        if (Number(liq.comisiones) > 0) {
            accruals.comi = [{ amount: this.toDecimalString(liq.comisiones), accrual_type_code: '1' }];
        }

        return accruals;
    }

    /** Mapeo tolerante del tipo de hora extra local a código DIAN 1-7. */
    private mapearTipoHoraExtra(tipo: string): string {
        const norm = String(tipo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const domFest = norm.includes('dominical') || norm.includes('festiv');
        const noct = norm.includes('nocturn');
        const recargo = norm.includes('recargo');
        if (domFest && noct && !recargo) return '6';
        if (domFest && noct) return '7';
        if (domFest && !recargo) return '4';
        if (domFest) return '5';
        if (noct && !recargo) return '2';
        if (noct) return '3';
        return '1';
    }

    /** Recargo legal estándar por código de hora extra (documentado en el payload). */
    private porcentajeHoraExtra(code: string): string {
        const mapa: Record<string, string> = { '1': '25.00', '2': '75.00', '3': '35.00', '4': '100.00', '5': '80.00', '6': '150.00', '7': '110.00' };
        return mapa[code] || '25.00';
    }

    private construirDeduccionesNomina(liq: Liquidacion): Record<string, unknown> {
        // salu/pens son requeridos por el esquema: se envían siempre (aunque sea 0.00).
        const deductions: Record<string, unknown> = {
            salu: { percentage: '4.00', amount: this.toDecimalString(liq.saludEmpleado) },
            pens: { percentage: '4.00', amount: this.toDecimalString(liq.pensionEmpleado) },
        };

        if (Number(liq.retencionFuente) > 0) {
            deductions.rete = { amount: this.toDecimalString(liq.retencionFuente) };
        }
        if (liq.otrasDeducciones?.length) {
            deductions.otra = liq.otrasDeducciones.map((d) => ({
                amount: this.toDecimalString(d.valor),
                description: String(d.concepto || 'Otra deducción').slice(0, 200),
            }));
        }

        return deductions;
    }

    /**
     * Procesar respuesta V2 de Factus para nómina (tolerante al shape).
     */
    private procesarRespuestaNomina(responseData: any, referenceCode: string, snapshot?: NumberingRangeSnapshot | null): FactusPayrollResult {
        const status: string = responseData?.status || '';
        const data: any = responseData?.data || {};
        const payroll: any = data?.payroll || data;
        const warnings = this.extraerAdvertenciasDian(data?.errors);
        const cune: string = payroll?.cune || data?.cune || '';
        const numero: string = payroll?.number || data?.number || '';

        if (status === 'Created' && data?.is_validated !== false && (cune || numero)) {
            return {
                estado: 'aceptada',
                referenceCode,
                cune,
                numero,
                mensaje: warnings.length > 0
                    ? `${responseData.message} | Advertencias DIAN: ${warnings.join('; ')}`
                    : responseData.message,
                respuestaCompleta: responseData,
                warnings,
                errors: data?.errors || {},
                numberingRangeId: snapshot?.id ?? null,
                resolutionNumber: snapshot?.resolutionNumber ?? null,
                rangePrefix: snapshot?.prefix ?? null,
            };
        }

        return {
            estado: 'rechazada',
            referenceCode,
            cune: '',
            numero: '',
            mensaje: responseData.message || 'Nómina rechazada',
            respuestaCompleta: responseData,
            warnings,
            errors: data?.errors || responseData?.errors || {},
            numberingRangeId: snapshot?.id ?? null,
            resolutionNumber: snapshot?.resolutionNumber ?? null,
            rangePrefix: snapshot?.prefix ?? null,
        };
    }

    /** Ver nómina por reference_code. GET /v2/payrolls/reference/:reference_code */
    async verNominaByReference(referenceCode: string): Promise<any> {
        try {
            const token = await this.obtenerToken();
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/payrolls/reference/${referenceCode}`,
                    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
                ),
            );
            return response.data;
        } catch (error) {
            this.logger.error('Error consultando nómina:', error.response?.data || error.message);
            throw new BadRequestException('Error al consultar nómina en Factus/DIAN');
        }
    }

    /** Descargar XML de nómina por número. GET /v2/payrolls/:number/download-xml */
    async descargarXMLNomina(numero: string): Promise<{ buffer: Buffer, fileName: string }> {
        try {
            const token = await this.obtenerToken();
            const response = await firstValueFrom(
                this.httpService.get(
                    `${this.apiUrl}/v2/payrolls/${numero}/download-xml`,
                    { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
                ),
            );
            const xmlBase64 = response.data.data.xml_base_64_encoded || response.data.data.xml_base64_encoded;
            return {
                buffer: Buffer.from(xmlBase64, 'base64'),
                fileName: response.data.data.file_name,
            };
        } catch (error) {
            this.logger.error('Error descargando XML de nómina:', error.response?.data || error.message);
            throw new BadRequestException('Error al descargar XML de nómina');
        }
    }

    /** Eliminar nómina NO validada por reference_code (permite reenvío). */
    async eliminarNominaNoValidada(referenceCode: string): Promise<void> {
        const token = await this.obtenerToken();
        await firstValueFrom(
            this.httpService.delete(
                `${this.apiUrl}/v2/payrolls/reference/${referenceCode}`,
                { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } },
            ),
        );
        this.logger.log(`🗑️ Nómina no validada ${referenceCode} eliminada en Factus`);
    }

    /**
     * Nota de ajuste a nómina (eliminación ante DIAN de una nómina validada).
     * POST /v2/adjustment-payrolls
     */
    async crearNotaAjusteNomina(payrollNumber: string, referenceCode: string, numberingRangeId?: number | string): Promise<any> {
        try {
            const token = await this.obtenerToken();
            const body: Record<string, unknown> = { payroll_number: payrollNumber, reference_code: referenceCode };
            if (numberingRangeId !== undefined && numberingRangeId !== null) {
                body.numbering_range_id = numberingRangeId;
            }
            const response = await firstValueFrom(
                this.httpService.post(`${this.apiUrl}/v2/adjustment-payrolls`, body, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    timeout: 60000,
                }),
            );
            return response.data;
        } catch (error) {
            this.logger.error('❌ Error en nota de ajuste de nómina:', error.response?.data || error.message);
            if (error.response?.status === 422) {
                const errors = error.response.data?.errors || error.response.data?.data?.errors || {};
                const mensajesError = Object.values(errors).flat();
                if (this.esErrorDeRangoNumeracion(errors, mensajesError)) {
                    await this.numberingRangeService.invalidateCache('payroll').catch(() => undefined);
                }
                throw new BadRequestException(`Datos inválidos: ${mensajesError.join(', ')}`);
            }
            throw new BadRequestException(error.response?.data?.message || 'Error al crear nota de ajuste de nómina');
        }
    }

    /**
     * Verificar si un error HTTP 422 está relacionado específicamente con el rango de numeración
     * (numbering_range_id, resolución, consecutivo, etc.) para evitar invalidar el caché
     * cuando el error es por otros datos del payload (cliente, items, responsabilidades, etc.).
     */
    private esErrorDeRangoNumeracion(errorsObj: any, mensajesErrorList: any[]): boolean {
        if (!errorsObj && (!mensajesErrorList || mensajesErrorList.length === 0)) return false;

        const keys = Object.keys(errorsObj || {}).map((k) => k.toLowerCase());
        const tieneKeyRango = keys.some(
            (k) => k.includes('numbering_range') || k.includes('resolution') || k.includes('numbering')
        );

        if (tieneKeyRango) return true;

        const textoError = (mensajesErrorList || []).map((m) => String(m).toLowerCase()).join(' ');
        const palabrasClave = [
            'numbering_range',
            'rango de numeración',
            'rango de numeracion',
            'resolución',
            'resolucion',
            'consecutivo',
            'número de factura',
            'numero de factura',
            'rango vencido',
            'rango agotado',
            'rango inactivo',
            'expired',
            'exhausted',
        ];

        return palabrasClave.some((pc) => textoError.includes(pc));
    }

    // ========== ENDPOINTS DE REFERENCIA ==========

    /**
     * Obtener rangos de numeración desde el caché local (0 llamadas a Factus).
     * Con `forceRefresh=true` sincroniza primero contra la API.
     */
    async obtenerRangosNumeracion(filtros?: { document?: string; isActive?: boolean }, forceRefresh = false): Promise<any[]> {
        if (forceRefresh) {
            await this.numberingRangeService.syncFromApi('billing');
        }
        return this.numberingRangeService.listCached({
            domain: 'billing',
            document: filtros?.document,
            isActive: filtros?.isActive,
        });
    }

    /**
     * Resolver el rango de numeración a usar (caché local, sin HTTP):
     * 1. Variable de entorno (configKey) si está definida.
     * 2. Primer rango activo y vigente del caché, determinístico.
     * 3. Sin rango vigente → lanza BadRequestException (bloquea la emisión
     *    con mensaje guiado; nunca se emite sin resolución DIAN válida).
     */
    private async resolverNumberingRangeId(configKey: string, documentCode?: string): Promise<number | string | undefined> {
        return this.numberingRangeService.resolveId(configKey, documentCode, { domain: 'billing' });
    }

    private async resolverNumberingRangeSnapshot(configKey: string, documentCode?: string): Promise<NumberingRangeSnapshot> {
        return this.numberingRangeService.resolveSnapshot(configKey, documentCode, { domain: 'billing' });
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
        this.authService.clearTokens();
    }
}
