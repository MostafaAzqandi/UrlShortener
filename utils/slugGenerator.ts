import { randomBytes } from "node:crypto";

export function generateSlug(): string {
    const randomSlug = randomBytes(8);
    return randomSlug.toString("base64url");
}
