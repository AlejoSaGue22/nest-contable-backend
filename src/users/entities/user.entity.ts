import { UserRole } from "src/common/constants/roles.constants";
import { Column, DeleteDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

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

    @Column('bool', { default: true })
    isActive: boolean;

    @Column({ type: 'enum', enum: UserRole, default: 'viewer' })
    role: UserRole;

    @DeleteDateColumn()
    deleteAt: Date

}
