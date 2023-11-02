import cloneable from "cloneable-readable";
import { FastifyInstance } from "fastify";
import tmp from "tmp-promise";

import crypto from "node:crypto";
import fs from "node:fs";
import fsAsync from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import streamPromises from "node:stream/promises";

import { File } from "../entity/File";
import { User } from "../entity/User";

export class FileService {
    constructor(private readonly app: FastifyInstance) {}

    async getFile(hashSha256: string) {
        const fileRepo = this.app.dataSource.getRepository(File);
        const foundFile = await fileRepo.findOneBy({ hashSha256 });
        if (foundFile === null)
            throw this.app.httpErrors.notFound("File not found");

        const filePath = `${this.app.config.STORAGE_PATH}/${foundFile.partition}/${foundFile.hashSha256}`;
        const fileStream = fs.createReadStream(filePath);

        return { file: foundFile, stream: fileStream };
    }

    async uploadFile(
        uploader: User,
        file: Readable,
        fileName: string,
        mimeType: string
    ) {
        const tmpFile = await tmp.file({
            dir: this.app.config.STORAGE_TMP_PATH,
        });

        // Open a write stream from the tmp file fd
        const fileStream = fs.createWriteStream(tmpFile.path, {
            fd: tmpFile.fd,
        });

        const hasher = crypto.createHash("SHA256");

        // Stream into the temp file and hasher
        try {
            const inputFileStream = cloneable(file);

            await Promise.all([
                streamPromises.pipeline(inputFileStream.clone(), fileStream),
                streamPromises.pipeline(inputFileStream, hasher),
            ]);

            const digest = hasher.digest("hex");
            const fileRepo = this.app.dataSource.getRepository(File);
            const foundFileEntity = await fileRepo.findOneBy({
                hashSha256: digest,
            });

            if (foundFileEntity !== null) {
                // Return existing file id
                return { hash: foundFileEntity.hashSha256 };
            }

            // Copy to a new path
            const partition = parseInt(digest.slice(-2), 16);
            const filePath = `${this.app.config.STORAGE_PATH}/${partition}/${digest}`;

            await fsAsync.mkdir(path.dirname(filePath), {
                recursive: true,
            });

            if (this.app.config.STORAGE_ATOMIC) {
                await fsAsync.rename(tmpFile.path, filePath);
            } else {
                await fsAsync.copyFile(tmpFile.path, filePath);
            }

            // Strip write permission
            // r--r-----
            await fsAsync.chmod(filePath, 0o440);

            const fileEntity = fileRepo.create({
                uploader,
                hashSha256: digest,
                partition,
                fileName,
                mimeType,
                size: fileStream.bytesWritten,
            });

            await fileRepo.save(fileEntity);

            return { hash: digest };
        } finally {
            tmpFile.cleanup();
        }
    }
}
