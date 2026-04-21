"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import QuickBot from "./QuickBot";
import { usePathname } from "next/navigation";

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Logic to determine if we are in a tournament context or main app context
  const isTournamentPath = pathname.startsWith("/tournament");
  const isAuthPath = pathname === "/login" || pathname === "/signup" || pathname === "/";

  if (isAuthPath) {
    return <div className="min-h-screen bg-bg">{children}</div>;
  }

  return (
    <div className="layout-app anim-fade-in h-screen flex">
      <div className="layout-app__sidebar w-[280px] flex-shrink-0">
        <Sidebar activePath={pathname} />
      </div>
      <main className="layout-app__main flex-1 overflow-y-auto flex flex-col" id="app-main">
        <Header />
        <div className="layout-app__content relative flex-1 p-8">
          {children}
        </div>
      </main>
      <QuickBot />
    </div>
  );
}
