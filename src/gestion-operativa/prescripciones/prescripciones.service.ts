import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, ObjectLiteral, Repository } from 'typeorm';
import * as fs from 'fs';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';
import { CreatePrescripcionDto } from './dto/create-prescripcion.dto';
import { PrescripcionFilterDto } from './dto/prescripcion-filter.dto';
import { UpdatePrescripcionDto } from './dto/update-prescripcion.dto';
import { Prescripcion, PrescripcionEstado } from './entities/prescripcion.entity';
import { ProfesionalResponsable } from './entities/profesional-responsable.entity';
import { TipoExamenPrescripcion } from './entities/tipo-examen-prescripcion.entity';
import { SaveTipoExamenDto } from './dto/save-tipo-examen.dto';
import { SaveProfesionalResponsableDto } from './dto/save-profesional-responsable.dto';

@Injectable()
export class PrescripcionesService implements OnModuleInit {
  constructor(
    @InjectRepository(Prescripcion) private readonly repo: Repository<Prescripcion>,
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(ProfesionalResponsable) private readonly profesionales: Repository<ProfesionalResponsable>,
    @InjectRepository(TipoExamenPrescripcion) private readonly tiposExamen: Repository<TipoExamenPrescripcion>,
    @InjectRepository(Empresa) private readonly empresas: Repository<Empresa>,
  ) { }

  async onModuleInit() {
    const empresa = await this.empresas.findOne({ where: {} });
    await this.tiposExamen.createQueryBuilder()
      .insert()
      .into(TipoExamenPrescripcion)
      .values([
        { codigo: 'VALORACION_VISUAL', nombre: 'Valoración Visual', activo: true },
        { codigo: 'CONTROL', nombre: 'Control Periódico', activo: true },
        { codigo: 'ADAPTACION', nombre: 'Adaptación de Lentes de Contacto', activo: true },
      ])
      .orIgnore()
      .execute();

    // const seededProfessionalQuery = this.profesionales.createQueryBuilder('profesional')
    //   .where('profesional.nombre = :nombre', { nombre: 'Dra. Ailin Gomez' });
    // this.applyCompanyScope(seededProfessionalQuery, 'profesional', empresa?.id ?? null);
    // const seededProfessional = await seededProfessionalQuery.getOne();
    // if (!seededProfessional) {
    //   await this.profesionales.save(this.profesionales.create({
    // nombre: 'Dra. Ailin Gomez',
    // especialidad: 'Optometría',
    // registroProfesional: '231715',
    // activo: true,
    // empresaId: empresa?.id ?? null,

  }

  async findAll(filter: PrescripcionFilterDto, empresaId: string | null) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 10));
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.cliente', 'cliente')
      .leftJoinAndSelect('cliente.tipoDocumentoRel', 'tipoDocumentoRel')
      .leftJoinAndSelect('p.profesional', 'profesional')
      .leftJoinAndSelect('p.tipoExamenRel', 'tipoExamenRel')
      .orderBy('p.fechaExamen', 'DESC').addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit).take(limit);
    if (empresaId) qb.andWhere('p.empresaId = :empresaId', { empresaId });
    else qb.andWhere('p.empresaId IS NULL');
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim().toLowerCase()}%`;
      qb.andWhere(new Brackets((w) => w
        .where('LOWER(p.numero) LIKE :term', { term })
        .orWhere('LOWER(cliente.nombre) LIKE :term', { term })
        .orWhere('LOWER(cliente.apellido) LIKE :term', { term })
        .orWhere('LOWER(cliente.razonSocial) LIKE :term', { term })
        .orWhere('LOWER(cliente.numeroDocumento) LIKE :term', { term })));
    }
    if (filter.desde) qb.andWhere('p.fechaExamen >= :desde', { desde: filter.desde });
    if (filter.hasta) qb.andWhere('p.fechaExamen <= :hasta', { hasta: filter.hasta });
    if (filter.profesionalId) qb.andWhere('p.profesionalId = :profesionalId', { profesionalId: filter.profesionalId });
    if (filter.tipoLente && filter.tipoLente !== 'ALL') {
      qb.andWhere('p.tipoLente = :tipoLente', { tipoLente: filter.tipoLente });
    }

    // Contadores para las tarjetas informativas respetando filtros de búsqueda/fecha
    const countQb = this.repo.createQueryBuilder('p');
    if (empresaId) countQb.andWhere('p.empresaId = :empresaId', { empresaId });
    else countQb.andWhere('p.empresaId IS NULL');
    if (filter.search?.trim()) {
      countQb.leftJoin('p.cliente', 'cliente');
      const term = `%${filter.search.trim().toLowerCase()}%`;
      countQb.andWhere(new Brackets((w) => w
        .where('LOWER(p.numero) LIKE :term', { term })
        .orWhere('LOWER(cliente.nombre) LIKE :term', { term })
        .orWhere('LOWER(cliente.apellido) LIKE :term', { term })
        .orWhere('LOWER(cliente.razonSocial) LIKE :term', { term })
        .orWhere('LOWER(cliente.numeroDocumento) LIKE :term', { term })));
    }
    if (filter.desde) countQb.andWhere('p.fechaExamen >= :desde', { desde: filter.desde });
    if (filter.hasta) countQb.andWhere('p.fechaExamen <= :hasta', { hasta: filter.hasta });
    if (filter.profesionalId) countQb.andWhere('p.profesionalId = :profesionalId', { profesionalId: filter.profesionalId });

    const [totalGeneral, totalOftalmico, totalContacto] = await Promise.all([
      countQb.clone().getCount(),
      countQb.clone().andWhere('p.tipoLente = :t', { t: 'OFTALMICO' }).getCount(),
      countQb.clone().andWhere('p.tipoLente = :t', { t: 'CONTACTO' }).getCount(),
    ]);

    const [data, total] = await qb.getManyAndCount();
    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        totalGeneral,
        totalOftalmico,
        totalContacto,
      },
    };
  }

  async findOne(id: string, empresaId: string | null) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.cliente', 'cliente')
      .leftJoinAndSelect('cliente.tipoDocumentoRel', 'tipoDocumentoRel')
      .leftJoinAndSelect('p.profesional', 'profesional')
      .leftJoinAndSelect('p.tipoExamenRel', 'tipoExamenRel')
      .leftJoinAndSelect('p.creadoPor', 'creadoPor')
      .where('p.id = :id', { id });
    this.applyCompanyScope(qb, 'p', empresaId);
    const item = await qb.getOne();
    if (!item) throw new NotFoundException('Prescripción no encontrada');
    return item;
  }

  async create(dto: CreatePrescripcionDto, userId: string, empresaId: string | null) {
    const { tipoExamen, profesional } = await this.ensureReferences(dto, empresaId);
    if (!tipoExamen) throw new BadRequestException('Debes seleccionar un tipo de examen');
    const numero = await this.nextNumber(empresaId);
    return this.repo.save(this.repo.create({
      ...dto,
      tipoExamen: tipoExamen.codigo,
      tipoExamenRel: tipoExamen,
      profesional: profesional || null,
      empresaId,
      numero,
      creadoPorId: userId,
    }));
  }

  async update(id: string, dto: UpdatePrescripcionDto, empresaId: string | null) {
    const current = await this.findOne(id, empresaId);
    if (current.estado === PrescripcionEstado.ANULADA) throw new BadRequestException('No se puede editar una prescripción anulada');
    const refs = await this.ensureReferences(dto, empresaId);
    Object.assign(current, dto);
    if (dto.tipoExamenId && refs.tipoExamen) {
      current.tipoExamen = refs.tipoExamen.codigo;
      current.tipoExamenRel = refs.tipoExamen;
    }
    if (dto.profesionalId !== undefined) current.profesional = refs.profesional || null;
    return this.repo.save(current);
  }

  async cancel(id: string, empresaId: string | null) {
    const current = await this.findOne(id, empresaId);
    current.estado = PrescripcionEstado.ANULADA;
    return this.repo.save(current);
  }

  async history(clienteId: string, empresaId: string | null) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.profesional', 'profesional')
      .leftJoinAndSelect('p.tipoExamenRel', 'tipoExamenRel')
      .where('p.clienteId = :clienteId', { clienteId })
      .orderBy('p.fechaExamen', 'DESC');
    this.applyCompanyScope(qb, 'p', empresaId);
    return qb.getMany();
  }

  async listTiposExamen(empresaId: string | null) {
    const qb = this.tiposExamen.createQueryBuilder('tipo').where('tipo.activo = true');
    this.applyCompanyScope(qb, 'tipo', empresaId, true);
    return qb.orderBy('tipo.nombre', 'ASC').getMany();
  }

  async createTipoExamen(dto: SaveTipoExamenDto, empresaId: string | null) {
    return this.tiposExamen.save(this.tiposExamen.create({ ...dto, empresaId }));
  }

  async updateTipoExamen(id: string, dto: Partial<SaveTipoExamenDto>, empresaId: string | null) {
    const item = await this.findOwned(this.tiposExamen, 'tipo', id, empresaId);
    if (!item) throw new NotFoundException('Tipo de examen no encontrado');
    Object.assign(item, dto);
    return this.tiposExamen.save(item);
  }

  async listProfesionales(empresaId: string | null, includeInactive = false) {
    const qb = this.profesionales.createQueryBuilder('profesional');
    if (!includeInactive) qb.where('profesional.activo = true');
    this.applyCompanyScope(qb, 'profesional', empresaId, true);
    return qb.orderBy('profesional.nombre', 'ASC').getMany();
  }

  async createProfesional(dto: SaveProfesionalResponsableDto, empresaId: string | null) {
    return this.profesionales.save(this.profesionales.create({ ...dto, empresaId }));
  }

  async updateProfesional(id: string, dto: Partial<SaveProfesionalResponsableDto>, empresaId: string | null) {
    const item = await this.findOwned(this.profesionales, 'profesional', id, empresaId);
    if (!item) throw new NotFoundException('Profesional responsable no encontrado');
    Object.assign(item, dto);
    return this.profesionales.save(item);
  }

  async setFirmaProfesional(id: string, firmaUrl: string, empresaId: string | null) {
    const item = await this.findOwned(this.profesionales, 'profesional', id, empresaId);
    if (!item) throw new NotFoundException('Profesional responsable no encontrado');

    if (item.firmaUrl && item.firmaUrl !== firmaUrl && item.firmaUrl.startsWith('/uploads/')) {
      try {
        const oldPath = `.${item.firmaUrl}`;
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      } catch (err) {
        // Ignorar para no bloquear la actualización
      }
    }

    item.firmaUrl = firmaUrl;
    return this.profesionales.save(item);
  }

  private async ensureReferences(dto: Partial<CreatePrescripcionDto>, empresaId: string | null) {
    if (dto.clienteId && !(await this.findInCompany(this.clientes, 'cliente', dto.clienteId, empresaId, true))) {
      throw new NotFoundException('Paciente no encontrado en la empresa activa');
    }
    const tipoExamen = dto.tipoExamenId
      ? await this.findInCompany(this.tiposExamen, 'tipo', dto.tipoExamenId, empresaId, true)
      : null;
    if (dto.tipoExamenId && !tipoExamen) throw new NotFoundException('Tipo de examen no encontrado');
    const profesional = dto.profesionalId
      ? await this.findInCompany(this.profesionales, 'profesional', dto.profesionalId, empresaId, true)
      : null;
    if (dto.profesionalId && !profesional) throw new NotFoundException('Profesional responsable no encontrado');
    return { tipoExamen, profesional };
  }

  private async nextNumber(empresaId: string | null) {
    const year = new Date().getFullYear();
    const qb = this.repo.createQueryBuilder('p').where('p.numero LIKE :prefix', { prefix: `PV-${year}-%` });
    this.applyCompanyScope(qb, 'p', empresaId);
    const last = await qb.orderBy('p.numero', 'DESC').getOne();
    const sequence = last ? Number(last.numero.split('-').pop()) + 1 : 1;
    return `PV-${year}-${String(sequence).padStart(6, '0')}`;
  }

  private applyCompanyScope(qb: any, alias: string, empresaId: string | null, includeGlobal = false) {
    if (empresaId && includeGlobal) {
      qb.andWhere(`(${alias}.empresaId = :empresaId OR ${alias}.empresaId IS NULL)`, { empresaId });
    } else if (empresaId) {
      qb.andWhere(`${alias}.empresaId = :empresaId`, { empresaId });
    } else {
      qb.andWhere(`${alias}.empresaId IS NULL`);
    }
    return qb;
  }

  private async findInCompany<T extends ObjectLiteral>(
    repository: Repository<T>, alias: string, id: string, empresaId: string | null, includeGlobal: boolean,
  ): Promise<T | null> {
    const qb = repository.createQueryBuilder(alias).where(`${alias}.id = :id`, { id });
    this.applyCompanyScope(qb, alias, empresaId, includeGlobal);
    return qb.getOne();
  }

  private findOwned<T extends ObjectLiteral>(repository: Repository<T>, alias: string, id: string, empresaId: string | null) {
    return this.findInCompany(repository, alias, id, empresaId, false);
  }
}
