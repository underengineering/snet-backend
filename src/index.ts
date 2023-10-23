import fastify, { FastifyInstance } from "fastify";

import fastifyCookie from "@fastify/cookie";
import fastifyCors from "@fastify/cors";
import fastifyEnv from "@fastify/env";
import fastifyJwt from "@fastify/jwt";
import { ajvFilePlugin, fastifyMultipart } from "@fastify/multipart";
import fastifySensible from "@fastify/sensible";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { FormatRegistry } from "@sinclair/typebox";

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

    // https://github.com/sinclairzx81/typebox/issues/475
    FormatRegistry.Set("uuid", (value) =>
        /^(?:urn:uuid:)?[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(
            value
        )
    );
    FormatRegistry.Set("date-time", (value) => {
        const DAYS = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        const DATE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;

        function IsLeapYear(year: number): boolean {
            return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        }

        function IsDate(value: string): boolean {
            const matches: string[] | null = DATE.exec(value);
            if (!matches) return false;
            const year: number = +matches[1];
            const month: number = +matches[2];
            const day: number = +matches[3];
            return (
                month >= 1 &&
                month <= 12 &&
                day >= 1 &&
                day <= (month === 2 && IsLeapYear(year) ? 29 : DAYS[month])
            );
        }

        const TIME =
            /^(\d\d):(\d\d):(\d\d(?:\.\d+)?)(z|([+-])(\d\d)(?::?(\d\d))?)?$/i;
        function IsTime(value: string, strictTimeZone?: boolean): boolean {
            const matches: string[] | null = TIME.exec(value);
            if (!matches) return false;
            const hr: number = +matches[1];
            const min: number = +matches[2];
            const sec: number = +matches[3];
            const tz: string | undefined = matches[4];
            const tzSign: number = matches[5] === "-" ? -1 : 1;
            const tzH: number = +(matches[6] || 0);
            const tzM: number = +(matches[7] || 0);
            if (tzH > 23 || tzM > 59 || (strictTimeZone && !tz)) return false;
            if (hr <= 23 && min <= 59 && sec < 60) return true;
            const utcMin = min - tzM * tzSign;
            const utcHr = hr - tzH * tzSign - (utcMin < 0 ? 1 : 0);
            return (
                (utcHr === 23 || utcHr === -1) &&
                (utcMin === 59 || utcMin === -1) &&
                sec < 61
            );
        }

        const DATE_TIME_SEPARATOR = /t|\s/i;
        function IsDateTime(value: string, strictTimeZone?: boolean): boolean {
            const dateTime: string[] = value.split(DATE_TIME_SEPARATOR);
            return (
                dateTime.length === 2 &&
                IsDate(dateTime[0]) &&
                IsTime(dateTime[1], strictTimeZone)
            );
        }

        return IsDateTime(value);
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
