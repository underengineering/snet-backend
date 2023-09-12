import { FastifyInstance } from "fastify";

import meRoute from "./me";

export default function addUsersRoutes(app: FastifyInstance) {
    meRoute(app);
}
