import { FastifyPluginCallback } from "fastify";

import { Type } from "@fastify/type-provider-typebox";

import { AuthenticateResponseSchema } from "../plugins/authenticate";
import { SensibleErrorSchema } from "../plugins/schemas";
import { FileService } from "../services/file";
import { FastifyInstanceTypeBox } from "../utils";

interface Options {
    fileService: FileService;
}

const route: FastifyPluginCallback<Options> = (
    app: FastifyInstanceTypeBox,
    { fileService },
    done
) => {
    const TAGS = ["files"];
    app.get(
        "/:hashSha256",
        {
            schema: {
                description: "Download a file",
                produces: ["multipart/form-data"],
                tags: TAGS,
                params: Type.Object({
                    hashSha256: Type.String({ pattern: "[a-f0-9]{64}" }),
                }),
                response: {
                    200: Type.Any(),
                    401: Type.Ref(AuthenticateResponseSchema),
                    404: Type.Ref(SensibleErrorSchema),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { hashSha256 } = req.params;

            const file = await fileService.getFile(hashSha256);
            if (file === undefined) return res.notFound("File not found");

            return res
                .header("Content-Type", file.file.mimeType)
                .send(file.stream);
        }
    );

    app.post(
        "/",
        {
            schema: {
                description: "Upload a new file",
                consumes: ["multipart/form-data"],
                tags: TAGS,
                response: {
                    200: Type.Object({
                        hash: Type.String({ pattern: "[a-f0-9]{64}" }),
                    }),
                    400: Type.Ref(SensibleErrorSchema),
                    401: Type.Ref(AuthenticateResponseSchema),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const file = await req.file();
            if (file === undefined) return res.badRequest("Expected a file");

            return await fileService.uploadFile(
                req.userEntity,
                file.file,
                file.filename,
                file.mimetype
            );
        }
    );

    done();
};

export default route;
