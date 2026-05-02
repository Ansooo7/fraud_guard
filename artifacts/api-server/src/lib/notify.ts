import { db, notificationsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendToUser } from "./websocket";

type NotifyOptions = {
  userId: number;
  type: string;
  title: string;
  message?: string;
  caseId?: number;
};

export async function createNotification(opts: NotifyOptions): Promise<void> {
  const [notification] = await db
    .insert(notificationsTable)
    .values({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      message: opts.message,
      caseId: opts.caseId,
    })
    .returning();

  // Push real-time to connected socket
  sendToUser(opts.userId, {
    type: "notification",
    data: notification,
  });
}

export async function notifyAllAdmins(opts: Omit<NotifyOptions, "userId">): Promise<void> {
  const admins = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"));

  await Promise.all(admins.map((a) => createNotification({ ...opts, userId: a.id })));
}

export async function notifyAnalysts(opts: Omit<NotifyOptions, "userId">): Promise<void> {
  const analysts = await db
    .select({ id: usersTable.id })
    .from(usersTable);

  await Promise.all(analysts.map((a) => createNotification({ ...opts, userId: a.id })));
}
