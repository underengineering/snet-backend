import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
    Relation,
} from "typeorm";

import { User } from "./User";

@Entity()
@Check("chk_size", `"size" >= 1`)
@Check(
    "chk_widthHeight",
    `("width" IS NULL AND "height" IS NULL) OR ("width" IS NOT NULL AND "height" IS NOT NULL)`
)
export class File {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => User, { nullable: false })
    uploader: Relation<User>;

    @CreateDateColumn()
    uploadedAt: Date;

    @Column({ default: null, nullable: true })
    deletedAt: Date;

    @Column({ length: 64, unique: true })
    hashSha256: string;

    // Derived from hashSha256
    @Column({ type: "int8" })
    partition: number;

    @Column({ length: 255 })
    fileName: string;

    @Column({ length: 255 })
    mimeType: string;

    // Metadata
    @Column()
    size: number;

    @Column({ nullable: true })
    width: number;

    @Column({ nullable: true })
    height: number;
}
