import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    JoinTable,
    ManyToMany,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Message } from "./Message";
import { User } from "./User";

@Entity()
@Check("CHK_users", `"user1Id" != "user2Id"`)
@Check("CHK_deletedAt", `"deletedAt" <= NOW()`)
export class DirectMessage {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @CreateDateColumn()
    createdAt: Date;

    @Column({ default: null, nullable: true })
    deletedAt: Date;

    @ManyToOne(() => User, { nullable: false })
    user1: User;

    @ManyToOne(() => User, { nullable: false })
    user2: User;

    @OneToMany(() => Message, (message) => message.dm)
    @JoinTable()
    messages: Message[];
}
