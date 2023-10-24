import { FastifyPluginCallback } from "fastify";

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { File } from "../entity/File";
import { User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import {
    PrivateUserSchema,
    PublicUserSchema,
    SensibleErrorSchema,
} from "../plugins/schemas";
import { FastifyInstanceTypeBox } from "../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
    done
) => {
    const TAGS = ["users"];

    app.get(
        "/",
        {
            schema: {
                description: "Get user info",
                tags: TAGS,
                querystring: Type.Object({
                    id: Type.String({ format: "uuid" }),
                }),
                response: {
                    200: Type.Ref(PublicUserSchema),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { id } = req.query;

            const userRepo = app.dataSource.getRepository(User);
            const user = await userRepo.findOneBy({ id });
            if (user === null) return res.notFound("User not found");

            return Value.Encode(PublicUserSchema, user);
        }
    );

    app.get(
        "/search",
        {
            schema: {
                description: "Search users",
                tags: TAGS,
                querystring: Type.Object({
                    query: Type.String(),
                    skip: Type.Integer({ default: 0, minimum: 0 }),
                    limit: Type.Integer({
                        default: 30,
                        minimum: 0,
                        maximum: 30,
                    }),
                }),
                response: {
                    200: Type.Array(Type.Ref(PublicUserSchema)),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req) => {
            const { query, skip, limit } = req.query;

            const userRepo = app.dataSource.getRepository(User);
            const users = await userRepo
                .createQueryBuilder("user")
                .orderBy(
                    "levenshtein(CONCAT(user.name, user.surname), :query)",
                    "ASC"
                )
                .setParameter("query", query)
                .limit(limit)
                .offset(skip)
                .getMany();

            return users.map((user) => Value.Encode(PublicUserSchema, user));
        }
    );

    app.get(
        "/me",
        {
            schema: {
                description: "Get info about current user",
                tags: TAGS,
                response: {
                    200: Type.Ref(PrivateUserSchema),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        (req) => {
            return Value.Encode(PrivateUserSchema, req.userEntity);
        }
    );

    app.patch(
        "/me",
        {
            schema: {
                description: "Edit user info",
                tags: TAGS,
                body: Type.Object({
                    name: Type.Optional(Type.String({ minLength: 1 })),
                    surname: Type.Optional(Type.String({ minLength: 1 })),
                    avatar: Type.Optional(
                        Type.String({ pattern: "[a-f0-9]{64}" })
                    ),
                }),
                response: {
                    200: Type.Ref(PrivateUserSchema),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema, {
                        description: "File not found",
                    }),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { name, surname, avatar } = req.body;

            if (avatar) {
                const fileRepo = app.dataSource.getRepository(File);
                const file = await fileRepo.findOneBy({ hashSha256: avatar });
                if (file === null) return res.notFound("File not found");

                req.userEntity.avatar = file;
            }

            if (name) req.userEntity.name = name;
            if (surname) req.userEntity.surname = surname;

            const userRepo = app.dataSource.getRepository(User);
            await userRepo.save(req.userEntity);

            return Value.Encode(PrivateUserSchema, req.userEntity);
        }
    );

    done();
};

export default route;
