import cloneable from "cloneable-readable";
import { FastifyPluginCallback } from "fastify";
import tmp from "tmp-promise";

import crypto from "node:crypto";
import fs from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import streamPromises from "node:stream/promises";

import { Type } from "@fastify/type-provider-typebox";

import { File } from "../entity/File";
import { AuthenticateResponseSchema } from "../plugins/authenticate";
import { SensibleErrorSchema } from "../plugins/schemas";
import { FastifyInstanceTypeBox } from "../utils";

const route: FastifyPluginCallback = (
    app: FastifyInstanceTypeBox,
    _opts,
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
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                    404: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema"
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const { hashSha256 } = req.params;

            const fileRepo = app.dataSource.getRepository(File);
            const foundFile = await fileRepo.findOneBy({ hashSha256 });
            if (foundFile === null) {
                return res.notFound("File not found");
            }

            const filePath = `${app.config.STORAGE_PATH}/${foundFile.partition}/${foundFile.hashSha256}`;
            const fileStream = fs.createReadStream(filePath);

            return res
                .header("Content-Type", foundFile.mimeType)
                .send(fileStream);
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
                    400: Type.Ref<typeof SensibleErrorSchema>(
                        "SensibleErrorSchema"
                    ),
                    401: Type.Ref<typeof AuthenticateResponseSchema>(
                        "AuthenticateResponseSchema"
                    ),
                },
            },
            onRequest: (req, res) => app.authenticate(req, res),
        },
        async (req, res) => {
            const file = await req.file();
            if (file === undefined) return res.badRequest("Expected a file");

            const tmpFile = await tmp.file({
                dir: app.config.STORAGE_TMP_PATH,
            });

            // Open a write stream from the tmp file fd
            const fileStream = fs.createWriteStream(tmpFile.path, {
                fd: tmpFile.fd,
            });

            const hasher = crypto.createHash("SHA256");

            // Stream into the temp file and hasher
            try {
                const inputFileStream = cloneable(file.file);

                await Promise.all([
                    streamPromises.pipeline(
                        inputFileStream.clone(),
                        fileStream
                    ),
                    streamPromises.pipeline(inputFileStream, hasher),
                ]);

                const digest = hasher.digest("hex");
                const fileRepo = app.dataSource.getRepository(File);
                const foundFileEntity = await fileRepo.findOneBy({
                    hashSha256: digest,
                });

                if (foundFileEntity !== null) {
                    // Return existing file id
                    return { hash: foundFileEntity.hashSha256 };
                }

                // Copy to a new path
                const partition = parseInt(digest.slice(-2), 16);
                const filePath = `${app.config.STORAGE_PATH}/${partition}/${digest}`;

                await fsAsync.mkdir(path.dirname(filePath), {
                    recursive: true,
                });

                if (app.config.STORAGE_ATOMIC) {
                    await fsAsync.rename(tmpFile.path, filePath);
                } else {
                    await fsAsync.copyFile(tmpFile.path, filePath);
                }

                // Strip write permission
                // r--r-----
                await fsAsync.chmod(filePath, 0o440);

                const fileEntity = fileRepo.create({
                    uploader: req.userEntity,
                    hashSha256: digest,
                    partition,
                    fileName: file.filename,
                    mimeType: file.mimetype,
                    size: fileStream.bytesWritten,
                });

                await fileRepo.save(fileEntity);

                return { hash: digest };
            } finally {
                tmpFile.cleanup();
            }
        }
    );

    done();
};

export default route;
