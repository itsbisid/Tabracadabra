"use client";

import React, { useState, useEffect } from "react";
import { Icon } from "@/components/Icon";
import { generateRegistrationLink, getActiveLinks, deleteRegistrationLink } from "@/app/actions/registration";
import { useParams } from "next/navigation";

export default function RegistrationLinksPage() {
  const params = useParams();
  const id = params.id as string || "clw123456789"; // fallback for testing
  
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form State
  const [linkTitle, setLinkTitle] = useState("SDFG Registration");
  const [roles, setRoles] = useState(["Team", "Adjudicator"]);
  const [autoAccept, setAutoAccept] = useState(true);

  useEffect(() => {
    fetchLinks();
  }, [id]);

  const fetchLinks = async () => {
    setLoading(true);
    const res = await getActiveLinks(id);
    if (res.success) {
      setLinks(res.links || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    setCreating(true);
    const res = await generateRegistrationLink(id, roles, autoAccept);
    if (res.success) {
      alert(`Success! Registration link created.`);
      fetchLinks();
    } else {
      alert("Error: " + res.error);
    }
    setCreating(false);
  };

  const handleDelete = async (linkId: string) => {
    if (confirm("Delete this registration link?")) {
      const res = await deleteRegistrationLink(linkId, id);
      if (res.success) {
        fetchLinks();
      }
    }
  };

  const copyToClipboard = (token: string, e: any) => {
    const url = `${window.location.origin}/reg/${token}`;
    navigator.clipboard.writeText(url);
    const btn = e.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = "Copied!";
    setTimeout(() => {
      btn.innerHTML = originalText;
    }, 2000);
  };

  return (
    <div className="anim-fade-in pb-20">
      <div className="font-bold text-lg mb-1 text-text">Create registration link</div>
      <div className="text-sm text-text-muted mb-4">Public link to invite submissions. Tells us how active entries remain, they must go to review.</div>

      {/* Main Form Block */}
      <div className="bg-white border border-border rounded-xl p-6 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Registration from</label>
            <select className="w-full h-11 px-4 bg-gray-50 border border-border rounded-lg text-sm outline-none focus:border-primary/30 transition-all">
              <option>Debate participants (teams + adjudicators)</option>
              <option>Teams only</option>
              <option>Adjudicators only</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Link title</label>
            <input 
              type="text" 
              className="w-full h-11 px-4 bg-gray-50 border border-border rounded-lg text-sm outline-none focus:border-primary/30 transition-all" 
              value={linkTitle}
              onChange={(e) => setLinkTitle(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6">
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">Description</label>
          <textarea 
            className="w-full p-4 bg-gray-50 border border-border rounded-lg text-sm outline-none focus:border-primary/30 transition-all" 
            rows={3}
            placeholder="Help participants understand what this registration is for..."
          ></textarea>
        </div>

        <div className="mt-8 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input type="checkbox" checked={autoAccept} onChange={(e) => setAutoAccept(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" />
            <div>
              <div className="font-bold text-sm text-text group-hover:text-primary transition-colors">Auto-approve safe submissions</div>
              <div className="text-xs text-text-muted">Directly add participants to the tournament if no conflicts are detected.</div>
            </div>
          </label>
        </div>
      </div>

      {/* Submit Action */}
      <div className="flex justify-end items-center mb-10 pb-6 border-b border-border">
        <button 
          onClick={handleCreate}
          disabled={creating}
          className="bg-primary text-white px-6 py-3 rounded-lg font-bold text-sm flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          {creating ? <Icon name="activity" className="animate-spin" /> : <Icon name="plus" size={16} />}
          {creating ? "Creating..." : "Create registration link"}
        </button>
      </div>

      {/* Active Links */}
      <div className="font-bold text-lg mb-4 text-text flex items-center gap-2">
        Active links
        <span className="bg-gray-100 text-text-muted text-xs px-2 py-0.5 rounded-full">{links.length}</span>
      </div>

      {loading ? (
        <div className="bg-white border border-border rounded-xl p-12 flex flex-col items-center justify-center text-text-muted italic gap-3">
          <Icon name="activity" className="animate-spin" size={24} />
          Loading your enchanted links...
        </div>
      ) : links.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-300 mb-4">
            <Icon name="link" size={32} />
          </div>
          <div className="font-bold text-text mb-1">No active links found</div>
          <div className="text-sm text-text-muted max-w-xs">Create your first registration form to start accepting participants.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <div key={link.id} className="bg-white border border-border rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow group">
              <div>
                <div className="font-bold text-text mb-1 flex items-center gap-2">
                  {link.label}
                  {link.isPaused && <span className="bg-amber-100 text-amber-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded tracking-widest">Paused</span>}
                </div>
                <div className="text-xs text-text-muted mb-3 flex items-center gap-4">
                   <span className="flex items-center gap-1"><Icon name="users" size={12} /> {link.roles.join(" / ")}</span>
                   <span className="flex items-center gap-1"><Icon name="clock" size={12} /> Created {new Date(link.createdAt).toLocaleDateString()}</span>
                </div>
                <code className="text-[11px] bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg border border-blue-100 font-mono">/reg/{link.token}</code>
              </div>
              <div className="flex items-center gap-2 self-end md:self-center">
                <button 
                  onClick={(e) => copyToClipboard(link.token, e)}
                  className="p-2.5 rounded-lg border border-border hover:bg-gray-50 text-text-muted hover:text-primary transition-all shadow-sm" title="Copy URL">
                  <Icon name="copy" size={16} />
                </button>
                <button className="p-2.5 rounded-lg border border-border hover:bg-gray-50 text-text-muted hover:text-primary transition-all shadow-sm" title="Edit">
                  <Icon name="edit" size={16} />
                </button>
                <button 
                  onClick={() => handleDelete(link.id)}
                  className="p-2.5 rounded-lg border border-border hover:bg-red-50 text-text-muted hover:text-red-600 transition-all shadow-sm" title="Delete">
                  <Icon name="trash" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
