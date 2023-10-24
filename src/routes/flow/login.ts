import bcrypt from "bcrypt";
import { FastifyPluginCallback } from "fastify";

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
                    401: Type.Ref(AuthenticateResponseSchema, {
                        description: "Invalid password or email",
                    }),
                },
            } as const,
        },
        async (req, res) => {
            const { email, password } = req.body;

            const userRepo = app.dataSource.getRepository(User);
            const foundUser = await userRepo.findOneBy({
                email,
            });

            if (
                foundUser === null ||
                !(await bcrypt.compare(password, foundUser?.passwordHash))
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
