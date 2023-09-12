import { FastifyInstance } from "fastify";

import addAuthFlowRoutes from "./flow";
import addUsersRoutes from "./users";

export default function addRoutes(app: FastifyInstance) {
    addAuthFlowRoutes(app);
    addUsersRoutes(app);
}
