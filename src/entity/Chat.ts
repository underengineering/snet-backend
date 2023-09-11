import {
    Entity,
    JoinTable,
    ManyToMany,
    OneToMany,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Message } from "./Message";
import { User } from "./User";

@Entity()
export class Chat {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToMany(() => User)
    @JoinTable()
    participants: User[];

    @OneToMany(() => Message, (message) => message.chat)
    @JoinTable()
    messages: Message[];
}
