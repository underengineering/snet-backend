import { FastifyPluginCallback } from "fastify";

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { AuthenticateResponseSchema } from "../plugins/authenticate";
import {
    DMSchema,
    MessageSchema,
    PublicUserSchema,
    SensibleErrorSchema,
} from "../plugins/schemas";
import { DMService } from "../services/dm";
import { FastifyInstanceTypeBox } from "../utils";

interface Options {
    dmService: DMService;
}

const route: FastifyPluginCallback<Options> = (
    app: FastifyInstanceTypeBox,
    { dmService },
    done
) => {
    const TAGS = ["dms"];
    app.post(
        "/",
        {
            schema: {
                description: "Create a new dm",
                tags: TAGS,
                body: Type.Object({
                    participant: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Ref(DMSchema),
                    400: Type.Ref(SensibleErrorSchema, {
                        description:
                            "Tried to add a participant not in friend list",
                    }),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "Participant not found",
                    }),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const { participant: participantId } = req.body;

            const { dm, participant } = await dmService.create(
                req.userEntity,
                participantId
            );

            return {
                ...dm,
                createdAt: dm.createdAt.toISOString(),
                participant: Value.Encode(PublicUserSchema, participant),
            };
        }
    );

    app.get(
        "/",
        {
            schema: {
                description: "Get all dms",
                tags: TAGS,
                response: {
                    200: Type.Array(
                        Type.Composite([
                            DMSchema,
                            Type.Object({
                                messages: Type.Array(Type.Ref(MessageSchema)),
                            }),
                        ])
                    ),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const foundDMsWithMessage = await dmService.getAll(req.userEntity);

            return foundDMsWithMessage.map((chat) => {
                const participant =
                    chat.user1.id === req.userId ? chat.user2 : chat.user1;

                return {
                    ...chat,
                    createdAt: chat.createdAt.toISOString(),
                    participant: Value.Encode(PublicUserSchema, participant),
                    messages: chat.messages.map((message) => {
                        return Value.Encode(
                            MessageSchema,
                            [PublicUserSchema],
                            message
                        );
                    }),
                };
            });
        }
    );

    app.put(
        "/messages",
        {
            schema: {
                description: "Post a message",
                tags: [...TAGS, "messages"],
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                    content: Type.String({ maxLength: 2000 }),
                    nonce: Type.Optional(Type.Integer()),
                }),
                response: {
                    200: Type.Object({ id: Type.Integer({ minimum: 0 }) }),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "DM not found",
                    }),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const { id, content, nonce } = req.body;
            return dmService.postMessage(req.userEntity, id, content, nonce);
        }
    );

    app.get(
        "/messages",
        {
            schema: {
                description: "Paginate chat messages",
                tags: [...TAGS, "messages"],
                querystring: Type.Object({
                    id: Type.String({ format: "uuid" }),
                    beforeId: Type.Optional(Type.Integer({ minimum: 0 })),
                    limit: Type.Optional(
                        Type.Integer({ minimum: 0, maximum: 30 })
                    ),
                }),
                response: {
                    200: Type.Array(Type.Ref(MessageSchema)),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const { id, beforeId, limit } = req.query;

            const messages = await dmService.paginate(id, beforeId, limit);
            return messages.map((message) =>
                Value.Encode(MessageSchema, [PublicUserSchema], message)
            );
        }
    );

    done();
};

export default route;
