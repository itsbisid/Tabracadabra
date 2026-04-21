"use client";

import React from "react";
import { Icon } from "@/components/Icon";
import { useParams } from "next/navigation";

export default function TournamentDashboardPage() {
  const params = useParams();
  const id = params.id;

  return (
    <div className="anim-fade-in">
      {/* Top Progress Box */}
      <div className="bg-white border border-border rounded-xl p-8 mb-8 shadow-sm">
        <div className="font-bold text-xs text-text-muted uppercase tracking-widest mb-6">
          Tournament Progress
        </div>
        
        <div className="flex items-center w-full">
          {/* Setup (Active) */}
          <div className="flex items-center gap-3">
            <div className="text-primary"><Icon name="clock" size={20} /></div>
            <div className="font-bold text-sm text-text">Setup</div>
          </div>
          <div className="flex-1 h-px bg-border mx-6"></div>
          
          {/* Participants */}
          <div className="flex items-center gap-3 opacity-40">
            <div className="w-4 h-4 rounded-full border-2 border-border-strong"></div>
            <div className="font-bold text-sm text-text-muted">Participants</div>
          </div>
          <div className="flex-1 h-px bg-border mx-6"></div>

          {/* Prelims */}
          <div className="flex items-center gap-3 opacity-40">
            <div className="w-4 h-4 rounded-full border-2 border-border-strong"></div>
            <div className="font-bold text-sm text-text-muted">Prelims</div>
          </div>
          <div className="flex-1 h-px bg-border mx-6"></div>

          {/* Break */}
          <div className="flex items-center gap-3 opacity-40">
            <div className="w-4 h-4 rounded-full border-2 border-border-strong"></div>
            <div className="font-bold text-sm text-text-muted">Break</div>
          </div>
          <div className="flex-1 h-px bg-border mx-6"></div>

          {/* Complete */}
          <div className="flex items-center gap-3 opacity-40">
            <div className="w-4 h-4 rounded-full border-2 border-border-strong"></div>
            <div className="font-bold text-sm text-text-muted">Complete</div>
          </div>
        </div>
      </div>

      {/* 3 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: "Teams", value: "0", icon: "users" as const, color: "text-blue-500", bg: "bg-blue-50" },
          { label: "Adjudicators", value: "0", icon: "gavel" as const, color: "text-emerald-500", bg: "bg-emerald-50" },
          { label: "Venues", value: "0", icon: "mapPin" as const, color: "text-amber-500", bg: "bg-amber-50" },
        ].map((stat) => (
          <div key={stat.label} className="bg-white border border-border rounded-xl p-6 flex flex-col justify-between h-32 shadow-sm">
            <div className="flex justify-between items-start">
              <div className="text-sm font-bold text-text-muted">{stat.label}</div>
              <div className={`${stat.color} ${stat.bg} p-2 rounded-lg`}>
                <Icon name={stat.icon} size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-text">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Placeholder for Tabs */}
      <div className="bg-white border border-border rounded-xl p-12 text-center shadow-sm">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-300 mx-auto mb-6">
            <Icon name="activity" size={40} />
          </div>
          <h2 className="text-xl font-bold text-text mb-2">Welcome to the Tab Room</h2>
          <p className="text-text-muted max-w-md mx-auto mb-8 text-sm">
            Please start by adding your teams and adjudicators or using a registration link to invite participants.
          </p>
          <div className="flex justify-center gap-4">
             <button className="bg-primary text-white px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90">Setup Rounds</button>
             <button className="bg-white border border-border px-6 py-2.5 rounded-lg font-bold text-sm hover:bg-gray-50">Manage Participants</button>
          </div>
      </div>
    </div>
  );
}
