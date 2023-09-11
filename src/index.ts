import fastify, { FastifyInstance } from "fastify";

import fastifyCookie from "@fastify/cookie";
import fastifyEnv from "@fastify/env";
import fastifyJwt from "@fastify/jwt";
import fastifySensible from "@fastify/sensible";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

import { Chat } from "./entity/Chat";
import { Message } from "./entity/Message";
import { User } from "./entity/User";
import envSchema from "./env-schema";
import authenticatePlugin from "./plugins/authenticate";
import typeOrmPlugin from "./plugins/typeorm";
import addRoutes from "./routes";

async function main() {
    const app: FastifyInstance = fastify({
        logger: true,
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
    await app.register(typeOrmPlugin, {
        host: app.config.DB_HOST,
        port: app.config.DB_PORT,
        username: app.config.DB_USERNAME,
        password: app.config.DB_PASSWORD,
        database: app.config.DB_DATABASE,
        entities: [User, Message, Chat],
    });

    // Register routes
    addRoutes(app);

    // Start the app
    try {
        await app.listen({ port: app.config.PORT });
    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

main();
