"use client";

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  activePath: string;
}

export default function Sidebar({ activePath }: SidebarProps) {
  const isTournament = activePath.startsWith("/tournament");

  const mainNav = [
    { name: "My Journey", icon: "activity", path: "/my-journey" },
    { name: "My Tournaments", icon: "layers", path: "/my-tournaments" },
    { name: "Browse", icon: "search", path: "/tournaments" },
    { name: "Profile", icon: "users", path: "/profile" },
  ];

  const tournamentNav = [
    { section: "Core", items: [
      { name: "Dashboard", icon: "activity", path: "/tournament/dashboard" },
      { name: "Announcements", icon: "megaphone", path: "/tournament/announcements" },
      { name: "Chat", icon: "messageCircle", path: "/tournament/chat" },
    ]},
    { section: "Organization", items: [
      { name: "Teams", icon: "users", path: "/tournament/teams" },
      { name: "Adjudicators", icon: "gavel", path: "/tournament/adjudicators" },
      { name: "Venues", icon: "mapPin", path: "/tournament/venues" },
    ]},
    { section: "Tabulation", items: [
      { name: "Motions", icon: "fileText", path: "/tournament/motions" },
      { name: "Debate Rounds", icon: "layers", path: "/tournament/debate-rounds" },
      { name: "Team Break", icon: "award", path: "/tournament/team-break" },
    ]},
    { section: "Insights", items: [
      { name: "Analytics", icon: "barChart2", path: "/tournament/analytics" },
      { name: "Feedback", icon: "messageSquare", path: "/tournament/feedback" },
    ]},
    { section: "Finalize", items: [
      { name: "Registration", icon: "link", path: "/tournament/registration-links" },
      { name: "Publish & Live", icon: "share", path: "/tournament/publish" },
    ]}
  ];

  return (
    <aside className="sidebar flex flex-col h-full bg-white border-r border-border overflow-y-auto">
      <div className="sidebar__brand p-6 border-b border-border mb-6">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="sidebar__logo-container relative">
            <img src="/logo.png" alt="tabracadabra logo" className="h-8 w-auto" />
          </div>
          <span className="text-xl font-extrabold tracking-tight text-primary">TabraCadabra</span>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-8">
        {!isTournament ? (
          <div className="sidebar__group">
            <div className="sidebar__group-title px-3 py-2 text-xs font-bold uppercase tracking-wider text-text-light/60">Main Menu</div>
            <div className="space-y-1">
              {mainNav.map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg font-medium transition-colors duration-200",
                    activePath === item.path 
                      ? "bg-primary text-white" 
                      : "text-text-muted hover:bg-gray-50 hover:text-primary"
                  )}
                >
                  <Icon name={item.icon as any} size={20} />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : (
          tournamentNav.map((section) => (
            <div key={section.section} className="sidebar__group border-b border-gray-100 last:border-0 pb-6 mb-6 last:pb-0 last:mb-0">
              <div className="px-3 mb-2 text-xs font-bold uppercase tracking-widest text-[#94a3b8]">{section.section}</div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg font-medium transition-all duration-200",
                      activePath === item.path
                        ? "bg-[#0044b3] text-white shadow-md shadow-blue-100"
                        : "text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0044b3]"
                    )}
                  >
                    <Icon name={item.icon as any} size={18} />
                    <span className="text-[13px]">{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
      
      <div className="p-4 mt-auto">
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
           <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">JD</div>
              <div>
                 <div className="text-sm font-bold text-slate-800">John Doe</div>
                 <div className="text-[11px] text-slate-500">Tournament Director</div>
              </div>
           </div>
           <button className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-white hover:shadow-sm rounded-lg transition-all">Sign Out</button>
        </div>
      </div>
    </aside>
  );
}
