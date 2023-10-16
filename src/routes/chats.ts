import { FastifyPluginCallback } from "fastify";
import { In, IsNull, LessThan, Not } from "typeorm";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { Chat } from "../entity/Chat";
import { Message } from "../entity/Message";
import { FriendRequest, User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import {
    ChatSchema,
    MessageSchema,
    SensibleErrorSchema,
} from "../plugins/schemas";
import { FastifyInstanceTypeBox } from "../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
    done
) => {
    const TAGS = ["chats"];
    app.post(
        "/",
        {
            schema: {
                description: "Create a new chat",
                tags: TAGS,
                body: Type.Object({
                    participants: Type.Array(Type.String({ format: "uuid" }), {
                        minItems: 1,
                    }),
                }),
                response: {
                    200: Type.Object(
                        {
                            id: Type.String({ format: "uuid" }),
                        },
                        { description: "Success" }
                    ),
                    400: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        {
                            description:
                                "Tried to add a participant not in friend list",
                        }
                    ),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                    404: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        { description: "Chat or participant not found" }
                    ),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { participants } = req.body;

            const userRepo = app.dataSource.getRepository(User);
            const friendRequestsRepo =
                app.dataSource.getRepository(FriendRequest);
            const participantEntities = await userRepo.findBy({
                id: In(participants),
            });

            if (participantEntities.length !== participants.length)
                return res.notFound("Participant not found");

            const friends = await friendRequestsRepo.find({
                relations: { sender: true, receiver: true },
                where: [
                    {
                        sender: { id: req.userId },
                        receiver: { id: In(participants) },
                        acceptedAt: Not(IsNull()),
                    },
                    {
                        sender: { id: In(participants) },
                        receiver: { id: req.userId },
                        acceptedAt: Not(IsNull()),
                    },
                ],
            });

            const friendIds = new Set(
                friends.map((friend) =>
                    friend.sender.id === req.userId
                        ? friend.receiver.id
                        : friend.sender.id
                )
            );

            for (const participant of participantEntities) {
                if (!friendIds.has(participant.id)) {
                    return res.badRequest(
                        "Tried to add a participant not in friend list"
                    );
                }
            }

            const chatRepo = app.dataSource.getRepository(Chat);
            const newChat = chatRepo.create({
                participants: [...participantEntities, req.userEntity],
            });

            await chatRepo.save(newChat);

            return { id: newChat.id };
        }
    );

    app.get(
        "/",
        {
            schema: {
                description: "Get chats",
                tags: TAGS,
                response: {
                    200: Type.Array(
                        Type.Composite([
                            ChatSchema,
                            Type.Object({
                                messages: Type.Array(
                                    Type.Ref<typeof MessageSchema>(
                                        "MessageSchema"
                                    )
                                ),
                            }),
                        ])
                    ),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const chatRepo = app.dataSource.getRepository(Chat);
            const foundChats = await chatRepo
                .createQueryBuilder("chats")
                // Load all participants
                .leftJoinAndSelect(
                    "chat_participants_user",
                    "participants_many_to_many",
                    '"participants_many_to_many"."chatId" = chats.id'
                )
                .leftJoinAndSelect("chats.participants", "participants")
                .where('"participants_many_to_many"."userId" = :id', {
                    id: req.userId,
                })
                .getMany();

            const messageRepo = app.dataSource.getRepository(Message);
            const foundChatsWithMessage = await Promise.all(
                foundChats.map<Promise<Chat>>((chat) =>
                    messageRepo
                        .find({
                            relations: { author: true },
                            where: { chat: { id: chat.id } },
                            order: { createdAt: "desc" },
                            take: 1,
                        })
                        .then((messages) => {
                            // Add last message
                            return {
                                ...chat,
                                messages,
                            };
                        })
                )
            );

            return foundChatsWithMessage.map((chat) => {
                return {
                    ...chat,
                    createdAt: chat.createdAt.toISOString(),
                    participants: chat.participants.map((user) => {
                        return {
                            ...user,
                            registeredAt: user.registeredAt.toISOString(),
                            lastOnlineAt: user.lastOnlineAt.toISOString(),
                            avatar:
                                user.avatar === null
                                    ? undefined
                                    : user.avatar.hashSha256,
                        };
                    }),
                    messages: chat.messages.map((message) => {
                        return {
                            ...message,
                            author: {
                                ...message.author,
                                registeredAt:
                                    message.author.registeredAt.toISOString(),
                                lastOnlineAt:
                                    message.author.lastOnlineAt.toISOString(),
                                avatar:
                                    message.author.avatar === null
                                        ? undefined
                                        : message.author.avatar.hashSha256,
                            },
                            createdAt: message.createdAt.toISOString(),
                        };
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
                    200: Type.Object({}, { description: "Success" }),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                    404: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        { description: "Chat not found" }
                    ),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { id, content } = req.body;

            const chatRepo = app.dataSource.getRepository(Chat);
            const foundChat = await chatRepo.findOne({
                relations: {
                    messages: true,
                },
                where: {
                    id,
                },
            });

            if (foundChat === null) return res.notFound("Chat not found");

            const messageRepo = app.dataSource.getRepository(Message);
            const message = messageRepo.create({
                author: req.userEntity,
                chat: { id },
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
                    200: Type.Array(
                        Type.Ref<typeof MessageSchema>("MessageSchema")
                    ),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            } as const,
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const { id, beforeId, limit } = req.query;

            const messageRepo = app.dataSource.getRepository(Message);
            const messages = await messageRepo.find({
                relations: { author: true },
                where: {
                    id: beforeId !== undefined ? LessThan(beforeId) : undefined,
                    chat: { id },
                },
                order: { id: "asc" },
                take: limit ?? 30,
            });

            return messages.map((message) => ({
                ...message,
                createdAt: message.createdAt.toISOString(),
                author: {
                    ...message.author,
                    registeredAt: message.author.registeredAt.toISOString(),
                    lastOnlineAt: message.author.lastOnlineAt.toISOString(),
                    avatar:
                        message.author.avatar === null
                            ? undefined
                            : message.author.avatar.hashSha256,
                },
            }));
        }
    );

    done();
};

export default route;
