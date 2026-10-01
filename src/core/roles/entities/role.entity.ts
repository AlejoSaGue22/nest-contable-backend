import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToMany, JoinTable } from 'typeorm';
import { User } from '../../../users/entities/user.entity';
import { Permission } from './permission.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column()
  description: string;

  @ManyToMany(() => Permission, permission => permission.roles)
  @JoinTable({
    name: 'roles_permissions',
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' }
  })
  permissions: Permission[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isSystem: boolean; // Roles del sistema no se pueden eliminar

  @OneToMany(() => User, user => user.role)
  users: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Métodos de ayuda
  hasPermission(permissionName: string): boolean {
    if (!this.permissions) return false;
    return this.permissions.some(p => p.name === permissionName);
  }

  addPermission(permission: Permission): void {
    if (!this.permissions) this.permissions = [];
    if (!this.hasPermission(permission.name)) {
      this.permissions.push(permission);
    }
  }

  removePermission(permissionName: string): void {
    if (!this.permissions) return;
    this.permissions = this.permissions.filter(p => p.name !== permissionName);
  }
}