"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { deleteAccount } from "@/app/actions/settings";
import { useRouter } from "next/navigation";

export function ProfileForm() {
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete your account? This action cannot be undone.")) return;
    setDeleteLoading(true);
    try {
      await deleteAccount();
      // Redirect to home since session is gone
      router.push("/");
    } catch (err: any) {
      alert("Failed to delete account: " + err.message);
      setDeleteLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-md mx-auto sm:mx-0">
      <div className="pt-2 flex flex-col gap-4">
        <h3 className="font-headline-sm text-error">Danger Zone</h3>
        <p className="text-on-surface-variant text-sm">
          Once you delete your account, there is no going back. Please be certain.
        </p>
        <Button 
          variant="secondary" 
          onClick={handleDelete} 
          disabled={deleteLoading}
          className="w-fit !bg-error/10 !text-error hover:!bg-error/20"
        >
          {deleteLoading ? "Deleting..." : "Delete Account"}
        </Button>
      </div>
    </div>
  );
}
