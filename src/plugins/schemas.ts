import fastifyPlugin from "fastify-plugin";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { File } from "../entity/File";
import { Message } from "../entity/Message";
import { FriendRequest, User } from "../entity/User";
import { FastifyInstanceTypeBox } from "../utils";

export const SensibleErrorSchema = Type.Object(
    {
        statusCode: Type.Integer(),
        error: Type.String(),
        message: Type.String(),
    },
    {
        $id: "SensibleErrorSchema",
    }
);

export const PublicUserSchema = Type.Transform(
    Type.Object(
        {
            id: Type.String({ format: "uuid" }),
            registeredAt: Type.String({ format: "date-time" }),
            lastOnlineAt: Type.String({ format: "date-time" }),
            name: Type.String(),
            surname: Type.String(),
            avatar: Type.Optional(Type.String({ pattern: "[a-f0-9]{64}" })),
        },
        { $id: "PublicUserSchema" }
    )
)
    .Decode((user) => {
        const entity = new User();
        entity.id = user.id;
        entity.registeredAt = new Date(user.registeredAt);
        entity.lastOnlineAt = new Date(user.lastOnlineAt);
        entity.name = user.name;
        entity.surname = user.surname;
        if (user.avatar !== undefined)
            entity.avatar = { hashSha256: user.avatar } as File;

        return entity;
    })
    .Encode((user) => {
        return {
            ...user,
            registeredAt: user.registeredAt.toISOString(),
            lastOnlineAt: user.lastOnlineAt.toISOString(),
            avatar: user.avatar?.hashSha256,
        };
    });

export const PrivateUserSchema = Type.Transform(
    Type.Object(
        {
            id: Type.String({ format: "uuid" }),
            registeredAt: Type.String({ format: "date-time" }),
            name: Type.String(),
            surname: Type.String(),
            email: Type.String({ format: "email" }),
            avatar: Type.Optional(Type.String({ pattern: "[a-f0-9]{64}" })),
        },
        { $id: "PrivateUserSchema" }
    )
)
    .Decode((user) => {
        const entity = new User();
        entity.id = user.id;
        entity.registeredAt = new Date(user.registeredAt);
        entity.name = user.name;
        entity.surname = user.surname;
        entity.email = user.email;
        if (user.avatar !== undefined)
            entity.avatar = { hashSha256: user.avatar } as File;

        return entity;
    })
    .Encode((user) => ({
        ...user,
        registeredAt: user.registeredAt.toISOString(),
        avatar: user.avatar?.hashSha256,
    }));

export const SentFriendRequestSchema = Type.Transform(
    Type.Object(
        {
            id: Type.String({ format: "uuid" }),
            receiver: Type.Ref(PublicUserSchema),
            sentAt: Type.String({ format: "date-time" }),
        },
        { $id: "SentFriendRequestSchema" }
    )
)
    .Decode((friendRequest) => {
        const entity = new FriendRequest();
        entity.id = friendRequest.id;
        entity.receiver = friendRequest.receiver;
        entity.sentAt = new Date(friendRequest.sentAt);

        return entity;
    })
    .Encode((friendRequest) => {
        return {
            ...friendRequest,
            receiver: Value.Encode(PublicUserSchema, friendRequest.receiver),
            sentAt: friendRequest.sentAt.toISOString(),
        };
    });

export const ReceivedFriendRequestSchema = Type.Transform(
    Type.Object(
        {
            id: Type.String({ format: "uuid" }),
            sender: Type.Ref(PublicUserSchema),
            sentAt: Type.String({ format: "date-time" }),
        },
        { $id: "ReceivedFriendRequestSchema" }
    )
)
    .Decode((friendRequest) => {
        const entity = new FriendRequest();
        entity.id = friendRequest.id;
        entity.sender = friendRequest.sender;
        entity.sentAt = new Date(friendRequest.sentAt);

        return entity;
    })
    .Encode((friendRequest) => ({
        ...friendRequest,
        sender: Value.Encode(PublicUserSchema, friendRequest.sender),
        sentAt: friendRequest.sentAt.toISOString(),
    }));

export const DMSchema = Type.Object(
    {
        id: Type.String({ format: "uuid" }),
        createdAt: Type.String({ format: "date-time" }),
        participant: Type.Ref(PublicUserSchema),
    },
    { $id: "DMSchema" }
);

export const MessageSchema = Type.Transform(
    Type.Object(
        {
            id: Type.Integer(),
            createdAt: Type.String({ format: "date-time" }),
            author: Type.Ref(PublicUserSchema),
            content: Type.String(),
            acknowledged: Type.Boolean(),
        },
        { $id: "MessageSchema" }
    )
)
    .Decode((message) => {
        const entity = new Message();
        entity.id = message.id;
        entity.createdAt = new Date(message.createdAt);
        entity.author = message.author;
        entity.content = message.content;
        entity.acknowledged = message.acknowledged;

        return entity;
    })
    .Encode((message) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
        author: Value.Encode(PublicUserSchema, message.author),
    }));

const schemasPlugin = fastifyPlugin(async function (
    app: FastifyInstanceTypeBox
) {
    app.addSchema(SensibleErrorSchema);
    app.addSchema(PublicUserSchema);
    app.addSchema(PrivateUserSchema);
    app.addSchema(SentFriendRequestSchema);
    app.addSchema(ReceivedFriendRequestSchema);
    app.addSchema(DMSchema);
    app.addSchema(MessageSchema);
});

export default schemasPlugin;
