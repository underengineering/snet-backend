import { FastifyInstance } from "fastify";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { AuthenticateResponseSchema } from "../../plugins/authenticate";

export default function meRoute(app: FastifyInstance) {
    app.withTypeProvider<TypeBoxTypeProvider>().get(
        "/users/me",
        {
            schema: {
                response: {
                    200: Type.Object({
                        id: Type.String({ format: "uuid" }),
                        registeredAt: Type.String({ format: "date-time" }),
                        name: Type.String(),
                        surname: Type.String(),
                        email: Type.String(),
                    }),
                    403: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: app.authenticate,
        },
        async (req, res) => {
            const user = req.userEntity;
            return {
                id: user.id,
                registeredAt: user.registeredAt,
                name: user.name,
                surname: user.name,
                email: user.email,
            };
        }
    );
}
