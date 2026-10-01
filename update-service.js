const fs = require('fs');
const path = 'C:\\laragon\\www\\Course_Angular_2025\\Contable\\nest_contable\\nest-contable-backend\\src\\nomina\\nomina.service.ts';
let c = fs.readFileSync(path, 'utf8');

const newMethod = 
  async findAllObligaciones(query: any) {
    const qb = this.dataSource.getRepository(ObligacionNomina).createQueryBuilder('o')
      .leftJoinAndSelect('o.periodo', 'periodo')
      .leftJoinAndSelect('o.empleado', 'empleado')
      .orderBy('periodo.fechaFin', 'DESC');

    if (query.estado) {
        qb.andWhere('o.estado = :estado', { estado: query.estado });
    }
    if (query.periodoId) {
        qb.andWhere('o.periodoId = :periodoId', { periodoId: query.periodoId });
    }

    const obligaciones = await qb.getMany();
    return obligaciones;
  }

  async pagarObligaciones;

c = c.replace("async pagarObligaciones", newMethod);
fs.writeFileSync(path, c, 'utf8');
