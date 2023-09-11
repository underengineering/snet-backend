import { EnvSchemaOpt, JSONSchemaType } from "env-schema";

type Env = {
    PORT: number;
    JWT_SECRET: string;
    JWT_EXPIRY_TIME: string;
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
        "JWT_SECRET",
        "JWT_EXPIRY_TIME",
        "DB_HOST",
        "DB_PORT",
        "DB_USERNAME",
        "DB_PASSWORD",
        "DB_DATABASE",
    ],
    properties: {
        PORT: { type: "string", default: 8080 },
        JWT_SECRET: { type: "string" },
        JWT_EXPIRY_TIME: { type: "string" },
        DB_HOST: { type: "string" },
        DB_PORT: { type: "number", default: 5432 },
        DB_USERNAME: { type: "string" },
        DB_PASSWORD: { type: "string" },
        DB_DATABASE: { type: "string" },
    },
} as JSONSchemaType<Env>;
