"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function LoginForm({ isSignUp = false }: { isSignUp?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);

  function handleCredentialSubmit(e: React.FormEvent) {
    e.preventDefault();
    alert("Email/password authentication is not supported yet. Please continue with Google or GitHub.");
  }

  return (
    <form className="space-y-md" onSubmit={handleCredentialSubmit}>
      {isSignUp && (
        <div className="space-y-xs">
          <label className="block font-body-sm text-body-sm text-on-surface-variant" htmlFor="name">Full Name</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">person</span>
            <input 
              className="w-full bg-[#0A0A0A] border border-[#262626] text-on-surface rounded-lg pl-10 pr-3 py-2 font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
              id="name" name="name" placeholder="Jane Doe" required type="text"
            />
          </div>
        </div>
      )}

      {/* Email */}
      <div className="space-y-xs">
        <label className="block font-body-sm text-body-sm text-on-surface-variant" htmlFor="email">Email Address</label>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">mail</span>
          <input 
            className="w-full bg-[#0A0A0A] border border-[#262626] text-on-surface rounded-lg pl-10 pr-3 py-2 font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
            id="email" name="email" placeholder="developer@example.com" required type="email"
          />
        </div>
      </div>
      
      {/* Password */}
      <div className="space-y-xs">
        <div className="flex justify-between items-center">
          <label className="block font-body-sm text-body-sm text-on-surface-variant" htmlFor="password">Password</label>
          {!isSignUp && (
            <button type="button" onClick={() => alert("Password reset is not supported yet. Please use Google or GitHub.")} className="font-body-sm text-body-sm text-primary hover:text-primary-container transition-colors">Forgot?</button>
          )}
        </div>
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">lock</span>
          <input 
            className="w-full bg-[#0A0A0A] border border-[#262626] text-on-surface rounded-lg pl-10 pr-10 py-2 font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
            id="password" name="password" placeholder="••••••••" required type={showPassword ? "text" : "password"}
          />
          <button 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors" 
            type="button"
            onClick={() => setShowPassword(!showPassword)}
          >
            <span className="material-symbols-outlined text-[18px]">{showPassword ? "visibility" : "visibility_off"}</span>
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <div className="block mt-lg">
        <Button type="submit" className="w-full text-base py-2 gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] h-10">
          {isSignUp ? "Sign Up" : "Sign In"}
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Button>
      </div>
    </form>
  );
}
