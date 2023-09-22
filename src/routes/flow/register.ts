import { FastifyPluginCallback } from "fastify";
import { createHash, randomBytes } from "node:crypto";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { User } from "../../entity/User";

const route: FastifyPluginCallback = (app, _opts, done) => {
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
                    200: Type.Object(
                        {},
                        { description: "Acoount registered successfuly" }
                    ),
                    409: Type.Object(
                        {
                            statusCode: Type.Integer(),
                            error: Type.String(),
                            message: Type.String(),
                        },
                        { description: "Tried to register already used email" }
                    ),
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
                .digest("hex");

            const newUser = userRepo.create({
                name,
                surname,
                email,
                passwordSha256,
                passwordSalt: passwordSalt.toString("hex"),
            });

            await userRepo.save(newUser);

            return {};
        }
    );

    done();
};

export default route;
