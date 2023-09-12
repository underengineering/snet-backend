import { EnvSchemaOpt, JSONSchemaType } from "env-schema";

type Env = {
    PORT: number;
    HOSTNAME: string;
    JWT_SECRET: string;
    JWT_EXPIRY_TIME: string;
    JWT_SECURE: boolean;
    DB_HOST: string;
    DB_PORT: number;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    DB_DATABASE: string;
};

declare module "fastify" {
    interface FastifyInstance {
        config: Env;
    }
}

export default {
    type: "object",
    required: [
        "PORT",
        "HOSTNAME",
        "JWT_SECRET",
        "JWT_EXPIRY_TIME",
        "JWT_SECURE",
        "DB_HOST",
        "DB_PORT",
        "DB_USERNAME",
        "DB_PASSWORD",
        "DB_DATABASE",
    ],
    properties: {
        PORT: { type: "number", default: 8080 },
        HOSTNAME: { type: "string", default: "localhost" },
        JWT_SECRET: { type: "string" },
        JWT_EXPIRY_TIME: { type: "string" },
        JWT_SECURE: { type: "boolean" },
        DB_HOST: { type: "string" },
        DB_PORT: { type: "number", default: 5432 },
        DB_USERNAME: { type: "string" },
        DB_PASSWORD: { type: "string" },
        DB_DATABASE: { type: "string" },
    },
} as JSONSchemaType<Env>;
