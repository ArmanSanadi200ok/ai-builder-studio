"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateProfile, deleteAccount } from "@/app/actions/settings";
import { useRouter } from "next/navigation";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await updateProfile(name);
      alert("Profile updated successfully!");
    } catch (err: any) {
      alert("Failed to update profile: " + err.message);
    } finally {
      setLoading(false);
    }
  }

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
    <div className="flex flex-col gap-6 w-full max-w-md">
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label className="font-label-md text-on-surface mb-1 block">Full Name</label>
          <Input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <Button type="submit" disabled={loading} className="w-fit">
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </form>

      <div className="mt-8 pt-6 border-t border-error/20 flex flex-col gap-4">
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
