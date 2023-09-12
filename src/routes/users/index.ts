import { FastifyInstance } from "fastify";

import meRoute from "./me";
import userRoute from "./user";

export default function addUsersRoutes(app: FastifyInstance) {
    meRoute(app);
    userRoute(app);
}
