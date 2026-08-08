import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  return (
    <div className="bg-[#0A0A0A] text-on-surface min-h-screen flex items-center justify-center p-md font-body-md antialiased selection:bg-primary-container selection:text-on-primary-container relative">
      {/* Background Pattern/Gradient (Subtle) */}
      <div className="fixed inset-0 pointer-events-none opacity-20 bg-[radial-gradient(circle_at_50%_0%,_#4f46e5_0%,_transparent_50%)]"></div>
      
      <main className="w-full max-w-[420px] relative z-10">
        {/* Logo Area */}
        <div className="flex flex-col items-center justify-center mb-xl">
          <div className="w-16 h-16 rounded-xl overflow-hidden mb-lg shadow-lg">
            <img alt="ABS Logo" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtGudkTY9_nAvLthTaWRiVim4xTa__fUbima39ryJ6NgRNKLO1raznUhOyAvzNnozMa2xQnlk_SkDBD0RhZgBAYkuZ1xilLp5Doei8pBPYnRqUvOaNertr2tGtB-325mN2KVru2z2_dxJMzbShGJou4Ge4_OBCCJ-OP0vcS7nLZ-BH58oIqRj7ldixteWUVAguJ20qNqnVj_y5_yhR4ARP3_fCzI8QOCFc9o_JNPhB92GSqMLrBJXD" />
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-xs">Welcome Back</h1>
          <p className="font-body-sm text-body-sm text-on-surface-variant">Sign in to continue to AI Builder Studio</p>
        </div>

        {/* Auth Card */}
        <div className="glass-panel rounded-xl border border-[#262626] p-lg shadow-2xl relative overflow-hidden bg-[#161616]/80 backdrop-blur-md">
          {/* Tabs (Sign In / Sign Up) */}
          <div className="flex border-b border-[#262626] mb-lg">
            <button className="flex-1 pb-sm font-label-caps text-label-caps text-primary border-b-2 border-primary transition-colors">SIGN IN</button>
            <button className="flex-1 pb-sm font-label-caps text-label-caps text-on-surface-variant hover:text-on-surface transition-colors">SIGN UP</button>
          </div>

          {/* Form */}
          <form className="space-y-md">
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
                <a className="font-body-sm text-body-sm text-primary hover:text-primary-container transition-colors" href="#">Forgot?</a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 text-[18px]">lock</span>
                <input 
                  className="w-full bg-[#0A0A0A] border border-[#262626] text-on-surface rounded-lg pl-10 pr-10 py-2 font-body-md text-body-md placeholder:text-on-surface-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" 
                  id="password" name="password" placeholder="••••••••" required type="password"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50 hover:text-on-surface transition-colors" type="button">
                  <span className="material-symbols-outlined text-[18px]">visibility_off</span>
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <Link href="/dashboard" className="block mt-lg">
              <Button className="w-full text-base py-2 gap-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] h-10">
                Sign In
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Button>
            </Link>
          </form>

          {/* Divider */}
          <div className="relative flex items-center py-lg">
            <div className="flex-grow border-t border-[#262626]"></div>
            <span className="flex-shrink-0 mx-4 font-body-sm text-body-sm text-on-surface-variant">or</span>
            <div className="flex-grow border-t border-[#262626]"></div>
          </div>

          {/* Social Auth */}
          <button className="w-full bg-transparent border border-[#262626] text-on-surface rounded-lg py-2 px-4 font-body-md text-body-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"></path>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
            </svg>
            Continue with Google
          </button>
          <button className="w-full bg-transparent border border-[#262626] text-on-surface rounded-lg py-2 px-4 font-body-md text-body-md hover:bg-surface-container-high transition-colors flex items-center justify-center gap-3 mt-md">
            <svg className="w-5 h-5 text-on-surface fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.6.113.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"></path>
            </svg>
            Continue with GitHub
          </button>
        </div>

        <div className="text-center mt-lg">
          <p className="font-body-sm text-body-sm text-on-surface-variant">
            Don't have an account? <a className="text-primary hover:text-primary-container transition-colors font-medium" href="#">Create Account</a>
          </p>
        </div>
      </main>
    </div>
  );
}
