import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function LandingPage() {
  return (
    <div className="landing-page bg-bg">
      {/* Navigation */}
      <nav className="h-20 flex items-center justify-between px-12 bg-white border-b border-border sticky top-0 z-[100]">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="h-8 w-auto" />
          <span className="text-xl font-extrabold tracking-tight text-primary">TabraCadabra</span>
        </div>
        <div className="flex items-center gap-8 font-semibold text-sm text-text-muted">
          <Link href="#features" className="hover:text-primary transition-colors">Features</Link>
          <Link href="/tournaments" className="hover:text-primary transition-colors">Browse</Link>
          <Link href="/login" className="px-6 py-2 border border-border rounded-lg hover:bg-gray-50 transition-all">Login</Link>
          <Link href="/signup" className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 shadow-lg shadow-primary/20 transition-all">Join the Magic</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-32 px-12 text-center">
        <h1 className="text-6xl font-extrabold text-primary mb-6 tracking-tight">
          Tabulation as <span className="text-accent underline decoration-4 underline-offset-8">Magical</span> as Speech.
        </h1>
        <p className="text-xl text-text-muted mb-12 max-w-2xl mx-auto leading-relaxed">
          The high-performance, enchanted alternative to legacy debate software. Designed for directors who demand precision and style.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/signup" className="px-10 py-5 bg-primary text-white rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-xl shadow-primary/20">Create a Tournament</Link>
          <Link href="/dashboard" className="px-10 py-5 bg-white border border-border rounded-xl font-bold text-lg hover:bg-gray-50 transition-all">Go to My Journey</Link>
        </div>
      </section>
    </div>
  );
}
