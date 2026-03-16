import { SystemRole } from "src/common/constants/roles.constants";
import { Role } from "src/core/roles/entities/role.entity";
import { Column, CreateDateColumn, DeleteDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: 'users' })
export class User {

    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ unique: true })
    email: string;

    @Column({ nullable: true, select: false })
    password: string;

    @Column()
    fullName: string;

    @Column()
    phone: string;

    @Column('bool', { default: true })
    isActive: boolean;

    @ManyToOne(() => Role, { eager: true })
    @JoinColumn({ name: 'role_id' })
    role: Role;

    @Column({ name: 'role_id' })
    roleId: string;

    @Column({ nullable: true, name: 'last_login' })
    lastLogin?: Date; // Ultimo Inicio de Sesion.

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @DeleteDateColumn()
    deleteAt: Date

    // Método para obtener permisos
    getPermissions(): string[] {
        return this.role.permissions || [];
    }

    hasPermission(permission: string): boolean {
        return this.getPermissions().includes(permission);
    }

    hasAnyPermission(permissions: string[]): boolean {
        return permissions.some(permission => this.hasPermission(permission));
    }

    hasAllPermissions(permissions: string[]): boolean {
        return permissions.every(permission => this.hasPermission(permission));
    }

}
