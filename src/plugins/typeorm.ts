import { FastifyPluginAsync } from "fastify";
import fastifyPlugin from "fastify-plugin";
import { DataSource, EntitySchema, MixedList } from "typeorm";

declare module "fastify" {
    interface FastifyInstance {
        dataSource: DataSource;
    }
}

export type AuthenticatePluginOptions = {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    entities: MixedList<string | Function | EntitySchema<any>>;
};

const typeOrmPlugin = fastifyPlugin<AuthenticatePluginOptions>(
    async function (app, opts) {
        const dataSource = new DataSource({
            type: "postgres",
            synchronize: true,
            logging: true,
            subscribers: [],
            migrations: [],

            ...opts,
        });

        app.decorate("dataSource", dataSource);

        await dataSource.initialize();
    }
);

export default typeOrmPlugin;
