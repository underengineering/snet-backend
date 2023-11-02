import { FastifyPluginCallback } from "fastify";

import { Type } from "@sinclair/typebox";

import { AuthenticateResponseSchema } from "../plugins/authenticate";
import { SensibleErrorSchema } from "../plugins/schemas";
import { FastifyInstanceTypeBox } from "../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
    done
) => {
    app.get(
        "/",
        {
            websocket: true,
            schema: {
                description: "",
                tags: ["websocket"],
                response: {
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "DM not found",
                    }),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        (conn, req) => {
            app.wsServer.handle(conn, req.userId);
        }
    );

    done();
};

export default route;
