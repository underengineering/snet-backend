import { FastifyPluginCallback } from "fastify";
import { IsNull, Not } from "typeorm";

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { FriendRequest, User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import {
    PublicUserSchema,
    ReceivedFriendRequestSchema,
    SensibleErrorSchema,
    SentFriendRequestSchema,
} from "../plugins/schemas";
import { FastifyInstanceTypeBox } from "../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
    done
) => {
    const TAGS = ["users", "friends"];

    app.post(
        "/",
        {
            schema: {
                description: "Send friend request",
                tags: TAGS,
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({ id: Type.String({ format: "uuid" }) }),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "Tried to send friend request to self",
                    }),
                    409: Type.Ref(SensibleErrorSchema, {
                        description: "There is an friend request already",
                    }),
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
            const foundFriendRequest = await friendRequestRepo.findOneBy({
                sender: {
                    id: req.userId,
                },
                receiver: {
                    id: user.id,
                },
                removedAt: IsNull(),
            });

            if (foundFriendRequest !== null)
                return res.conflict(
                    "There is a pending friend request already"
                );

            const friendRequest = friendRequestRepo.create({
                sender: req.userEntity,
                receiver: user,
            });

            await friendRequestRepo.save(friendRequest);

            return friendRequest;
        }
    );

    const meFriendListResp = Type.Array(
        Type.Object({
            id: Type.String({ format: "uuid" }),
            user: Type.Ref<typeof PublicUserSchema>("PublicUserSchema"),
        })
    );

    app.get(
        "/me",
        {
            schema: {
                description: "List friends",
                tags: TAGS,
                response: {
                    200: meFriendListResp,
                    401: Type.Ref(AuthenticateResponseSchema),
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
                        relations: { receiver: { avatar: true } },
                        where: {
                            sender: { id: req.userId },
                            acceptedAt: Not(IsNull()),
                            removedAt: IsNull(),
                        },
                    }),
                    friendRequestRepo.find({
                        relations: { sender: { avatar: true } },
                        where: {
                            receiver: { id: req.userId },
                            acceptedAt: Not(IsNull()),
                            removedAt: IsNull(),
                        },
                    }),
                ]);

            const friendRequests = [];
            for (const friendRequest of sentFriendRequests) {
                friendRequests.push({
                    id: friendRequest.id,
                    user: friendRequest.receiver,
                });
            }

            for (const friendRequest of receivedFriendRequests) {
                friendRequests.push({
                    id: friendRequest.id,
                    user: friendRequest.sender,
                });
            }

            return friendRequests.map((friendRequest) => ({
                ...friendRequest,
                user: Value.Encode(PublicUserSchema, friendRequest.user),
            }));
        }
    );

    app.get(
        "/me/requests",
        {
            schema: {
                description: "List pending friend requests",
                tags: TAGS,
                response: {
                    200: Type.Object({
                        received: Type.Array(
                            Type.Ref(ReceivedFriendRequestSchema)
                        ),
                        sent: Type.Array(Type.Ref(SentFriendRequestSchema)),
                    }),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo
                .createQueryBuilder("user")
                .leftJoinAndSelect(
                    "user.receivedFriendRequests",
                    "receivedFriendRequests",
                    "receivedFriendRequests.acceptedAt IS NULL AND receivedFriendRequests.removedAt IS NULL"
                )
                .leftJoinAndSelect(
                    "user.sentFriendRequests",
                    "sentFriendRequests",
                    "sentFriendRequests.acceptedAt IS NULL AND sentFriendRequests.removedAt IS NULL"
                )
                .leftJoinAndSelect("receivedFriendRequests.sender", "sender")
                .leftJoinAndSelect("sentFriendRequests.receiver", "receiver")
                .leftJoinAndSelect("sender.avatar", "senderAvatar")
                .leftJoinAndSelect("receiver.avatar", "receiverAvatar")
                .where("user.id = :id", { id: req.userId })
                .getOne();

            if (user === null) return { received: [], sent: [] };

            return {
                received: user.receivedFriendRequests.map((friendRequest) =>
                    Value.Encode(
                        ReceivedFriendRequestSchema,
                        [PublicUserSchema],
                        friendRequest
                    )
                ),
                sent: user.sentFriendRequests.map((friendRequest) =>
                    Value.Encode(
                        SentFriendRequestSchema,
                        [PublicUserSchema],
                        friendRequest
                    )
                ),
            };
        }
    );

    app.post(
        "/me/requests",
        {
            schema: {
                description: "Accept a friend request",
                tags: TAGS,
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({}),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "Friend request not found or was removed",
                    }),
                    409: Type.Ref(SensibleErrorSchema, {
                        description: "This friend request is already accepted",
                    }),
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

            if (friendRequest.removedAt !== null)
                return res.notFound("Friend request removed");

            if (friendRequest.acceptedAt !== null)
                return res.conflict("This friend request is already accepted");

            friendRequest.acceptedAt = new Date();

            await friendRequestRepo.save(friendRequest);

            return {};
        }
    );

    app.delete(
        "/me/requests",
        {
            schema: {
                description: "Remove a friend request",
                tags: TAGS,
                body: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Object({}),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "Friend request not found",
                    }),
                    409: Type.Ref(SensibleErrorSchema, {
                        description: "This friend request is already removed",
                    }),
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

            if (friendRequest.removedAt !== null)
                return res.conflict("This friend request is already removed");

            friendRequest.removedAt = new Date();

            await friendRequestRepo.save(friendRequest);

            return {};
        }
    );

    done();
};

export default route;
