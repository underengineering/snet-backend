import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    OneToMany,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Message } from "./Message";
import { User } from "./User";

@Entity()
@Check("CHK_deletedAt", `"deletedAt" <= NOW()`)
export class Chat {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ default: null, nullable: true })
    deletedAt: Date;

    @ManyToMany(() => User)
    @JoinTable()
    participants: User[];

    @OneToMany(() => Message, (message) => message.chat)
    @JoinTable()
    messages: Message[];
}
