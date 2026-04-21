"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";

export default function QuickBot() {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const toggle = () => setIsOpen(!isOpen);

  const navigate = (path: string) => {
    router.push(path);
    setIsOpen(false);
  };

  return (
    <>
      {/* Universal Floating Action Button */}
      <div 
        id="global-quickbot-trigger" 
        style={{
          position: "fixed",
          bottom: "32px",
          right: "32px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "#0044b3",
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          cursor: "pointer",
          transition: "transform 0.2s",
          zIndex: 9000,
        }} 
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "none")}
        onClick={toggle}
      >
        <Icon name="zap" size={24} />
      </div>

      {/* Global QuickBot Overlay */}
      {isOpen && (
        <div id="quickbot-overlay" style={{
          position: "fixed",
          right: "32px",
          bottom: "100px",
          width: "340px",
          background: "white",
          borderRadius: "12px",
          boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          zIndex: 9999,
        }}>
          <div style={{ background: "#0044b3", padding: "20px", color: "white", display: "flex", alignItems: "center", justifyBetween: "space-between", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="zap" size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "16px", marginBottom: "2px" }}>QuickBot</div>
                <div style={{ fontSize: "12px", opacity: 0.8 }}>SDFG</div>
              </div>
            </div>
            <button onClick={toggle} style={{ background: "none", border: "none", color: "white", cursor: "pointer", opacity: 0.8, position: "absolute", right: "20px" }}>
              <Icon name="x" size={18} />
            </button>
            
            <div style={{ position: "absolute", bottom: "-12px", left: "20px", background: "white", color: "#0044b3", fontSize: "11px", fontWeight: 700, padding: "2px 10px", borderRadius: "12px", border: "1px solid #0044b3" }}>
              Tab Director
            </div>
          </div>
          
          <div style={{ padding: "24px 16px 16px 16px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Round Status */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", display: "flex", gap: "12px", alignItems: "center" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                <Icon name="activity" size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>Round 2 Status</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>0/0 ballots - draft</div>
              </div>
            </div>

            {/* Post Announcement */}
            <div onClick={() => navigate("/tournament/announcements")} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", display: "flex", gap: "12px", alignItems: "center", cursor: "pointer" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                <Icon name="megaphone" size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>Post Announcement</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Send a message to all participants</div>
              </div>
            </div>

            {/* Manage Rounds */}
            <div onClick={() => navigate("/tournament/debate-rounds")} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", display: "flex", gap: "12px", alignItems: "center", cursor: "pointer" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                <Icon name="layers" size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>Manage Rounds</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Create, draw, allocate, and complete rounds</div>
              </div>
            </div>

            {/* Tournament Chat */}
            <div onClick={() => navigate("/tournament/chat")} style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", display: "flex", gap: "12px", alignItems: "center", cursor: "pointer" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                <Icon name="messageCircle" size={20} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>Tournament Chat</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>Open the chat room</div>
              </div>
            </div>
          </div>
          
          <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", fontSize: "11px", textAlign: "center", color: "#64748b" }}>
            Refreshes automatically · Powered by Xtension
          </div>
        </div>
      )}
    </>
  );
}
