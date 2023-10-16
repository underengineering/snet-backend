import { onRequestAsyncHookHandler, onRequestHookHandler } from "fastify";
import fastifyPlugin from "fastify-plugin";

import { FastifyJwtNamespace } from "@fastify/jwt";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { User } from "../entity/User";

declare module "fastify" {
    interface FastifyInstance
        extends FastifyJwtNamespace<{ namespace: "security" }> {
        authenticate: onRequestAsyncHookHandler;
    }

    interface FastifyRequest {
        userId: string;
        userEntity: User;
    }
}

export type JwtBody = {
    readonly id: string;
};

export const AuthenticateResponseSchema = Type.Object(
    {
        statusCode: Type.Integer(),
        error: Type.String(),
        message: Type.String(),
    },
    {
        $id: "AuthenticateResponseSchema",
        description: "User not found or deleted",
    }
);

const authenticatePlugin = fastifyPlugin(async function (app) {
    app.withTypeProvider<TypeBoxTypeProvider>().addSchema(
        AuthenticateResponseSchema
    );

    app.decorateRequest("userId", null);
    app.decorateRequest("userEntity", null);
    app.decorate("authenticate", async (req, res) => {
        try {
            const body = await req.jwtVerify<JwtBody>();

            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id: body.id });
            if (user === null) return res.unauthorized("User not found");
            if (user.deletedAt !== null)
                return res.unauthorized("This user is deleted");

            req.userId = body.id;
            req.userEntity = user;
        } catch (err) {
            res.send(err);
        }
    });
});

export default authenticatePlugin;
