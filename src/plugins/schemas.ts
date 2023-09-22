import fastifyPlugin from "fastify-plugin";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

export const SensibleErrorSchema = Type.Object(
    {
        statusCode: Type.Integer(),
        error: Type.String(),
        message: Type.String(),
    },
    {
        $id: "SensibleErrorSchema",
    }
);

const schemasPlugin = fastifyPlugin(async function (app) {
    app.withTypeProvider<TypeBoxTypeProvider>().addSchema(SensibleErrorSchema);
});

export default schemasPlugin;
