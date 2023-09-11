import {
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Chat } from "./Chat";
import { User } from "./User";

@Entity()
export class Message {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User, (user) => user.messages)
    author: User;

    @ManyToOne(() => Chat, (chat) => chat.messages)
    chat: Chat;

    @Column({ length: 2000 })
    content: string;

    @Column({ default: false })
    acknowledged: boolean;

    @Column({ default: false })
    deleted: boolean;
}
