import { FastifyInstance } from "fastify";
import { createHash, timingSafeEqual } from "node:crypto";

import { CookieSerializeOptions } from "@fastify/cookie";
import { JsonSchemaToTsProvider } from "@fastify/type-provider-json-schema-to-ts";

import { User } from "../../entity/User";

export default async function addRoutes(app: FastifyInstance) {
    const COOKIE_OPTIONS: CookieSerializeOptions = app.config.JWT_SECURE
        ? {
              httpOnly: true,
              path: "/",
              sameSite: true,
              secure: true,
          }
        : { path: "/" };

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

            // Hash against zeros if user is not found to prevent timing attacks
            const passwordSalt =
                foundUser === null
                    ? Buffer.alloc(32)
                    : Buffer.from(foundUser.passwordSalt, "binary");
            const passwordSha256 =
                foundUser === null
                    ? Buffer.alloc(8)
                    : Buffer.from(foundUser.passwordSha256, "binary");

            const providedPasswordSha256 = createHash("sha256")
                .update(password)
                .update(passwordSalt)
                .digest();
            if (
                !timingSafeEqual(providedPasswordSha256, passwordSha256) ||
                foundUser === null
            )
                return res.forbidden("Invalid password or email");

            const token = await res.jwtSign(
                { id: foundUser.id },
                { sign: { expiresIn: app.config.JWT_EXPIRY_TIME } }
            );
            res.setCookie("token", token, COOKIE_OPTIONS);

            return {};
        }
    );
}
