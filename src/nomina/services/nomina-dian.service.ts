import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { XMLBuilder } from 'fast-xml-parser';
import { PeriodoNomina } from '../entities/periodo-nomina.entity';
import { Liquidacion } from '../entities/liquidacion.entity';
import { Empleado } from '../entities/empleado.entity';
import { EstadoDianNomina } from '../enums/estado-dian-nomina.enum';
import { EstadoPeriodoNomina } from '../enums/estado-periodo.enum';

const CUNE_SEED = 'N6a6o6m6i6n6a6E6l6e6c6t6r6o6n6i6c6a6';

@Injectable()
export class NominaDianService {
    private readonly logger = new Logger(NominaDianService.name);
    private readonly xmlBuilder: XMLBuilder;

    constructor(
        @InjectRepository(PeriodoNomina)
        private readonly periodoRepo: Repository<PeriodoNomina>,
        @InjectRepository(Liquidacion)
        private readonly liquidacionRepo: Repository<Liquidacion>,
        @InjectRepository(Empleado)
        private readonly empleadoRepo: Repository<Empleado>,
        private readonly configService: ConfigService,
    ) {
        this.xmlBuilder = new XMLBuilder({
            format: true,
            indentBy: '  ',
            ignoreAttributes: false,
            suppressEmptyNode: true,
        });
    }

    async generarEnviarDian(periodoId: string, userId: string) {
        const periodo = await this.periodoRepo.findOne({
            where: { id: periodoId },
            relations: ['createdBy'],
        });
        if (!periodo) throw new NotFoundException('Período no encontrado');
        if (periodo.estado !== EstadoPeriodoNomina.PAGADA && periodo.estado !== EstadoPeriodoNomina.LIQUIDADA) {
            throw new BadRequestException('El período debe estar LIQUIDADA o PAGADA para enviar a DIAN');
        }

        const liquidaciones = await this.liquidacionRepo.find({
            where: { periodoId },
            relations: ['empleado', 'empleado.cargo', 'empleado.centroCosto', 'empleado.eps', 'empleado.afp', 'empleado.ccf', 'empleado.banco'],
        });
        if (!liquidaciones.length) throw new BadRequestException('No hay liquidaciones en este período');

        const xml = await this.construirXmlNomina(periodo, liquidaciones);
        const cune = this.generarCUNE(periodo, liquidaciones, xml);

        await this.periodoRepo.update(periodoId, {
            dianEstado: EstadoDianNomina.ENVIADA,
            dianXml: xml,
            dianCune: cune,
            dianFechaEnvio: new Date(),
            dianNumero: `NOM${periodo.nombre.replace(/[^0-9]/g, '')}`,
        });

        return {
            message: 'Nómina electrónica generada exitosamente',
            cune,
            periodo: await this.periodoRepo.findOne({ where: { id: periodoId } }),
        };
    }

    private async construirXmlNomina(periodo: PeriodoNomina, liquidaciones: Liquidacion[]): Promise<string> {
        const nitEmpresa = this.configService.get<string>('FACTUS_NIT', '900123456');
        const dvEmpresa = this.configService.get<string>('FACTUS_DV', '1');
        const razonSocial = this.configService.get<string>('FACTUS_RAZON_SOCIAL', 'Mi Empresa S.A.S.');
        const direccion = this.configService.get<string>('FACTUS_ESTABLISHMENT_ADDRESS', '');
        const telefono = this.configService.get<string>('FACTUS_ESTABLISHMENT_PHONE', '');
        const email = this.configService.get<string>('FACTUS_ESTABLISHMENT_EMAIL', '');
        const numNomina = `NOM${periodo.nombre.replace(/[^0-9]/g, '')}`;

        const empleadosXml = liquidaciones.map(liq => this.construirEmpleadoXml(liq));

        const totalDevengado = liquidaciones.reduce((s, l) => s + Number(l.totalDevengado), 0);
        const totalDeducciones = liquidaciones.reduce((s, l) => s + Number(l.totalDeducciones), 0);
        const totalNeto = liquidaciones.reduce((s, l) => s + Number(l.netoPagar), 0);

        const xmlObj = {
            '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
            'NominaIndividual': {
                '@_xmlns': 'urn:oasis:names:specification:ubl:schema:xsd:NominaIndividual-2',
                '@_xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
                '@_xmlns:xsd': 'http://www.w3.org/2001/XMLSchema',
                '@_xsi:schemaLocation': 'urn:oasis:names:specification:ubl:schema:xsd:NominaIndividual-2 http://xdoc.dian.gov.co/xsd/ar/gs/sv/pl/anon/xsd/NominaIndividual-2.1.xsd',

                'UBLExtensions': {
                    'UBLExtension': {
                        'ExtensionContent': {
                            'Signature': {
                                '@_Id': 'SignatureNomina',
                                'SignedInfo': {
                                    'CanonicalizationMethod': { '@_Algorithm': 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315' },
                                    'SignatureMethod': { '@_Algorithm': 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256' },
                                    'Reference': { '@_URI': '', 'Transforms': { 'Transform': { '@_Algorithm': 'http://www.w3.org/2000/09/xmldsig#enveloped-signature' } }, 'DigestMethod': { '@_Algorithm': 'http://www.w3.org/2001/04/xmlenc#sha256' }, 'DigestValue': '' }
                                },
                                'SignatureValue': '',
                                'KeyInfo': { 'X509Data': { 'X509Certificate': '' } },
                            }
                        }
                    }
                },

                'NominaIndividual': {
                    '@_version': '1.0',

                    'Proveedor': {
                        'NITProveedor': nitEmpresa,
                        'RazonSocialProveedor': razonSocial,
                    },

                    'CodigoQR': '',

                    'NominaGeneral': {
                        'PeriodoNomina': {
                            'FechaInicio': periodo.fechaInicio.toISOString().split('T')[0],
                            'FechaFinal': periodo.fechaFin.toISOString().split('T')[0],
                        },
                        'PAI': '0',
                        'TipoMoneda': 'COP',
                        'NumeroNomina': numNomina,
                    },

                    'NominaEmpleador': {
                        'NumeroIdentificacionEmpleador': nitEmpresa,
                        'DigitoVerificacionEmpleador': dvEmpresa,
                        'RazonSocialEmpleador': razonSocial,
                        'DireccionEmpleador': direccion,
                        'TelefonoEmpleador': telefono,
                        'CorreoElectronicoEmpleador': email,
                    },

                    'NominaTrabajador': empleadosXml.map(e => e.trabajador),

                    'NominaPago': {
                        'FormaDePago': 'Efectivo',
                        'MetodoDePago': 'Efectivo',
                    },

                    'Devengados': {
                        'Devengado': empleadosXml.map(e => e.devengado),
                    },

                    'Deducciones': {
                        'Deduccion': empleadosXml.map(e => e.deduccion),
                    },

                    'Aportes': {
                        'Aporte': empleadosXml.map(e => e.aporte),
                    },
                }
            }
        };

        const rawXml = this.xmlBuilder.build(xmlObj);
        return rawXml;
    }

    private construirEmpleadoXml(liq: Liquidacion) {
        const emp = liq.empleado;
        const tipoDocMap: Record<string, string> = {
            'CC': '01',
            'CE': '02',
            'NIT': '03',
            'PEP': '04',
            'PPT': '05',
        };

        const trabajador = {
            'TipoDocumentoTrabajador': tipoDocMap[emp.tipoDocumento] || '01',
            'NumeroDocumentoTrabajador': emp.numeroDocumento,
            'PrimerApellido': emp.primerApellido,
            'SegundoApellido': emp.segundoApellido || '',
            'PrimerNombre': emp.primerNombre,
            'SegundoNombre': emp.segundoNombre || '',
            'SalarioBase': Number(emp.salarioBase),
            'SalarioIntegral': emp.salarioIntegral ? 'true' : 'false',
            'TipoContrato': emp.tipoContrato,
            'DiasTrabajados': liq.diasTrabajados,
            'Cargo': emp.cargo?.nombre || '',
            'CentroCosto': emp.centroCosto?.nombre || '',
            'FechaIngreso': emp.fechaIngreso ? new Date(emp.fechaIngreso).toISOString().split('T')[0] : '',
        };

        const devengado: any = {
            'Sueldo': { 'Salario': { 'ValorSalario': Number(liq.salarioDevengado) } },
            'AuxilioTransporte': { 'ValorAuxilioTransporte': Number(liq.auxilioTransporte) },
        };
        if (Number(liq.totalHorasExtras) > 0) {
            devengado['HorasExtras'] = liq.horasExtras?.map(h => ({
                'TipoHoraExtra': h.tipo,
                'Cantidad': h.cantidad,
                'Valor': Number(h.valor),
            })) || [];
        }
        if (Number(liq.totalBonificaciones) > 0) {
            devengado['Bonificaciones'] = liq.bonificaciones?.map(b => ({
                'ConceptoBonificacion': b.concepto,
                'ValorBonificacion': Number(b.valor),
            })) || [];
        }
        if (Number(liq.comisiones) > 0) {
            devengado['Comisiones'] = { 'ValorComision': Number(liq.comisiones) };
        }
        devengado['TotalDevengado'] = Number(liq.totalDevengado);

        const deduccion: any = {
            'Salud': { 'Porcentaje': 4, 'Valor': Number(liq.saludEmpleado) },
            'Pension': { 'Porcentaje': 4, 'Valor': Number(liq.pensionEmpleado) },
            'RetencionFuente': { 'ValorRetencionFuente': Number(liq.retencionFuente) },
        };
        if (liq.otrasDeducciones?.length) {
            deduccion['OtrasDeducciones'] = liq.otrasDeducciones.map(d => ({
                'ConceptoOtraDeduccion': d.concepto,
                'ValorOtraDeduccion': Number(d.valor),
            }));
        }
        deduccion['TotalDeducciones'] = Number(liq.totalDeducciones);

        const aporte: any = {};
        if (liq.aportesEmpleador?.length) {
            liq.aportesEmpleador.forEach(a => {
                if (a.concepto === 'Salud') aporte['Salud'] = { 'Porcentaje': 8.5, 'Valor': Number(a.valor) };
                if (a.concepto === 'Pensión') aporte['Pension'] = { 'Porcentaje': 12, 'Valor': Number(a.valor) };
                if (a.concepto === 'ARL') aporte['ARL'] = { 'Porcentaje': 0, 'Valor': Number(a.valor) };
                if (a.concepto === 'Caja Compensación') aporte['CajaCompensacion'] = { 'Porcentaje': 4, 'Valor': Number(a.valor) };
                if (a.concepto === 'SENA') aporte['SENA'] = { 'Porcentaje': 2, 'Valor': Number(a.valor) };
                if (a.concepto === 'ICBF') aporte['ICBF'] = { 'Porcentaje': 3, 'Valor': Number(a.valor) };
            });
        }
        aporte['TotalAportes'] = Number(liq.totalAportes);

        return { trabajador, devengado, deduccion, aporte };
    }

    private generarCUNE(periodo: PeriodoNomina, liquidaciones: Liquidacion[], xml: string): string {
        try {
            const nitEmpresa = this.configService.get<string>('FACTUS_NIT', '900123456');
            const numNomina = `NOM${periodo.nombre.replace(/[^0-9]/g, '')}`;

            const sha384 = crypto.createHash('sha384');
            const input = `${numNomina}${periodo.fechaFin.toISOString().split('T')[0]}${CUNE_SEED}${nitEmpresa}`;
            sha384.update(input, 'utf8');
            const hash = sha384.digest();
            return hash.toString('base64');
        } catch (error) {
            this.logger.error('Error generando CUNE:', error);
            return '';
        }
    }

    async descargarXmlDian(periodoId: string): Promise<{ xml: string; nombre: string }> {
        const periodo = await this.periodoRepo.findOne({ where: { id: periodoId } });
        if (!periodo) throw new NotFoundException('Período no encontrado');
        if (!periodo.dianXml) throw new BadRequestException('No hay XML DIAN generado para este período');

        return {
            xml: periodo.dianXml,
            nombre: `Nomina_${periodo.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.xml`,
        };
    }
}
