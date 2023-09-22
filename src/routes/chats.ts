import { FastifyPluginCallback } from "fastify";
import { In } from "typeorm";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Type } from "@sinclair/typebox";

import { Chat } from "../entity/Chat";
import { Message } from "../entity/Message";
import { FriendRequest, User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import { SensibleErrorSchema } from "../plugins/schemas";

const route: FastifyPluginCallback = (app, _opts, done) => {
    app.withTypeProvider<TypeBoxTypeProvider>().post(
        "/chats",
        {
            schema: {
                description: "Create a new chat",
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
                    403: Type.Ref<typeof AuthenticateResponseSchema>(
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
                        isAccepted: true,
                    },
                    {
                        sender: { id: In(participants) },
                        receiver: { id: req.userId },
                        isAccepted: true,
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
                participants: participantEntities,
            });

            await chatRepo.save(newChat);

            return { id: newChat.id };
        }
    );

    app.withTypeProvider<TypeBoxTypeProvider>().put(
        "/chats",
        {
            schema: {
                description: "Post a message",
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                    content: Type.String({ maxLength: 2000 }),
                }),
                response: {
                    200: Type.Object({}, { description: "Success" }),
                    403: Type.Ref<typeof AuthenticateResponseSchema>(
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

            const userRepo = app.dataSource.getRepository(User);
            const messageRepo = app.dataSource.getRepository(Message);
            const message = messageRepo.create({
                content,
            });

            await messageRepo.save(message);
            await chatRepo
                .createQueryBuilder()
                .relation(Chat, "messages")
                .of(foundChat)
                .add(message);

            await userRepo
                .createQueryBuilder()
                .relation(User, "messages")
                .of(req.userEntity)
                .add(message);

            return {};
        }
    );

    done();
};

export default route;
