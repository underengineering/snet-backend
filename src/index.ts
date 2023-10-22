import fastify, { FastifyInstance } from "fastify";

import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyEnv from "@fastify/env";
import fastifyJwt from "@fastify/jwt";
import { ajvFilePlugin, fastifyMultipart } from "@fastify/multipart";
import fastifySensible from "@fastify/sensible";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

import { DirectMessage } from "./entity/DirectMessage";
import { File } from "./entity/File";
import { Message } from "./entity/Message";
import { FriendRequest, User } from "./entity/User";
import envSchema from "./env-schema";
import authenticatePlugin from "./plugins/authenticate";
import schemasPlugin from "./plugins/schemas";
import typeOrmPlugin from "./plugins/typeorm";
import * as routes from "./routes";

async function main() {
    const app: FastifyInstance = fastify({
        logger: true,
        ajv: {
            plugins: [ajvFilePlugin],
        },
    });

    // Register plugins
    await app.register(fastifySwagger, {
        swagger: {
            consumes: ["application/json"],
            produces: ["application/json"],
        },
    });

    app.register(fastifySwaggerUi, {
        routePrefix: "/docs",
    });

    app.register(fastifyMultipart, {
        // attachFieldsToBody: true,
        limits: { files: 1 },
    });

    app.register(fastifyCors, {
        origin: true,
    });

    await app.register(fastifyEnv, {
        confKey: "config",
        schema: envSchema,
        dotenv: true,
    });

    app.register(fastifyJwt, {
        secret: app.config.JWT_SECRET,
        cookie: {
            cookieName: "token",
            signed: false,
        },
    });
    app.register(fastifyCookie);
    app.register(fastifySensible);
    app.register(authenticatePlugin);
    app.register(schemasPlugin);
    await app.register(typeOrmPlugin, {
        host: app.config.DB_HOST,
        port: app.config.DB_PORT,
        username: app.config.DB_USERNAME,
        password: app.config.DB_PASSWORD,
        database: app.config.DB_DATABASE,
        entities: [User, Message, DirectMessage, FriendRequest, File],
    });

    // Register routes
    app.register(routes.dms, { prefix: "/dms" });
    app.register(routes.login, { prefix: "/flow" });
    app.register(routes.register, { prefix: "/flow" });
    app.register(routes.users, { prefix: "/users" });
    app.register(routes.files, { prefix: "/files" });

    // Start the app
    try {
        await app.listen({ port: app.config.PORT });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
