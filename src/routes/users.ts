import { FastifyPluginCallback } from "fastify";

import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { Static, Type } from "@sinclair/typebox";

import { FriendRequest, User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import {
    PrivateUserSchema,
    PublicUserSchema,
    SensibleErrorSchema,
} from "../plugins/schemas";

const route: FastifyPluginCallback = (app, _opts, done) => {
    app.withTypeProvider<TypeBoxTypeProvider>().get(
        "/",
        {
            schema: {
                description: "Get user info",
                querystring: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Ref<typeof PublicUserSchema>("PublicUserSchema"),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { id } = req.query;

            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id });
            if (user === null) return res.notFound("User not found");

            return {
                ...user,
                registeredAt: user.registeredAt.toISOString(),
                lastOnlineAt: user.lastOnlineAt.toISOString(),
            };
        }
    );

    app.withTypeProvider<TypeBoxTypeProvider>().get(
        "/me",
        {
            schema: {
                response: {
                    200: Type.Ref<typeof PrivateUserSchema>(
                        "PrivateUserSchema"
                    ),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: app.authenticate,
        },
        (req) => {
            return req.userEntity;
        }
    );

    app.withTypeProvider<TypeBoxTypeProvider>().post(
        "/friendRequests",
        {
            schema: {
                description: "Send friend request",
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({}),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                    404: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        { description: "Tried to send friend request to self" }
                    ),
                    409: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        { description: "There is an friend request already" }
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { id } = req.body;

            if (req.userEntity.id === id)
                return res.badRequest("Can't send friend request to self");

            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id });
            if (user === null) return res.notFound("User not found");

            const friendRequestRepo =
                app.dataSource.getRepository(FriendRequest);
            const friendRequestCount = await friendRequestRepo.findOneBy({
                sender: {
                    id: req.userId,
                },
                receiver: {
                    id: user.id,
                },
                isRemoved: false,
            });

            if (friendRequestCount !== null) {
                if (friendRequestCount.isAccepted)
                    return res.conflict(
                        "This user is already in the friend list"
                    );

                return res.conflict(
                    "There is a pending friend request already"
                );
            }

            const friendRequest = friendRequestRepo.create({
                sender: req.userEntity,
                receiver: user,
            });

            await friendRequestRepo.save(friendRequest);

            return {};
        }
    );

    app.withTypeProvider<TypeBoxTypeProvider>().get(
        "/friendRequests",
        {
            schema: {
                description: "List pending friend requests",
                response: {
                    200: Type.Array(
                        Type.Object({
                            id: Type.String({ format: "uuid" }),
                            sender: Type.Ref<typeof PublicUserSchema>(
                                "PublicUserSchema"
                            ),
                            sentAt: Type.String({ format: "date-time" }),
                        })
                    ),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOne({
                relations: {
                    receivedFriendRequests: { sender: true },
                },
                where: {
                    id: req.userId,
                    receivedFriendRequests: {
                        isAccepted: false,
                        isRemoved: false,
                    },
                },
            });

            if (user === null) return [];

            return user.receivedFriendRequests.map((friendRequest) => {
                return {
                    id: friendRequest.id,
                    sender: {
                        ...friendRequest.sender,
                        registeredAt:
                            friendRequest.sender.registeredAt.toISOString(),
                        lastOnlineAt:
                            friendRequest.sender.lastOnlineAt.toISOString(),
                    },
                    sentAt: friendRequest.sentAt.toISOString(),
                };
            });
        }
    );

    app.withTypeProvider<TypeBoxTypeProvider>().put(
        "/friendRequests",
        {
            schema: {
                description: "Accept a friend request",
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({}),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                    404: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        {
                            description:
                                "Friend request not found or was removed",
                        }
                    ),
                    409: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        {
                            description:
                                "This friend request is already accepted",
                        }
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const friendRequestRepo =
                app.dataSource.getRepository(FriendRequest);
            const friendRequest = await friendRequestRepo.findOneBy({
                id: req.body.id,
                receiver: {
                    id: req.userId,
                },
            });
            if (friendRequest === null)
                return res.notFound("Friend request not found");

            if (friendRequest.isRemoved)
                return res.notFound("Friend request removed");

            if (friendRequest.isAccepted)
                return res.conflict("This friend request is already accepted");

            friendRequest.acceptedAt = new Date();
            friendRequest.isAccepted = true;

            await friendRequestRepo.save(friendRequest);

            return {};
        }
    );

    app.withTypeProvider<TypeBoxTypeProvider>().delete(
        "/friendRequests",
        {
            schema: {
                description: "Remove a friend request",
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({}),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                    404: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        { description: "Friend request not found" }
                    ),
                    409: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema",
                        {
                            description:
                                "This friend request is already removed",
                        }
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const friendRequestRepo =
                app.dataSource.getRepository(FriendRequest);
            const friendRequest = await friendRequestRepo.findOneBy({
                id: req.body.id,
            });
            if (friendRequest === null)
                return res.notFound("Friend request not found");

            if (friendRequest.isRemoved)
                return res.conflict("This friend request is already accepted");

            friendRequest.removedAt = new Date();
            friendRequest.isRemoved = true;

            await friendRequestRepo.save(friendRequest);

            return {};
        }
    );

    const meFriendListResp = Type.Array(
        Type.Object({
            id: Type.String({ format: "uuid" }),
            user: Type.Ref<typeof PublicUserSchema>("PublicUserSchema"),
        })
    );

    app.withTypeProvider<TypeBoxTypeProvider>().get(
        "/me/friendList",
        {
            schema: {
                description: "List friends",
                response: {
                    200: meFriendListResp,
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const friendRequestRepo =
                app.dataSource.getRepository(FriendRequest);

            const [sentFriendRequests, receivedFriendRequests] =
                await Promise.all([
                    friendRequestRepo.find({
                        relations: { receiver: true },
                        where: {
                            sender: { id: req.userId },
                            isAccepted: true,
                            isRemoved: false,
                        },
                    }),
                    friendRequestRepo.find({
                        relations: { sender: true },
                        where: {
                            receiver: { id: req.userId },
                            isAccepted: true,
                            isRemoved: false,
                        },
                    }),
                ]);

            const friendRequests: Static<typeof meFriendListResp> = [];
            for (const friendRequest of sentFriendRequests) {
                friendRequests.push({
                    id: friendRequest.id,
                    user: {
                        ...friendRequest.receiver,
                        registeredAt:
                            friendRequest.receiver.registeredAt.toISOString(),
                        lastOnlineAt:
                            friendRequest.receiver.lastOnlineAt.toISOString(),
                    },
                });
            }

            for (const friendRequest of receivedFriendRequests) {
                friendRequests.push({
                    id: friendRequest.id,
                    user: {
                        ...friendRequest.sender,
                        registeredAt:
                            friendRequest.sender.registeredAt.toISOString(),
                        lastOnlineAt:
                            friendRequest.sender.lastOnlineAt.toISOString(),
                    },
                });
            }

            return friendRequests;
        }
    );

    done();
};

export default route;
