import fastifyPlugin from "fastify-plugin";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

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

export const PublicUserSchema = Type.Object(
    {
        id: Type.String({ format: "uuid" }),
        registeredAt: Type.String({ format: "date-time" }),
        lastOnlineAt: Type.String({ format: "date-time" }),
        name: Type.String(),
        surname: Type.String(),
    },
    { $id: "PublicUserSchema" }
);

export const PrivateUserSchema = Type.Object(
    {
        id: Type.String({ format: "uuid" }),
        registeredAt: Type.String({ format: "date-time" }),
        name: Type.String(),
        surname: Type.String(),
        email: Type.String({ format: "email" }),
    },
    { $id: "PrivateUserSchema" }
);

export const ChatSchema = Type.Object(
    {
        id: Type.String({ format: "uuid" }),
        createdAt: Type.String({ format: "date-time" }),
        participants: Type.Array(
            Type.Ref<typeof PublicUserSchema>("PublicUserSchema")
        ),
    },
    { $id: "ChatSchema" }
);

export const MessageSchema = Type.Object(
    {
        id: Type.Integer(),
        createdAt: Type.String({ format: "date-time" }),
        author: Type.Ref<typeof PublicUserSchema>("PublicUserSchema"),
        content: Type.String(),
        acknowledged: Type.Boolean(),
    },
    { $id: "MessageSchema" }
);

const schemasPlugin = fastifyPlugin(async function (app) {
    app = app.withTypeProvider<TypeBoxTypeProvider>();
    app.addSchema(SensibleErrorSchema);
    app.addSchema(PublicUserSchema);
    app.addSchema(PrivateUserSchema);
    app.addSchema(ChatSchema);
    app.addSchema(MessageSchema);
});

export default schemasPlugin;
