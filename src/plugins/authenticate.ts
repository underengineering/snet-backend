import { onRequestHookHandler } from "fastify";
import fastifyPlugin from "fastify-plugin";

import { FastifyJwtNamespace } from "@fastify/jwt";

import { User } from "../entity/User";

declare module "fastify" {
    interface FastifyInstance
        extends FastifyJwtNamespace<{ namespace: "security" }> {
        authenticate: onRequestHookHandler;
    }

    interface FastifyRequest {
        userId: string;
        userEntity: User;
    }
}

export type JwtBody = {
    readonly id: string;
};

export const AuthenticateResponseSchema = {
    403: {
        description: "User not found or deleted",
        type: "object",
        properties: {
            statusCode: { type: "number" },
            error: { type: "string" },
            message: { type: "string" },
        },
    },
};

const authenticatePlugin = fastifyPlugin(async function (app) {
    app.decorateRequest("userId", null);
    app.decorateRequest("userEntity", null);
    app.decorate("authenticate", async (req, res) => {
        try {
            const body = await req.jwtVerify<JwtBody>();

            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id: body.id });
            if (user === null) return res.unauthorized("User not found");
            if (user.isDeleted) return res.unauthorized("User deleted");

            req.userId = body.id;
            req.userEntity = user;
        } catch (err) {
            res.send(err);
        }
    });
});

export default authenticatePlugin;
