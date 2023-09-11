import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    OneToMany,
    PrimaryGeneratedColumn,
} from "typeorm";

import { Message } from "./Message";

@Entity()
@Check("CHK_nameLength", `LENGTH("name") >= 2`)
@Check("CHK_surnameLength", `LENGTH("surname") >= 2`)
@Check("CHK_emailLength", `LENGTH("email") >= 3`)
@Check("CHK_passwordSha256Len", `LENGTH("passwordSha256") = 32`)
@Check("CHK_passwordSaltLen", `LENGTH("passwordSalt") = 8`)
export class User {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @CreateDateColumn()
    registeredAt: Date;

    @CreateDateColumn()
    lastOnlineAt: Date;

    @Column({ length: 32 })
    name: string;

    @Column({ length: 32 })
    surname: string;

    @Column({ length: 320, unique: true })
    email: string;

    @Column({ length: 32 })
    passwordSha256: string;

    @Column({ length: 8 })
    passwordSalt: string;

    @OneToMany(() => Message, (message) => message.author)
    messages: Message[];
}
