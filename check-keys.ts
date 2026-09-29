import { db } from "./src/db";
import { userApiKeys } from "./src/db/schema/users";
import { eq } from "drizzle-orm";
async function checkKeys() {
  const keys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, "6af50d20-9d8e-4716-97d7-33a45a2c237b")
  });
  console.log(keys.map(k => k.providerId));
  process.exit(0);
}
checkKeys();
