import { FastifyInstance } from "fastify";

import chatRoute from "./chat";

export default function addChatRoutes(app: FastifyInstance) {
    chatRoute(app);
}
