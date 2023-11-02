import { FastifyInstance } from "fastify";
import { In, IsNull, Not } from "typeorm";

import { Value } from "@sinclair/typebox/value";

import { DirectMessage } from "../entity/DirectMessage";
import { Message } from "../entity/Message";
import { FriendRequest, User } from "../entity/User";
import { MessageSchema, PublicUserSchema } from "../plugins/schemas";

export class DMService {
    constructor(private readonly app: FastifyInstance) {}

    async create(user: User, participantId: string) {
        const userRepo = this.app.dataSource.getRepository(User);
        const friendRequestsRepo =
            this.app.dataSource.getRepository(FriendRequest);
        const participantEntity = await userRepo.findOne({
            relations: { avatar: true },
            where: {
                id: participantId,
            },
        });

        if (participantEntity === null)
            throw this.app.httpErrors.notFound("Participant not found");

        const inFriendList = await friendRequestsRepo.exist({
            where: [
                {
                    sender: { id: user.id },
                    receiver: { id: participantId },
                    acceptedAt: Not(IsNull()),
                },
                {
                    sender: { id: participantId },
                    receiver: { id: user.id },
                    acceptedAt: Not(IsNull()),
                },
            ],
        });

        if (!inFriendList)
            throw this.app.httpErrors.badRequest(
                "Tried to add a participant not in friend list"
            );

        const dmRepo = this.app.dataSource.getRepository(DirectMessage);

        // Check for an existing DM first
        const foundDM = await dmRepo.findOne({
            relations: { user1: { avatar: true }, user2: { avatar: true } },
            where: {
                user1: In([user.id, participantId]),
                user2: In([user.id, participantId]),
            },
        });

        // Return existing DM
        if (foundDM !== null)
            return { dm: foundDM, participant: participantEntity };

        const newDM = dmRepo.create({
            user1: user,
            user2: participantEntity,
        });

        await dmRepo.save(newDM);

        // Return new DM
        return { dm: newDM, participant: participantEntity };
    }

    async getAll(user: User) {
        const dmRepo = this.app.dataSource.getRepository(DirectMessage);
        const foundDMs = await dmRepo
            .createQueryBuilder("dms")
            .leftJoinAndSelect("dms.user1", "user1")
            .leftJoinAndSelect("dms.user2", "user2")
            .leftJoinAndSelect("user1.avatar", "user1.avatar")
            .leftJoinAndSelect("user2.avatar", "user2.avatar")
            .where('"dms"."user1Id" = :id OR "dms"."user2Id" = :id', {
                id: user.id,
            })
            .getMany();

        const messageRepo = this.app.dataSource.getRepository(Message);
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

        return foundDMsWithMessage;
    }

    async postMessage(
        author: User,
        dmId: string,
        content: string,
        nonce?: number
    ) {
        const dmRepo = this.app.dataSource.getRepository(DirectMessage);
        const foundDM = await dmRepo.findOne({
            relations: {
                user1: true,
                user2: true,
                messages: true,
            },
            where: {
                id: dmId,
            },
        });

        if (foundDM === null)
            throw this.app.httpErrors.notFound("Chat not found");

        const messageRepo = this.app.dataSource.getRepository(Message);
        const message = messageRepo.create({
            author: author,
            dm: { id: dmId },
            content,
        });

        await messageRepo.save(message);

        const participant =
            foundDM.user1.id === author.id ? foundDM.user2 : foundDM.user1;
        const encodedMessage = Value.Encode(
            MessageSchema,
            [PublicUserSchema],
            message
        );

        this.app.wsServer.send(participant.id, {
            type: "message",
            body: {
                dmId: foundDM.id,
                message: encodedMessage,
            },
        });

        this.app.wsServer.send(author.id, {
            type: "message",
            body: {
                dmId: foundDM.id,
                message: { ...encodedMessage, nonce },
            },
        });

        return message;
    }

    async paginate(dmId: string, beforeId?: number, limit?: number) {
        const messageRepo = this.app.dataSource.getRepository(Message);
        let messagesQuery = messageRepo
            .createQueryBuilder("message")
            .innerJoin("message.dm", "dm")
            .innerJoinAndSelect("message.author", "author");

        if (beforeId === undefined) {
            messagesQuery = messagesQuery.where("dm.id = :dmId", {
                dmId: dmId,
            });
        } else {
            messagesQuery = messagesQuery.where(
                "dm.id = :dmId AND message.id < :beforeId",
                {
                    dmId: dmId,
                    beforeId,
                }
            );
        }

        messagesQuery = messagesQuery
            .orderBy("message.id", "DESC")
            .limit(limit ?? 30);

        const messages = await messagesQuery.getMany();

        return messages.reverse();
    }
}
