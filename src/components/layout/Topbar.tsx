import * as React from "react";
import { Button } from "../ui/Button";

export function Topbar() {
  return (
    <nav className="md:hidden fixed top-0 w-full z-50 flex justify-between items-center px-lg py-md bg-surface/80 backdrop-blur-md border-b border-outline-variant/20">
      <div className="font-headline-md text-headline-md font-bold text-on-surface">ABS</div>
      <Button size="sm">Start Building</Button>
    </nav>
  );
}
