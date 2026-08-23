import { auth } from "@/auth";
import { ProfileForm } from "./ProfileForm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/login");

  // Fetch full user from DB for accurate creation date etc.
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return redirect("/login");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <header>
        <h1 className="font-headline-md text-headline-md text-on-surface">Profile</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">Manage your account information.</p>
      </header>

      <div className="bg-surface-container rounded-xl p-lg border border-outline-variant/30 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          {user.image ? (
            <img src={user.image} alt={user.name || "Avatar"} className="w-24 h-24 rounded-full border border-outline-variant/50 shrink-0" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface border border-outline-variant/50 shrink-0">
              <span className="material-symbols-outlined text-[48px]">person</span>
            </div>
          )}
          
          <div className="flex flex-col mt-2 sm:mt-0 min-w-0 w-full">
            <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{user.name}</h2>
            <p className="text-on-surface-variant truncate">{user.email}</p>
            <p className="text-sm text-on-surface-variant mt-2">
              Joined {user.createdAt.toLocaleDateString()}
            </p>
          </div>
        </div>

        <ProfileForm />
      </div>
    </div>
  );
}
