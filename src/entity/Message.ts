import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { DirectMessage } from "./DirectMessage";
import { User } from "./User";

@Entity()
@Check("CHK_createdAt", `"createdAt" <= NOW()`)
export class Message {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ default: null, nullable: true })
    deletedAt: Date;

    @ManyToOne(() => User, (user) => user.messages, { nullable: false })
    author: User;

    @ManyToOne(() => DirectMessage, (dm) => dm.messages, { nullable: false })
    dm: DirectMessage;

    @Column({ length: 2000, nullable: true, default: null })
    content: string;

    @Column({ default: false })
    acknowledged: boolean;

    @Column({ default: false })
    deleted: boolean;
}
