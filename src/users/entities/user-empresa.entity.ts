import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';
import { Empresa } from 'src/settings/empresa/entities/empresa.entity';

/**
 * Pivote usuario <-> empresa (Fase 1, aditivo pre-deploy).
 * Hoy el sistema usa users.empresaId (1:1); esta tabla permite N:M futuro
 * sin migrar datos ahora. Con synchronize:true se crea vacía, sin impacto.
 */
@Entity({ name: 'user_empresas' })
@Unique(['userId', 'empresaId'])
export class UserEmpresa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => Empresa, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'empresaId' })
  empresa: Empresa;

  @Column()
  empresaId: string;

  @Column({ default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
