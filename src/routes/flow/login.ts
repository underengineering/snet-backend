import { FastifyInstance } from "fastify";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { CookieSerializeOptions } from "@fastify/cookie";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { User } from "../../entity/User";
import { JwtBody } from "../../plugins/authenticate";

export default async function addRoutes(app: FastifyInstance) {
    const COOKIE_OPTIONS: CookieSerializeOptions = app.config.JWT_SECURE
        ? {
              httpOnly: true,
              path: "/",
              sameSite: true,
              secure: true,
          }
        : { path: "/" };

    app.withTypeProvider<TypeBoxTypeProvider>().post(
        "/login",
        {
            schema: {
                body: Type.Object({
                    email: Type.String({
                        format: "email",
                        minLength: 3,
                        maxLength: 320,
                    }),
                    password: Type.String({
                        minLength: 4,
                        maxLength: 128,
                    }),
                }),
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
                    ? randomBytes(8)
                    : Buffer.from(foundUser.passwordSalt, "binary");
            const passwordSha256 =
                foundUser === null
                    ? Buffer.alloc(32)
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

            const token = await res.jwtSign({ id: foundUser.id } as JwtBody, {
                sign: { expiresIn: app.config.JWT_EXPIRY_TIME },
            });

            res.setCookie("token", token, COOKIE_OPTIONS);

            return {};
        }
    );
}
