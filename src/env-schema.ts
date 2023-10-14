import { EnvSchemaData, EnvSchemaOpt, JSONSchemaType } from "env-schema";

import { Static, Type } from "@sinclair/typebox";

const EnvSchema = Type.Object({
    PORT: Type.Integer({ default: 8080 }),
    HOSTNAME: Type.String({ default: "localhost" }),
    JWT_SECRET: Type.String(),
    JWT_EXPIRY_TIME: Type.String(),
    JWT_SECURE: Type.Boolean(),
    DB_HOST: Type.String(),
    DB_PORT: Type.Integer({ default: 5432 }),
    DB_USERNAME: Type.String(),
    DB_PASSWORD: Type.String(),
    DB_DATABASE: Type.String(),
    STORAGE_PATH: Type.String(),
    STORAGE_TMP_PATH: Type.Optional(Type.String()),
    // Set to true if STORAGE_TMP_PATH
    // is on the same partition as the STORAGE_PATH
    STORAGE_ATOMIC: Type.Boolean(),
});

declare module "fastify" {
    interface FastifyInstance {
        config: Static<typeof EnvSchema>;
    }
}

export default EnvSchema;
