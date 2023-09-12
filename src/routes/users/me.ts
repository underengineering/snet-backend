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
                    ...AuthenticateResponseSchema,
                    200: Type.Object({
                        registeredAt: Type.String({ format: "date-time" }),
                        name: Type.String(),
                        surname: Type.String(),
                        email: Type.String(),
                    }),
                },
            },
            onRequest: app.authenticate,
        },
        async (req, res) => {
            return {
                registeredAt: req.userEntity.registeredAt,
                name: req.userEntity.name,
                surname: req.userEntity.name,
                email: req.userEntity.email,
            };
        }
    );
}
