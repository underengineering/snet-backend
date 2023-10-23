import { FastifyPluginCallback } from "fastify";

import { createHash, randomBytes } from "node:crypto";

import { Type } from "@sinclair/typebox";

import { User } from "../../entity/User";
import { SensibleErrorSchema } from "../../plugins/schemas";
import { FastifyInstanceTypeBox } from "../../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
    done
) => {
    app.post(
        "/register",
        {
            schema: {
                description: "Register",
                tags: ["flow"],
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
                    409: Type.Ref(SensibleErrorSchema, {
                        description: "Tried to register already used email",
                    }),
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
