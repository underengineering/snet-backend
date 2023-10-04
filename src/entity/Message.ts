import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Chat } from "./Chat";
import { User } from "./User";

@Entity()
@Check("CHK_createdAt", `"createdAt" <= NOW()`)
export class Message {
    @PrimaryGeneratedColumn()
    id: number;

    @CreateDateColumn()
    createdAt: Date;

    @ManyToOne(() => User, (user) => user.messages, { nullable: false })
    author: User;

    @ManyToOne(() => Chat, (chat) => chat.messages, { nullable: false })
    chat: Chat;

    @Column({ length: 2000, nullable: true, default: null })
    content: string;

    @Column({ default: false })
    acknowledged: boolean;

    @Column({ default: false })
    deleted: boolean;
}
