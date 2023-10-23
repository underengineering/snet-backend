import { FastifyPluginCallback } from "fastify";
import { In, IsNull, LessThan, Not } from "typeorm";

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { DirectMessage } from "../entity/DirectMessage";
import { Message } from "../entity/Message";
import { FriendRequest, User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import {
    DMSchema,
    MessageSchema,
    PublicUserSchema,
    SensibleErrorSchema,
} from "../plugins/schemas";
import { FastifyInstanceTypeBox } from "../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
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
        async (req, res) => {
            const { participant } = req.body;

            const userRepo = app.dataSource.getRepository(User);
            const friendRequestsRepo =
                app.dataSource.getRepository(FriendRequest);
            const participantEntity = await userRepo.findOne({
                relations: { avatar: true },
                where: {
                    id: participant,
                },
            });

            if (participantEntity === null)
                return res.notFound("Participant not found");

            const inFriendList = await friendRequestsRepo.exist({
                where: [
                    {
                        sender: { id: req.userId },
                        receiver: { id: participant },
                        acceptedAt: Not(IsNull()),
                    },
                    {
                        sender: { id: participant },
                        receiver: { id: req.userId },
                        acceptedAt: Not(IsNull()),
                    },
                ],
            });

            if (!inFriendList)
                return res.badRequest(
                    "Tried to add a participant not in friend list"
                );

            const dmRepo = app.dataSource.getRepository(DirectMessage);

            // Check for an existing dm first
            const foundDM = await dmRepo.findOne({
                relations: { user1: { avatar: true }, user2: { avatar: true } },
                where: {
                    user1: In([req.userId, participant]),
                    user2: In([req.userId, participant]),
                },
            });

            if (foundDM !== null)
                return {
                    ...foundDM,
                    createdAt: foundDM.createdAt.toISOString(),
                    participant: Value.Encode(
                        PublicUserSchema,
                        participantEntity
                    ),
                };

            const newDM = dmRepo.create({
                user1: req.userEntity,
                user2: participantEntity,
            });

            await dmRepo.save(newDM);

            return {
                ...newDM,
                createdAt: newDM.createdAt.toISOString(),
                participant: Value.Encode(PublicUserSchema, participantEntity),
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
            const dmRepo = app.dataSource.getRepository(DirectMessage);
            const foundDMs = await dmRepo
                .createQueryBuilder("dms")
                .leftJoinAndSelect("dms.user1", "user1")
                .leftJoinAndSelect("dms.user2", "user2")
                .leftJoinAndSelect("user1.avatar", "user1.avatar")
                .leftJoinAndSelect("user2.avatar", "user2.avatar")
                .where('"dms"."user1Id" = :id OR "dms"."user2Id" = :id', {
                    id: req.userId,
                })
                .getMany();

            const messageRepo = app.dataSource.getRepository(Message);
            const foundDMsWithMessage = await Promise.all(
                foundDMs.map<Promise<DirectMessage>>((dm) =>
                    messageRepo
                        .find({
                            relations: { author: { avatar: true } },
                            where: { dm: { id: dm.id } },
                            order: { createdAt: "desc" },
                            take: 1,
                        })
                        .then((messages) => {
                            // Add last message
                            return {
                                ...dm,
                                messages,
                            };
                        })
                )
            );

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
                }),
                response: {
                    200: Type.Object({}),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "DM not found",
                    }),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { id, content } = req.body;

            const dmRepo = app.dataSource.getRepository(DirectMessage);
            const foundDM = await dmRepo.findOne({
                relations: {
                    messages: true,
                },
                where: {
                    id,
                },
            });

            if (foundDM === null) return res.notFound("Chat not found");

            const messageRepo = app.dataSource.getRepository(Message);
            const message = messageRepo.create({
                author: req.userEntity,
                dm: { id },
                content,
            });

            await messageRepo.save(message);

            return {};
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

            const messageRepo = app.dataSource.getRepository(Message);
            const messages = await messageRepo.find({
                relations: { author: { avatar: true } },
                where: {
                    id: beforeId !== undefined ? LessThan(beforeId) : undefined,
                    dm: { id },
                },
                order: { id: "asc" },
                take: limit ?? 30,
            });

            return messages.map((message) =>
                Value.Encode(MessageSchema, [PublicUserSchema], message)
            );
        }
    );

    done();
};

export default route;
