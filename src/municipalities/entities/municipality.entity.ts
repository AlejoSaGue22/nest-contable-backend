import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: 'municipios' })
export class Municipality {

    @PrimaryColumn()
    id: number;

    @Column({ unique: true })
    code: string;

    @Column()
    name: string;

    @Column()
    department: string;
}
