import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PeriodoNomina } from '../entities/periodo-nomina.entity';
import { Liquidacion } from '../entities/liquidacion.entity';
import { Empleado } from '../entities/empleado.entity';
import { EstadoDianNomina } from '../enums/estado-dian-nomina.enum';
import { EstadoPeriodoNomina } from '../enums/estado-periodo.enum';
import { FactusService } from 'src/api-dian/services/factus.service';

@Injectable()
export class NominaDianService {
    private readonly logger = new Logger(NominaDianService.name);

    constructor(
        @InjectRepository(PeriodoNomina)
        private readonly periodoRepo: Repository<PeriodoNomina>,
        @InjectRepository(Liquidacion)
        private readonly liquidacionRepo: Repository<Liquidacion>,
        @InjectRepository(Empleado)
        private readonly empleadoRepo: Repository<Empleado>,
        private readonly factusService: FactusService,
    ) { }

    /**
     * Transmitir el período a DIAN vía Factus: UN documento de nómina
     * electrónica por trabajador (POST /v2/payroll/validate c/u), todos con
     * el mismo rango de numeración payroll resuelto del caché local.
     *
     * - Sin rango vigente → se bloquea todo el envío con mensaje guiado.
     * - Cada trabajador se procesa de forma independiente: el error de uno
     *   no detiene a los demás (se agregan aceptadas/rechazadas).
     * - Reenvío: si la liquidación ya tenía referencia no aceptada, se
     *   elimina el documento no validado en Factus y se reutiliza la referencia.
     */
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

        // Snapshot del rango payroll (una sola resolución para todo el período).
        const snapshot = await this.factusService.resolverSnapshotNomina();

        const resultados: any[] = [];
        let aceptadas = 0;
        let rechazadas = 0;

        for (const liq of liquidaciones) {
            const empleado = liq.empleado;
            const referenceCode =
                liq.dianReferenceCode || `NOM-${periodo.id.slice(0, 8)}-${empleado.numeroDocumento}`;

            try {
                if (liq.dianReferenceCode && liq.dianEstado !== EstadoDianNomina.ACEPTADA) {
                    await this.factusService.eliminarNominaNoValidada(referenceCode).catch(() => undefined);
                }

                const res = await this.factusService.crearYValidarNomina(periodo, liq, empleado, referenceCode, snapshot);
                const aceptada = res.estado === 'aceptada';

                await this.liquidacionRepo.update(liq.id, {
                    dianReferenceCode: referenceCode,
                    dianCune: res.cune || null,
                    dianNumero: res.numero || null,
                    dianEstado: aceptada ? EstadoDianNomina.ACEPTADA : EstadoDianNomina.RECHAZADA,
                    dianMensajeError: aceptada ? null : res.mensaje,
                    dianResponse: res.respuestaCompleta,
                });

                if (aceptada) aceptadas++; else rechazadas++;
                resultados.push({
                    liquidacionId: liq.id,
                    empleadoId: empleado.id,
                    numeroDocumento: empleado.numeroDocumento,
                    referenceCode,
                    estado: res.estado,
                    cune: res.cune,
                    numero: res.numero,
                    mensaje: res.mensaje,
                });
            } catch (error) {
                // Error de datos locales o de red: se registra y se continúa con los demás.
                rechazadas++;
                const mensaje = error.message || 'Error desconocido';
                this.logger.error(`❌ Nómina ${referenceCode} no enviada: ${mensaje}`);
                await this.liquidacionRepo.update(liq.id, {
                    dianReferenceCode: referenceCode,
                    dianEstado: EstadoDianNomina.RECHAZADA,
                    dianMensajeError: mensaje,
                });
                resultados.push({
                    liquidacionId: liq.id,
                    empleadoId: empleado.id,
                    numeroDocumento: empleado.numeroDocumento,
                    referenceCode,
                    estado: 'error',
                    mensaje,
                });
            }
        }

        const primeraAceptada = resultados.find((r) => r.estado === 'aceptada');
        const estadoPeriodo =
            aceptadas === liquidaciones.length
                ? EstadoDianNomina.ACEPTADA
                : rechazadas === liquidaciones.length
                    ? EstadoDianNomina.RECHAZADA
                    : EstadoDianNomina.ENVIADA;

        const updatePeriodo: Record<string, any> = {
            dianEstado: estadoPeriodo,
            dianCune: primeraAceptada?.cune || null,
            dianNumero: primeraAceptada?.numero || null,
            dianFechaEnvio: new Date(),
            dianResponse: { snapshot, total: liquidaciones.length, aceptadas, rechazadas, resultados },
            factusNumberingRangeId: snapshot?.id ?? null,
            factusResolutionNumber: snapshot?.resolutionNumber ?? null,
            factusRangePrefix: snapshot?.prefix ?? null,
        };
        if (estadoPeriodo === EstadoDianNomina.ACEPTADA) {
            updatePeriodo.dianFechaAceptacion = new Date();
        }
        await this.periodoRepo.update(periodoId, updatePeriodo);

        this.logger.log(
            `📤 Nómina ${periodo.nombre} transmitida: ${aceptadas}/${liquidaciones.length} aceptadas (rango ${snapshot?.id})`,
        );

        return {
            message: `Nómina transmitida: ${aceptadas} aceptada(s), ${rechazadas} rechazada(s) de ${liquidaciones.length}`,
            aceptadas,
            rechazadas,
            total: liquidaciones.length,
            periodo: await this.periodoRepo.findOne({ where: { id: periodoId } }),
        };
    }

    /**
     * Descargar XML de la nómina de UN trabajador desde Factus.
     * GET /v2/payrolls/:number/download-xml
     */
    async descargarXmlNominaLiquidacion(liquidacionId: string): Promise<{ buffer: Buffer; fileName: string }> {
        const liq = await this.liquidacionRepo.findOne({ where: { id: liquidacionId }, relations: ['empleado'] });
        if (!liq) throw new NotFoundException('Liquidación no encontrada');
        if (!liq.dianNumero) {
            throw new BadRequestException('Esta liquidación no tiene nómina validada en DIAN');
        }
        return this.factusService.descargarXMLNomina(liq.dianNumero);
    }

    /**
     * Descargar XML del período: trae de Factus el XML de la primera
     * liquidación aceptada (un período = N documentos, uno por trabajador).
     */
    async descargarXmlDian(periodoId: string): Promise<{ xml: string; nombre: string }> {
        const periodo = await this.periodoRepo.findOne({ where: { id: periodoId } });
        if (!periodo) throw new NotFoundException('Período no encontrado');

        const aceptada = await this.liquidacionRepo.findOne({
            where: { periodoId, dianEstado: EstadoDianNomina.ACEPTADA },
            order: { createdAt: 'ASC' },
        });
        if (!aceptada?.dianNumero) {
            throw new BadRequestException('No hay nóminas validadas en DIAN para este período');
        }

        const { buffer } = await this.factusService.descargarXMLNomina(aceptada.dianNumero);
        return {
            xml: buffer.toString('utf-8'),
            nombre: `Nomina_${periodo.nombre.replace(/[^a-zA-Z0-9]/g, '_')}.xml`,
        };
    }
}
