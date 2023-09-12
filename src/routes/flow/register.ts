import { FastifyInstance } from "fastify";
import { createHash, randomBytes } from "node:crypto";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { User } from "../../entity/User";

export default async function addRoutes(app: FastifyInstance) {
    app.withTypeProvider<TypeBoxTypeProvider>().post(
        "/register",
        {
            schema: {
                body: Type.Object({
                    name: Type.String({
                        minLength: 2,
                        maxLength: 32,
                    }),
                    surname: Type.String({
                        minLength: 2,
                        maxLength: 32,
                    }),
                    email: Type.String({
                        format: "email",
                        minLength: 3,
                        maxLength: 320,
                    }),
                    password: Type.String({
                        type: "string",
                        minLength: 4,
                        maxLength: 128,
                    }),
                }),
                response: {
                    200: {
                        description: "Account registered successfuly",
                        type: "object",
                        properties: {},
                    },
                    409: {
                        description: "Tried to register already used email",
                        type: "object",
                        properties: {
                            statusCode: { type: "number" },
                            error: { type: "string" },
                            message: { type: "string" },
                        },
                    },
                },
            } as const,
        },
        async (req, res) => {
            const { name, surname, email, password } = req.body;

            const userRepo = app.dataSource.getRepository(User);
            const foundUser = await userRepo.findOneBy({
                email,
            });

            if (foundUser !== null)
                return res.conflict("This email is already occupied");

            const passwordSalt = randomBytes(8);
            const passwordSha256 = createHash("sha256")
                .update(password)
                .update(passwordSalt)
                .digest("binary");

            const newUser = userRepo.create({
                name,
                surname,
                email,
                passwordSha256,
                passwordSalt: passwordSalt.toString("binary"),
            });

            await userRepo.save(newUser);

            return {};
        }
    );
}
