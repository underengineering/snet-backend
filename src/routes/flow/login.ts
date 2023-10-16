import { FastifyPluginCallback } from "fastify";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { CookieSerializeOptions } from "@fastify/cookie";
import { Type } from "@sinclair/typebox";

import { User } from "../../entity/User";
import {
    AuthenticateResponseSchema,
    JwtBody,
} from "../../plugins/authenticate";
import { FastifyInstanceTypeBox } from "../../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
    done
) => {
    const COOKIE_OPTIONS: CookieSerializeOptions = app.config.JWT_SECURE
        ? {
              httpOnly: true,
              path: "/",
              sameSite: true,
              secure: true,
          }
        : { path: "/" };

    app.post(
        "/login",
        {
            schema: {
                description: "Log in",
                tags: ["flow"],
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
                    200: Type.Object({}, { description: "Login success" }),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema",
                        { description: "Invalid password or email" }
                    ),
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
                    : Buffer.from(foundUser.passwordSalt, "hex");
            const passwordSha256 =
                foundUser === null
                    ? Buffer.alloc(32)
                    : Buffer.from(foundUser.passwordSha256, "hex");

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

    done();
};

export default route;
