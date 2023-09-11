import { FastifyInstance } from "fastify";

import loginRoute from "./login";
import registerRoute from "./register";

export default function addAuthFlowRoutes(app: FastifyInstance) {
    loginRoute(app);
    registerRoute(app);
}
