import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Cliente } from 'src/clientes/entities/cliente.entity';
import { User } from 'src/users/entities/user.entity';
import { CreatePrescripcionDto } from './dto/create-prescripcion.dto';
import { PrescripcionFilterDto } from './dto/prescripcion-filter.dto';
import { UpdatePrescripcionDto } from './dto/update-prescripcion.dto';
import { Prescripcion, PrescripcionEstado } from './entities/prescripcion.entity';

@Injectable()
export class PrescripcionesService {
  constructor(
    @InjectRepository(Prescripcion) private readonly repo: Repository<Prescripcion>,
    @InjectRepository(Cliente) private readonly clientes: Repository<Cliente>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async findAll(filter: PrescripcionFilterDto) {
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 10));
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.cliente', 'cliente')
      .leftJoinAndSelect('p.profesional', 'profesional')
      .orderBy('p.fechaExamen', 'DESC').addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit).take(limit);
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
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id }, relations: ['cliente', 'profesional', 'creadoPor'] });
    if (!item) throw new NotFoundException('Prescripción no encontrada');
    return item;
  }

  async create(dto: CreatePrescripcionDto, userId: string) {
    await this.ensureReferences(dto);
    const numero = await this.nextNumber();
    return this.repo.save(this.repo.create({ ...dto, numero, creadoPorId: userId }));
  }

  async update(id: string, dto: UpdatePrescripcionDto) {
    const current = await this.findOne(id);
    if (current.estado === PrescripcionEstado.ANULADA) throw new BadRequestException('No se puede editar una prescripción anulada');
    await this.ensureReferences(dto);
    Object.assign(current, dto);
    return this.repo.save(current);
  }

  async cancel(id: string) {
    const current = await this.findOne(id);
    current.estado = PrescripcionEstado.ANULADA;
    return this.repo.save(current);
  }

  async history(clienteId: string) {
    return this.repo.find({ where: { clienteId }, relations: ['profesional'], order: { fechaExamen: 'DESC' } });
  }

  private async ensureReferences(dto: Partial<CreatePrescripcionDto>) {
    if (dto.clienteId && !(await this.clientes.exist({ where: { id: dto.clienteId } }))) throw new NotFoundException('Paciente no encontrado');
    if (dto.profesionalId && !(await this.users.exist({ where: { id: dto.profesionalId } }))) throw new NotFoundException('Profesional no encontrado');
  }

  private async nextNumber() {
    const year = new Date().getFullYear();
    const last = await this.repo.createQueryBuilder('p').where('p.numero LIKE :prefix', { prefix: `PV-${year}-%` }).orderBy('p.numero', 'DESC').getOne();
    const sequence = last ? Number(last.numero.split('-').pop()) + 1 : 1;
    return `PV-${year}-${String(sequence).padStart(6, '0')}`;
  }
}
