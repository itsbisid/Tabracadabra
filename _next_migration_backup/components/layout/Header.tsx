"use client";

import React from "react";
import { Icon } from "@/components/Icon";

export default function Header() {
  return (
    <header className="header h-16 flex items-center justify-between px-8 bg-white border-b border-border sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light group-focus-within:text-primary transition-colors" />
          <input 
            type="text" 
            placeholder="Search teams, adjudicators, or motions..." 
            className="h-10 w-96 pl-10 pr-4 bg-gray-50 border border-transparent rounded-lg text-sm focus:bg-white focus:border-primary/20 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <button className="relative p-2 text-text-muted hover:text-primary transition-colors">
          <Icon name="bell" size={20} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-white"></span>
        </button>
        
        <div className="h-8 w-px bg-border"></div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-bold text-text">SDFG Tab Room</div>
            <div className="text-[11px] font-medium text-accent">Online</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/10 overflow-hidden">
            <img src="/logo.png" alt="logo" className="w-6 h-6 object-contain" />
          </div>
        </div>
      </div>
    </header>
  );
}
