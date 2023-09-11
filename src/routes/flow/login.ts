import { FastifyInstance } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";

import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";

import { User } from "../../entity/User";

export default async function addRoutes(app: FastifyInstance) {
    app.withTypeProvider<JsonSchemaToTsProvider>().post(
        "/login",
        {
            schema: {
                body: {
                    type: "object",
                    properties: {
                        email: { type: "string", minLength: 3, maxLength: 320 },
                        password: {
                            type: "string",
                            minLength: 4,
                            maxLength: 128,
                        },
                    },
                    required: ["email", "password"],
                },
                response: {
                    200: {
                        description: "Login success",
                        type: "object",
                        properties: {},
                    },
                    403: {
                        description: "Invalid password or email",
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
            const { email, password } = req.body;

            const userRepo = app.dataSource.getRepository(User);
            const foundUser = await userRepo.findOneBy({
                email,
            });

            if (foundUser === null)
                return res.forbidden("Invalid password or email");

            const passwordSalt = Buffer.from(foundUser.passwordSalt, "binary");
            const passwordSha256 = Buffer.from(
                foundUser.passwordSha256,
                "binary"
            );

            const providedPasswordSha256 = createHash("sha256")
                .update(password)
                .update(passwordSalt)
                .digest();
            if (!timingSafeEqual(providedPasswordSha256, passwordSha256))
                return res.forbidden("Invalid password or email");

            const token = await res.jwtSign(
                { id: foundUser.id },
                { sign: { expiresIn: app.config.JWT_EXPIRY_TIME } }
            );
            res.setCookie("token", token, {
                path: "/",
            });

            return {};
        }
    );
}
