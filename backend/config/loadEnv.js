import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

config();
config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });
