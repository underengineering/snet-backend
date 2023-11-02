import { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

import { SocketStream } from "@fastify/websocket";

export interface WebSocketPluginOptions {}

type TimerId = ReturnType<typeof setTimeout>;
export class WebSocketClient {
    constructor(private readonly conn: SocketStream) {}

    send(message: string) {
        this.conn.socket.send(message);
    }
}

export class WebSocketServer {
    constructor(private readonly app: FastifyInstance) {}

    handle(conn: SocketStream, userId: string) {
        let clients = this.clients[userId];
        if (clients === undefined) {
            clients = new Set();
            this.clients[userId] = clients;
        }

        const client = new WebSocketClient(conn);
        clients.add(client);

        // Ping
        let isAlive = true;
        let timerId = setInterval(() => {
            if (!isAlive) {
                this.app.log.info("WS client '%s' timed out", userId);
                conn.socket.close();
                return;
            }

            isAlive = false;
            conn.socket.send("ping");

            this.app.log.debug("Sent ping to WS client '%s'", userId);
        }, 5000);

        conn.socket.on("message", (data) => {
            if (data instanceof Buffer && data.toString("binary") === "pong")
                isAlive = true;
        });

        // Clean up after the client has disconnected
        conn.socket.on("close", () => {
            this.app.log.info("Closing WS client '%s'", userId);

            clearInterval(timerId);
            clients.delete(client);
            if (clients.size === 0) delete this.clients[userId];
        });
    }

    broadcast(message: any) {
        const serializedMessage = this.serialize(message);
        for (const clients of Object.values(this.clients))
            for (const client of clients) client.send(serializedMessage);
    }

    send(userId: string, message: any): boolean;
    send(userIds: string[], message: any): boolean;
    send(userIds: string | string[], message: any) {
        if (typeof userIds === "string") userIds = [userIds];

        const serializedMessage = this.serialize(message);
        for (const userId of userIds) {
            const clients = this.clients[userId];
            if (clients === undefined) return false;

            for (const client of clients) client.send(serializedMessage);
        }

        return true;
    }

    private serialize(message: any) {
        return JSON.stringify(message);
    }

    private readonly clients: Record<string, Set<WebSocketClient>> = {};
}

declare module "fastify" {
    interface FastifyInstance {
        wsServer: WebSocketServer;
    }
}

const wsPlugin = fastifyPlugin<WebSocketPluginOptions>(async function (app) {
    const server = new WebSocketServer(app);
    app.decorate("wsServer", server);
});

export default wsPlugin;
