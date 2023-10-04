import {
    Check,
    Column,
    CreateDateColumn,
    Entity,
    ManyToOne,
    OneToMany,
    PrimaryGeneratedColumn,
    Relation,
} from "typeorm";

import { Message } from "./Message";

@Entity()
@Check("CHK_sentAt", `"sentAt" <= NOW()`)
@Check("CHK_acceptedAtGreaterThanSentAt", `"acceptedAt" >= "sentAt"`)
export class FriendRequest {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @ManyToOne(() => User, (user) => user.sentFriendRequests, {
        nullable: false,
    })
    sender: Relation<User>;

    @ManyToOne(() => User, (user) => user.receivedFriendRequests, {
        nullable: false,
    })
    receiver: Relation<User>;

    @CreateDateColumn()
    sentAt: Date;

    @Column({ default: null, nullable: true })
    acceptedAt: Date;

    @Column({ default: false })
    isAccepted: boolean;

    @Column({ default: null, nullable: true })
    removedAt: Date;

    @Column({ default: false })
    isRemoved: boolean;
}

@Entity()
@Check("CHK_registeredAt", `"registeredAt" <= NOW()`)
@Check(
    "CHK_lastOnlineAt",
    `"lastOnlineAt" <= NOW() AND "lastOnlineAt" <= "registeredAt"`
)
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

    @OneToMany(() => FriendRequest, (frientRequest) => frientRequest.sender)
    sentFriendRequests: FriendRequest[];

    @OneToMany(() => FriendRequest, (frientRequest) => frientRequest.receiver)
    receivedFriendRequests: FriendRequest[];

    @CreateDateColumn({ default: null, nullable: true })
    deletedAt: Date;

    @Column({ default: false })
    isDeleted: boolean;
}
