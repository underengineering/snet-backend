import { FastifyInstance } from "fastify";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";

export type FastifyInstanceTypeBox = FastifyInstance<
    any,
    any,
    any,
    any,
    TypeBoxTypeProvider
>;
