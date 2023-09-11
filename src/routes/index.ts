import { FastifyInstance } from "fastify";

import addAuthFlowRoutes from "./flow";

export default function addRoutes(app: FastifyInstance) {
    addAuthFlowRoutes(app);
}
