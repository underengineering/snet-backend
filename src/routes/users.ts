import { FastifyPluginCallback } from "fastify";

import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { User } from "../entity/User";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import { PrivateUserSchema, PublicUserSchema } from "../plugins/schemas";
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
            onRequest: app.authenticate,
        },
        (req) => {
            return req.userEntity;
        }
    );

    done();
};

export default route;
