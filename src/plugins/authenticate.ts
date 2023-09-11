import { FastifyPluginAsync, onRequestHookHandler } from "fastify";

import fastifyJwt, { FastifyJwtNamespace } from "@fastify/jwt";

declare module "fastify" {
    interface FastifyInstance
        extends FastifyJwtNamespace<{ namespace: "security" }> {
        authenticate: onRequestHookHandler;
    }
}

const authenticatePlugin: FastifyPluginAsync = async function (app) {
    app.decorate("authenticate", (req, res) => {
        try {
            req.jwtVerify();
        } catch (err) {
            res.send(err);
        }
    });
};

export default authenticatePlugin;
