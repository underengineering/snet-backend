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
@Check("CHK_registeredAt", `"registeredAt" <= NOW()`)
@Check("CHK_lastOnlineAt", `"lastOnlineAt" <= NOW()`)
@Check("CHK_nameLength", `LENGTH("name") >= 2`)
@Check("CHK_surnameLength", `LENGTH("surname") >= 2`)
@Check("CHK_emailLength", `LENGTH("email") >= 3`)
@Check("CHK_passwordSha256Len", `LENGTH("passwordSha256") = 64`)
@Check("CHK_passwordSaltLen", `LENGTH("passwordSalt") = 16`)
@Check("CHK_deletedAt", `"deletedAt" <= NOW()`)
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

    @Column({ length: 64 })
    passwordSha256: string;

    @Column({ length: 16 })
    passwordSalt: string;

    @OneToMany(() => Message, (message) => message.author)
    messages: Message[];

    @CreateDateColumn({ default: null, nullable: true })
    deletedAt: Date;

    @Column({ default: false })
    isDeleted: boolean;
}
