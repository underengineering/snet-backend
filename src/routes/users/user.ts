import { FastifyInstance } from "fastify";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { User } from "../../entity/User";
import { AuthenticateResponseSchema } from "../../plugins/authenticate";

export default function userRoute(app: FastifyInstance) {
    app.withTypeProvider<TypeBoxTypeProvider>().get(
        "/users",
        {
            schema: {
                querystring: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({
                        id: Type.String({ format: "uuid" }),
                        registeredAt: Type.String({ format: "date-time" }),
                        lastOnlineAt: Type.String({ format: "date-time" }),
                        name: Type.String(),
                        surname: Type.String(),
                    }),
                    403: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { id } = req.query;

            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id });
            if (user === null) return res.notFound("User not found");

            return {
                id: user.id,
                registeredAt: user.registeredAt.toISOString(),
                lastOnlineAt: user.lastOnlineAt.toISOString(),
                name: user.name,
                surname: user.surname,
            };
        }
    );
}
