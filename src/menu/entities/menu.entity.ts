// menu/entities/menu-item.entity.ts
import { Permission } from 'src/common/constants/roles.constants';
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, Tree, TreeParent, TreeChildren } from 'typeorm';

@Entity('menu_items')
@Tree('closure-table')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  icon: string;

  @Column({ nullable: true })
  route?: string;

  @Column({ nullable: true })
  externalUrl?: string;

  @Column({ type: 'enum', enum: Permission, nullable: true })
  requiredPermission?: Permission;

  @Column({ default: 0 })
  order: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVisible: boolean;

  @TreeParent()
  parent?: MenuItem;

  @TreeChildren()
  children: MenuItem[];

  @Column({ nullable: true })
  parentId?: string;

  @Column({ type: 'json', nullable: true })
  metadata?: any; // Para badges, colores, etc.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Método para verificar si es accesible
  isAccessible(userPermissions: Permission[]): boolean {
    if (!this.isActive || !this.isVisible) return false;
    if (!this.requiredPermission) return true;
    return userPermissions.includes(this.requiredPermission);
  }

  // Método para obtener el árbol completo
  getTree(): MenuItem[] {
    const tree: MenuItem[] = [];
    if (this.children) {
      tree.push(...this.children);
    }
    return tree;
  }
}
