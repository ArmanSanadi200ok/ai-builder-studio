import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <div className="bg-[#0A0A0A] text-on-background min-h-screen flex flex-col">
      {/* TopNavBar */}
      <nav className="fixed top-0 w-full z-50 flex justify-between items-center px-lg py-md bg-surface/80 backdrop-blur-md border-b border-outline-variant/20 transition-all duration-200">
        <div className="flex items-center gap-md">
          <img alt="ABS Logo" className="h-8 w-8 rounded-sm object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCtGudkTY9_nAvLthTaWRiVim4xTa__fUbima39ryJ6NgRNKLO1raznUhOyAvzNnozMa2xQnlk_SkDBD0RhZgBAYkuZ1xilLp5Doei8pBPYnRqUvOaNertr2tGtB-325mN2KVru2z2_dxJMzbShGJou4Ge4_OBCCJ-OP0vcS7nLZ-BH58oIqRj7ldixteWUVAguJ20qNqnVj_y5_yhR4ARP3_fCzI8QOCFc9o_JNPhB92GSqMLrBJXD" />
          <span className="font-headline-md text-headline-md font-bold text-on-surface">ABS</span>
        </div>
        <div className="hidden md:flex items-center gap-lg">
          <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="/dashboard">Dashboard</Link>
          <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="/dashboard/projects">Projects</Link>
          <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="#">Templates</Link>
          <Link className="font-body-md text-body-md text-on-surface-variant hover:text-primary transition-colors" href="/dashboard/providers">AI Providers</Link>
        </div>
        <div className="flex items-center gap-md">
          <Link href="/login">
            <Button className="hidden md:flex">Start Building</Button>
          </Link>
          <div className="h-8 w-8 rounded-full bg-surface-container-high overflow-hidden border border-outline-variant/30 ml-sm cursor-pointer">
            <img className="w-full h-full object-cover" alt="Profile" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCP42PypZjFPX7wvUqvShVakvLP9CW5WNFLuUWOPaL0qsnkxvM_ZyfPYFwPktlphhjtmjBlPQWDQgcDMn8ksRSxyxWJZdRvpVi83YoS656ig-G0vX-QhT3wvNRWlH23vM4Yp5cFeJGTPmiftHOCGtSEFhpSvFd-VMisttqbtwPKKV7fqc5VKr-SDG_hOWq2Hu9O6pIaFyCUeyZekULzFQPTdmKxv8SYs8A7zaEXIYUmnD2udWWDTSME" />
          </div>
          <button className="md:hidden text-on-surface-variant p-1">
            <span className="material-symbols-outlined">menu</span>
          </button>
        </div>
      </nav>

      <main className="flex-grow pt-24 pb-xl px-md md:px-xl max-w-container-max mx-auto w-full relative">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_rgba(77,68,227,0.15)_0%,_rgba(10,10,10,0)_70%)] pointer-events-none" />
        
        {/* Hero Section */}
        <section className="flex flex-col items-center justify-center min-h-[70vh] text-center pt-xl relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container border border-outline-variant/30 mb-lg">
            <span className="h-2 w-2 rounded-full bg-tertiary-fixed-dim animate-ping"></span>
            <span className="font-label-caps text-label-caps text-on-surface-variant tracking-wider">v2.0 Beta Now Live</span>
          </div>
          <h1 className="font-display-lg text-display-lg text-on-surface max-w-4xl mb-md leading-tight">
            Turn your idea into a <br className="hidden md:block"/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">working product.</span>
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mb-xl text-lg">
            Describe your application in natural language and watch AI plan, build, and deploy it in seconds. Stop wrestling with boilerplate and start shipping.
          </p>
          
          <div className="w-full max-w-3xl glass-panel rounded-xl p-xs md:p-sm flex flex-col md:flex-row items-center gap-sm shadow-2xl relative group">
            <div className="absolute inset-0 rounded-xl border border-primary/20 pointer-events-none opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 group-focus-within:shadow-[0_0_0_2px_rgba(79,70,229,0.2)]"></div>
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">auto_awesome</span>
              <input className="w-full bg-[#0A0A0A] text-on-surface border border-surface-container-high rounded-lg py-lg pl-xl pr-md font-body-md focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-on-surface-variant/50" placeholder="Build a highly concurrent chat application with Go and Next.js..." type="text"/>
            </div>
            <Link href="/dashboard/create" className="w-full md:w-auto shrink-0">
              <Button className="w-full text-base h-full py-3 px-8 gap-2">
                Start Building
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Button>
            </Link>
          </div>
          <div className="mt-lg flex items-center gap-lg text-on-surface-variant/60 font-body-sm text-body-sm">
            <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> No credit card required</div>
            <div className="flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span> 14-day free trial</div>
          </div>
        </section>

        {/* Product Preview Abstract UI */}
        <section className="mt-xl relative mx-auto max-w-5xl rounded-xl border border-surface-container-high bg-[#161616] shadow-2xl overflow-hidden mb-32 h-[500px]">
          <div className="h-10 border-b border-surface-container-high bg-[#1c1b1b] flex items-center px-4 gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-surface-container-high"></div>
              <div className="w-3 h-3 rounded-full bg-surface-container-high"></div>
              <div className="w-3 h-3 rounded-full bg-surface-container-high"></div>
            </div>
            <div className="flex-grow flex justify-center">
              <div className="bg-[#0A0A0A] border border-surface-container-high rounded px-3 py-1 font-code-md text-code-md text-on-surface-variant text-[12px] flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">lock</span> my-awesome-app.abs.dev
              </div>
            </div>
          </div>
          <div className="flex h-[calc(100%-40px)]">
            <div className="w-64 border-r border-surface-container-high bg-[#161616] p-4 flex flex-col gap-2">
              <div className="h-6 w-3/4 bg-surface-container rounded mb-4"></div>
              <div className="h-8 w-full bg-surface-container-high rounded flex items-center px-2 border-l-2 border-primary">
                <span className="material-symbols-outlined text-[16px] text-primary mr-2">folder</span>
                <div className="h-2 w-1/2 bg-surface-variant rounded"></div>
              </div>
              <div className="h-8 w-full hover:bg-surface-container rounded flex items-center px-2 transition-colors">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-2">description</span>
                <div className="h-2 w-2/3 bg-surface-variant rounded"></div>
              </div>
              <div className="h-8 w-full hover:bg-surface-container rounded flex items-center px-2 transition-colors">
                <span className="material-symbols-outlined text-[16px] text-on-surface-variant mr-2">settings</span>
                <div className="h-2 w-1/3 bg-surface-variant rounded"></div>
              </div>
            </div>
            <div className="flex-grow bg-[#0A0A0A] relative p-6 overflow-hidden">
              <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
                <path d="M 100 150 C 200 150, 200 250, 300 250" fill="none" stroke="#404040" strokeWidth="2"></path>
                <path d="M 300 250 C 400 250, 450 100, 550 100" fill="none" stroke="#404040" strokeWidth="2"></path>
                <path d="M 300 250 C 400 250, 450 350, 550 350" fill="none" stroke="#404040" strokeWidth="2"></path>
              </svg>
              <div className="absolute top-[130px] left-[50px] w-40 bg-[#1C1C1C] border border-surface-container-high rounded-lg p-3 shadow-lg z-10 animate-bounce" style={{animationDuration: '4s'}}>
                <div className="font-label-caps text-label-caps text-on-surface mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">data_object</span> Database</div>
                <div className="h-1.5 w-full bg-surface-variant rounded mt-2"></div>
                <div className="h-1.5 w-4/5 bg-surface-variant rounded mt-1"></div>
              </div>
              <div className="absolute top-[230px] left-[260px] w-48 bg-[#1C1C1C] border-l-2 border-primary border-t border-r border-b border-surface-container-high rounded-lg p-3 shadow-lg z-10 animate-bounce" style={{animationDuration: '5s'}}>
                <div className="font-label-caps text-label-caps text-primary mb-2 flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">api</span> API Gateway</div>
                <div className="h-1.5 w-full bg-surface-variant rounded mt-2"></div>
                <div className="h-1.5 w-3/4 bg-surface-variant rounded mt-1"></div>
                <div className="h-1.5 w-5/6 bg-surface-variant rounded mt-1"></div>
              </div>
              <div className="absolute bottom-6 right-6 w-96 bg-[#161616]/90 backdrop-blur border border-surface-container-high rounded-lg overflow-hidden shadow-2xl z-20">
                <div className="bg-[#1c1b1b] px-3 py-1 border-b border-surface-container-high flex items-center justify-between">
                  <span className="font-code-md text-code-md text-[11px] text-on-surface-variant">Build Output</span>
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">close</span>
                </div>
                <div className="p-3 font-code-md text-code-md text-[12px] leading-relaxed">
                  <div className="text-tertiary">✓ Compiled successfully in 1204ms</div>
                  <div className="text-on-surface-variant mt-1">→ Deploying to staging edge network...</div>
                  <div className="text-on-surface mt-1">⠋ Provisioning resources</div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -inset-4 bg-gradient-to-tr from-primary/10 to-secondary/10 opacity-30 blur-2xl -z-10 rounded-2xl pointer-events-none"></div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-xl mb-32">
          <div className="text-center mb-xl">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Engineered for velocity.</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">Everything you need to go from idea to production in one integrated environment.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md max-w-5xl mx-auto">
            <div className="md:col-span-2 bg-[#161616] border border-surface-container-high rounded-xl p-lg flex flex-col justify-between hover:border-[#404040] transition-colors group">
              <div>
                <div className="h-10 w-10 rounded-lg bg-surface-container flex items-center justify-center mb-md border border-surface-container-high">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">AI App Generation</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant mb-lg">Define complex architectures in plain English. Our orchestration engine translates intent into production-ready repositories.</p>
              </div>
              <div className="h-32 bg-[#0A0A0A] rounded-lg border border-surface-container-high p-4 flex flex-col gap-2 relative overflow-hidden group-hover:border-primary/30 transition-colors">
                <div className="font-code-md text-code-md text-[12px] text-on-surface-variant">
                  <span className="text-secondary">const</span> <span className="text-primary">generateApp</span> = <span className="text-tertiary">async</span> (intent) ={">"} {"{"}<br/>
                  &nbsp;&nbsp;<span className="text-secondary">const</span> schema = <span className="text-tertiary">await</span> parse(intent);<br/>
                  &nbsp;&nbsp;<span className="text-secondary">return</span> buildEngine.execute(schema);<br/>
                  {"}"}
                </div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 blur-xl rounded-full translate-x-1/2 translate-y-1/2"></div>
              </div>
            </div>
            <div className="bg-[#161616] border border-surface-container-high rounded-xl p-lg flex flex-col justify-between hover:border-[#404040] transition-colors">
              <div>
                <div className="h-10 w-10 rounded-lg bg-surface-container flex items-center justify-center mb-md border border-surface-container-high">
                  <span className="material-symbols-outlined text-secondary">hub</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">Multi-Provider AI</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Switch seamlessly between OpenAI, Anthropic, and local models. Optimize for speed, cost, or reasoning capability per task.</p>
              </div>
            </div>
            <div className="bg-[#161616] border border-surface-container-high rounded-xl p-lg flex flex-col justify-between hover:border-[#404040] transition-colors">
              <div>
                <div className="h-10 w-10 rounded-lg bg-surface-container flex items-center justify-center mb-md border border-surface-container-high">
                  <span className="material-symbols-outlined text-tertiary">preview</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">Live Preview</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">See changes instantly. A synchronized headless browser environment renders your UI as the AI writes the code.</p>
              </div>
            </div>
            <div className="bg-[#161616] border border-surface-container-high rounded-xl p-lg flex flex-col justify-between hover:border-[#404040] transition-colors">
              <div>
                <div className="h-10 w-10 rounded-lg bg-surface-container flex items-center justify-center mb-md border border-surface-container-high">
                  <span className="material-symbols-outlined text-primary-fixed">code_blocks</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">AI Code Editing</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Context-aware inline editing. Highlight any block of code and prompt the AI to refactor, optimize, or document it.</p>
              </div>
            </div>
            <div className="bg-[#161616] border border-surface-container-high rounded-xl p-lg flex flex-col justify-between hover:border-[#404040] transition-colors">
              <div>
                <div className="h-10 w-10 rounded-lg bg-surface-container flex items-center justify-center mb-md border border-surface-container-high">
                  <span className="material-symbols-outlined text-outline">rocket_launch</span>
                </div>
                <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">One-Click Deploy</h3>
                <p className="font-body-sm text-body-sm text-on-surface-variant">Go live in seconds. Automated CI/CD pipelines push your containerized application to our global edge network.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section className="py-xl mb-32 border-t border-surface-container-high pt-32">
          <div className="text-center mb-xl">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-2">The deterministic workflow.</h2>
            <p className="font-body-md text-body-md text-on-surface-variant">A streamlined path from conception to production.</p>
          </div>
          <div className="relative max-w-4xl mx-auto">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-surface-container-high -translate-y-1/2 z-0"></div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-md relative z-10">
              <div className="flex flex-col items-center text-center bg-[#0A0A0A] p-2">
                <div className="w-12 h-12 rounded-full bg-[#161616] border border-surface-container-high flex items-center justify-center mb-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">01</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface text-[14px]">Idea</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">Provide intent</p>
              </div>
              <div className="flex flex-col items-center text-center bg-[#0A0A0A] p-2">
                <div className="w-12 h-12 rounded-full bg-[#161616] border border-surface-container-high flex items-center justify-center mb-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">02</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface text-[14px]">Plan</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">Arch review</p>
              </div>
              <div className="flex flex-col items-center text-center bg-[#0A0A0A] p-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-sm shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                  <span className="font-label-caps text-label-caps text-primary">03</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-primary text-[14px]">Build</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">AI generation</p>
              </div>
              <div className="flex flex-col items-center text-center bg-[#0A0A0A] p-2">
                <div className="w-12 h-12 rounded-full bg-[#161616] border border-surface-container-high flex items-center justify-center mb-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">04</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface text-[14px]">Test</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">Auto validation</p>
              </div>
              <div className="flex flex-col items-center text-center bg-[#0A0A0A] p-2">
                <div className="w-12 h-12 rounded-full bg-[#161616] border border-surface-container-high flex items-center justify-center mb-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                  <span className="font-label-caps text-label-caps text-on-surface-variant">05</span>
                </div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface text-[14px]">Deploy</h4>
                <p className="font-body-sm text-body-sm text-on-surface-variant text-[12px] mt-1">Live instantly</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-xl mb-xl text-center max-w-3xl mx-auto bg-[#161616] border border-surface-container-high rounded-2xl p-xl shadow-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>
          <h2 className="font-headline-md text-headline-md text-on-surface mb-sm relative z-10">Ready to build?</h2>
          <p className="font-body-md text-body-md text-on-surface-variant mb-lg relative z-10">Join thousands of developers shipping faster with ABS.</p>
          <Link href="/login">
            <Button className="relative z-10 text-base h-12 px-8">Start Building for Free</Button>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-xl px-lg flex flex-col md:flex-row justify-between items-center max-w-container-max mx-auto bg-surface-container-lowest border-t border-outline-variant/10 mt-auto">
        <div className="font-label-caps text-label-caps text-on-surface-variant mb-4 md:mb-0">
          AI Builder Studio &middot; Built by <a href="https://devloryx.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-on-surface hover:text-primary transition-colors">Devloryx</a>
        </div>
        <div className="flex items-center gap-md font-body-sm text-body-sm">
          <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#">Sitemap</a>
          <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#">Terms of Service</a>
          <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#">Privacy Policy</a>
          <a className="text-on-surface-variant hover:text-on-surface transition-colors" href="#">System Status</a>
        </div>
      </footer>
    </div>
  );
}
