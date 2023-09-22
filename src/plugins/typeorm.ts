import { FastifyPluginAsync } from "fastify";
import fastifyPlugin from "fastify-plugin";
import pg from "pg";
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
        // https://github.com/typeorm/typeorm/issues/9627
        // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/66684
        (
            pg.defaults as typeof pg.defaults & {
                parseInputDatesAsUTC: boolean;
            }
        ).parseInputDatesAsUTC = true;
        const dateParser = pg.types.getTypeParser(pg.types.builtins.TIMESTAMP);
        pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (val: string) =>
            dateParser(`${val}Z`)
        );

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
