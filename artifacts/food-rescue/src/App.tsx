import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from "wouter";
import {
  Activity as ActivityIcon, ArrowRight, Bell, Check, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, Leaf, LogOut, MapPin, Menu, Package, Plus, Search, ShieldCheck,
  Sparkles, Store, Truck, Users, X, XCircle, BarChart3, Utensils, HandHeart
} from "lucide-react";
import {
  DonationStatusInputStatus, DonationUpdateStatus,
  getGetCurrentUserQueryKey, getGetDashboardSummaryQueryKey, getGetDonationQueryKey,
   getListDonationsQueryKey, getListNotificationsQueryKey,
   useClaimDonation, useCreateDonation, useGetCurrentUser,
  useGetDashboardSummary, useGetDonation, useGetRecentActivity, useHealthCheck,
  useListDonations, useListNearbyOrganizations, useListNotifications, useMarkNotificationRead,
  useUpdateDonation, useUpdateDonationStatus
} from "@workspace/api-client-react";
import type { Donation } from "@workspace/api-client-react";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY.");
}

function stripBase(path: string) {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const navItems = [
  { href: "/dashboard", label: "Mission desk", icon: ActivityIcon },
  { href: "/donations", label: "Donations", icon: Package },
  { href: "/impact", label: "Impact", icon: Leaf },
  { href: "/organizations", label: "Organizations", icon: Users },
  { href: "/notifications", label: "Notifications", icon: Bell },
];

const statusLabel: Record<string, string> = {
  AVAILABLE: "Available", CLAIMED: "Claimed", PICKUP_PENDING: "Pickup pending",
  PICKED_UP: "Picked up", DELIVERED: "Delivered", COMPLETED: "Completed",
  EXPIRED: "Expired", CANCELLED: "Cancelled",
};

const formatDate = (value?: string) => value ? new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value)) : "—";
const relativeTime = (value?: string) => {
  if (!value) return "Recently";
  const mins = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  if (mins < 1440) return `${Math.round(mins / 60)} hours ago`;
  return `${Math.round(mins / 1440)} days ago`;
};

function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`flex items-center gap-3 ${light ? "text-[hsl(var(--sidebar-foreground))]" : "text-[hsl(var(--foreground))]"}`} data-testid="link-logo">
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))] shadow-sm"><Leaf size={19} strokeWidth={2.7} /></span>
    <span className="font-display text-xl font-bold tracking-[-.03em]">food<span className="text-[hsl(var(--accent))]">rescue</span></span>
  </Link>;
}

function Button({ children, onClick, href, variant = "primary", disabled = false, className = "", testId }: {
  children: ReactNode; onClick?: () => void; href?: string; variant?: "primary" | "secondary" | "ghost" | "danger"; disabled?: boolean; className?: string; testId?: string;
}) {
  const styles = {
    primary: "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:brightness-110 shadow-[0_8px_18px_-10px_hsl(var(--primary))]",
    secondary: "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--accent))]",
    ghost: "bg-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
    danger: "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:brightness-110",
  };
  const cn = `inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all duration-200 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`;
  return href ? <Link href={href} className={cn} data-testid={testId}>{children}</Link> : <button onClick={onClick} disabled={disabled} className={cn} data-testid={testId}>{children}</button>;
}

function StatusBadge({ status, urgent = false }: { status: string; urgent?: boolean }) {
  const tone = urgent ? "bg-[hsl(8_70%_94%)] text-[hsl(8_70%_40%)]" : status === "AVAILABLE" ? "bg-[hsl(43_84%_87%)] text-[hsl(163_37%_24%)]" : status === "COMPLETED" || status === "DELIVERED" ? "bg-[hsl(158_43%_87%)] text-[hsl(163_37%_24%)]" : status === "CANCELLED" || status === "EXPIRED" ? "bg-[hsl(39_18%_88%)] text-[hsl(163_11%_42%)]" : "bg-[hsl(190_38%_88%)] text-[hsl(190_38%_28%)]";
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.08em] ${tone}`} data-testid={`status-${status.toLowerCase()}`}>{urgent && <CircleAlert size={12} />}{urgent ? "Urgent" : statusLabel[status] || status}</span>;
}

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const { signOut } = useClerk();
  const { data: user } = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey() } });
  const currentUser = user;
  const handleSignOut = () => {
    localStorage.removeItem("foodrescue_role");
    void signOut({ redirectUrl: basePath || "/" });
  };
  return <div className="texture min-h-[100dvh] bg-[hsl(var(--background))]">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[250px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="mb-9 flex items-center justify-between px-2"><Logo light /><button className="lg:hidden" onClick={() => setOpen(false)} data-testid="button-close-menu"><X size={20} /></button></div>
      <div className="mb-4 px-3 text-[10px] font-bold uppercase tracking-[.2em] text-[hsl(var(--sidebar-foreground)/.48)]">Workspace</div>
      <nav className="space-y-1">
        {navItems.map(item => { const Icon = item.icon; const active = location === item.href || (item.href === "/donations" && location.startsWith("/donations/")); return <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors ${active ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--accent))]" : "text-[hsl(var(--sidebar-foreground)/.68)] hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"}`} data-testid={`link-nav-${item.label.toLowerCase().replaceAll(" ", "-")}`}><Icon size={18} /><span>{item.label}</span>{item.label === "Notifications" && <UnreadDot />}</Link>; })}
      </nav>
      <div className="mt-auto rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))] p-4">
        <div className="mb-3 flex items-center gap-2 text-[hsl(var(--accent))]"><ShieldCheck size={16} /><span className="text-[11px] font-bold uppercase tracking-[.12em]">Trusted network</span></div>
        <p className="text-xs leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">Every rescue is verified, time-bound, and visible from post to handover.</p>
      </div>
      <div className="mt-4 flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-2 pt-4">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(var(--accent))] text-xs font-black text-[hsl(var(--sidebar))]">{(currentUser?.name || "FR").split(" ").map(x => x[0]).join("").slice(0, 2)}</div>
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{currentUser?.name || "Demo operator"}</p><p className="truncate text-[11px] text-[hsl(var(--sidebar-foreground)/.55)]">{currentUser?.organizationName || "FoodRescue workspace"}</p></div>
         <button onClick={handleSignOut} className="text-[hsl(var(--sidebar-foreground)/.52)] hover:text-[hsl(var(--accent))]" data-testid="button-sign-out"><LogOut size={16} /></button>
      </div>
    </aside>
    {open && <button className="fixed inset-0 z-30 bg-[hsl(var(--sidebar)/.35)] lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu" data-testid="button-dismiss-menu" />}
    <main className="min-h-[100dvh] lg:pl-[250px]">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[hsl(var(--border)/.7)] bg-[hsl(var(--background)/.88)] px-5 backdrop-blur-md sm:px-8">
        <button className="rounded-lg p-2 lg:hidden" onClick={() => setOpen(true)} data-testid="button-open-menu"><Menu size={21} /></button>
        <div className="hidden text-xs font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))] lg:block">Local recovery network <span className="mx-2 text-[hsl(var(--accent))]">/</span> {currentUser?.location?.address || "Portland, Oregon"}</div>
        <div className="ml-auto flex items-center gap-3"><Link href="/notifications" className="relative rounded-xl p-2.5 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" data-testid="link-header-notifications"><Bell size={19} /><UnreadDot /></Link><span className="hidden h-7 w-px bg-[hsl(var(--border))] sm:block" /><span className="hidden text-right sm:block"><span className="block text-xs font-bold">{currentUser?.role === "organization" ? "Recovery partner" : currentUser?.role === "admin" ? "Network admin" : "Restaurant operator"}</span><span className="block text-[11px] text-[hsl(var(--muted-foreground))]">{currentUser?.isVerified ? "Verified workspace" : "Demo workspace"}</span></span></div>
      </header>
      <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 sm:py-9">{children}</div>
    </main>
  </div>;
}

function UnreadDot() { return <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[hsl(var(--accent))] ring-2 ring-[hsl(var(--sidebar))]" />; }

function PublicNav() {
  return <header className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-6 lg:px-12"><Logo /><div className="hidden items-center gap-7 text-sm font-bold text-[hsl(var(--foreground)/.7)] md:flex"><a href="#how-it-works" className="hover:text-[hsl(var(--primary))]">How it works</a><a href="#network" className="hover:text-[hsl(var(--primary))]">The network</a><Link href="/sign-in" className="text-[hsl(var(--primary))]" data-testid="link-public-sign-in">Sign in <ArrowRight className="ml-1 inline" size={15} /></Link></div><Link href="/sign-up" className="rounded-xl bg-[hsl(var(--primary))] px-4 py-2.5 text-sm font-bold text-[hsl(var(--primary-foreground))] md:hidden" data-testid="link-public-mobile-sign-in">Join FoodRescue</Link></header>;
}

function Landing() {
  useHealthCheck({ query: { queryKey: ["/api/healthz"], staleTime: 60000 } });
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
    <PublicNav />
    <section className="relative overflow-hidden px-6 pb-20 pt-36 lg:px-12 lg:pb-28 lg:pt-44">
      <div className="pointer-events-none absolute -right-32 top-24 h-[540px] w-[540px] rounded-full bg-[hsl(var(--accent)/.18)] blur-3xl" /><div className="pointer-events-none absolute -left-40 top-[35%] h-[420px] w-[420px] rounded-full bg-[hsl(190_38%_48%/.10)] blur-3xl" />
      <div className="mx-auto grid max-w-[1280px] items-end gap-14 lg:grid-cols-[1.12fr_.88fr]">
        <div className="page-enter"><p className="mb-6 flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[hsl(var(--primary))]"><span className="h-2 w-2 rounded-full bg-[hsl(var(--accent))]" /> Food recovery, made visible</p><h1 className="max-w-3xl font-display text-6xl leading-[.95] tracking-[-.055em] sm:text-8xl">Good food deserves a <em className="text-[hsl(var(--primary))]">second table.</em></h1><p className="mt-8 max-w-xl text-lg leading-relaxed text-[hsl(var(--muted-foreground))]">FoodRescue gives end-of-service surplus a clear next step — from trusted restaurant to nearby organization, before the clock runs out.</p><div className="mt-9 flex flex-wrap gap-3"><Button href="/sign-up" testId="button-start-rescuing">Start rescuing <ArrowRight size={16} /></Button><a href="#how-it-works" className="inline-flex items-center gap-2 rounded-xl border border-[hsl(var(--border))] px-4 py-2.5 text-sm font-bold hover:bg-[hsl(var(--card))]" data-testid="link-learn-more">See how it works <ChevronRight size={16} /></a></div></div>
        <div className="relative page-enter [animation-delay:120ms]"><div className="relative rounded-[2rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_30px_80px_-42px_hsl(var(--primary))] sm:p-7"><div className="absolute -right-5 -top-5 grid h-16 w-16 place-items-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))] shadow-xl"><Sparkles size={25} /></div><div className="mb-5 flex items-center justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Live handover board</p><p className="mt-1 font-display text-2xl font-bold">Tonight's rescue</p></div><span className="flex items-center gap-1.5 text-xs font-bold text-[hsl(var(--primary))]"><span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--primary))]" /> Live</span></div><div className="rounded-2xl bg-[hsl(var(--secondary))] p-4"><div className="flex items-start justify-between"><div><p className="font-display text-2xl font-bold">Herb roasted vegetables</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Northline Kitchen · 4.2 km away</p></div><StatusBadge status="AVAILABLE" urgent /></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-[hsl(var(--border)/.7)] pt-4 text-xs"><span><b className="block text-base text-[hsl(var(--foreground))]">42</b>servings</span><span><b className="block text-base text-[hsl(var(--foreground))]">7:15 pm</b>pickup by</span><span><b className="block text-base text-[hsl(var(--foreground))]">VEG</b>food type</span></div></div><div className="mt-4 flex items-center gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[hsl(190_38%_88%)] text-[hsl(190_38%_28%)]"><HandHeart size={17} /></div><div><p className="text-sm font-bold">Bridgeway Pantry is on it</p><p className="text-[11px] text-[hsl(var(--muted-foreground))]">Claimed 3 minutes ago</p></div><CheckCircle2 className="ml-auto text-[hsl(var(--primary))]" size={18} /></div></div></div>
      </div>
    </section>
    <section id="how-it-works" className="border-y border-[hsl(var(--border))] bg-[hsl(var(--card)/.6)] px-6 py-20 lg:px-12"><div className="mx-auto max-w-[1280px]"><div className="grid gap-12 lg:grid-cols-[.7fr_1.3fr]"><div><p className="font-mono-ui text-xs uppercase tracking-[.18em] text-[hsl(var(--primary))]">A calmer close</p><h2 className="mt-3 max-w-sm font-display text-4xl leading-tight tracking-[-.04em]">Less scramble.<br />More certainty.</h2></div><div className="grid gap-8 sm:grid-cols-3">{[["01","Post the surplus","Add what is ready, how much, and the real pickup window."],["02","Match with trust","Verified organizations see what fits their route and capacity."],["03","Close the loop","Track each handover and see the weight of what you kept in use."]].map(([num,title,body]) => <div key={num} className="border-t-2 border-[hsl(var(--accent))] pt-4"><span className="font-mono-ui text-xs text-[hsl(var(--muted-foreground))]">{num}</span><h3 className="mt-10 font-display text-2xl font-bold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p></div>)}</div></div></div></section>
    <section id="network" className="px-6 py-20 lg:px-12"><div className="mx-auto max-w-[1280px] rounded-[2rem] bg-[hsl(var(--sidebar))] px-7 py-10 text-[hsl(var(--sidebar-foreground))] sm:px-12 sm:py-14"><div className="grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="font-mono-ui text-xs uppercase tracking-[.18em] text-[hsl(var(--accent))]">Built for the block</p><h2 className="mt-3 max-w-2xl font-display text-4xl leading-tight tracking-[-.04em] sm:text-5xl">A shared view of what your neighborhood can save.</h2></div><Button href="/sign-up" variant="secondary" testId="button-join-network">Join the network <ArrowRight size={16} /></Button></div><div className="mt-14 grid gap-8 border-t border-[hsl(var(--sidebar-border))] pt-8 sm:grid-cols-3"><div><p className="font-display text-4xl font-bold text-[hsl(var(--accent))]">47.2t</p><p className="mt-2 text-sm text-[hsl(var(--sidebar-foreground)/.65)]">food redirected through active hubs</p></div><div><p className="font-display text-4xl font-bold text-[hsl(var(--accent))]">18,640</p><p className="mt-2 text-sm text-[hsl(var(--sidebar-foreground)/.65)]">meals served by local partners</p></div><div><p className="font-display text-4xl font-bold text-[hsl(var(--accent))]">91%</p><p className="mt-2 text-sm text-[hsl(var(--sidebar-foreground)/.65)]">of posted food finds a next table</p></div></div></div></section>
    <footer className="flex flex-col gap-3 border-t border-[hsl(var(--border))] px-6 py-7 text-xs text-[hsl(var(--muted-foreground))] sm:flex-row sm:items-center sm:justify-between lg:px-12"><Logo /><span>Make the next meal count.</span></footer>
  </div>;
}

function Login() {
  return <Redirect to="/sign-in" />;
}

function AuthLoading() {
  return <div className="grid min-h-[100dvh] place-items-center bg-[hsl(var(--background))]"><div className="text-center"><span className="mx-auto grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))]"><Leaf size={22} /></span><p className="mt-4 text-sm font-bold text-[hsl(var(--muted-foreground))]">Loading your workspace…</p></div></div>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Landing />;
  return <Redirect to={localStorage.getItem("foodrescue_role") ? "/dashboard" : "/onboarding"} />;
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function Onboarding() {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [role, setRole] = useState<"restaurant" | "organization">("restaurant");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saveRole = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/auth/role", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!response.ok) throw new Error("Could not save workspace role.");
      localStorage.setItem("foodrescue_role", role);
      await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
      setLocation("/dashboard");
    } catch {
      setError("We couldn't save that workspace choice. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="min-h-[100dvh] bg-[hsl(var(--sidebar))] px-5 py-6 text-[hsl(var(--sidebar-foreground))]"><div className="mx-auto flex max-w-[1180px] items-center justify-between"><Logo light /><button onClick={() => void signOut({ redirectUrl: basePath || "/" })} className="text-sm font-bold text-[hsl(var(--sidebar-foreground)/.62)] hover:text-[hsl(var(--accent))]">Sign out</button></div><div className="mx-auto grid max-w-[1000px] items-center gap-14 py-16 lg:py-24 lg:grid-cols-[1fr_420px]"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[hsl(var(--accent))]"><ShieldCheck size={15} /> One last step</p><h1 className="mt-6 max-w-lg font-display text-6xl leading-[.92] tracking-[-.05em]">Welcome{user?.firstName ? `, ${user.firstName}` : ""}.</h1><p className="mt-6 max-w-md text-[hsl(var(--sidebar-foreground)/.62)]">Choose the workspace that matches how you help move good food to a second table.</p></div><div className="rounded-[1.7rem] bg-[hsl(var(--card))] p-6 text-[hsl(var(--foreground))] shadow-2xl sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Your workspace</p><div className="mt-5 grid gap-3">{(["restaurant", "organization"] as const).map(item => <button key={item} onClick={() => setRole(item)} className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${role === item ? "border-[hsl(var(--accent))] bg-[hsl(var(--secondary))]" : "border-[hsl(var(--border))]"}`}><span className="grid h-10 w-10 place-items-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))]">{item === "restaurant" ? <Store size={18} /> : <HandHeart size={18} />}</span><span><span className="block text-sm font-bold">{item === "restaurant" ? "Restaurant operator" : "Recovery organization"}</span><span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{item === "restaurant" ? "Post and track surplus food." : "Claim food and coordinate pickups."}</span></span></button>)}</div><Button onClick={saveRole} disabled={saving} className="mt-5 w-full">{saving ? "Saving workspace…" : "Continue to workspace"} <ArrowRight size={16} /></Button>{error && <p className="mt-3 text-center text-xs text-[hsl(var(--destructive))]">{error}</p>}</div></div></div>;
}

function PageTitle({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="font-mono-ui text-[10px] font-medium uppercase tracking-[.2em] text-[hsl(var(--primary))]">{eyebrow}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-.045em] sm:text-5xl" data-testid="text-page-title">{title}</h1>{description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{description}</p>}</div>{action}</div>;
}

function StatCard({ label, value, detail, icon: Icon, accent = false }: { label: string; value: string | number; detail: string; icon: typeof Leaf; accent?: boolean }) {
  return <div className={`rounded-2xl border border-[hsl(var(--border))] p-5 ${accent ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--card))]"}`}><div className="flex items-start justify-between"><span className={`grid h-9 w-9 place-items-center rounded-xl ${accent ? "bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))]" : "bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"}`}><Icon size={18} /></span><span className={`font-mono-ui text-[10px] ${accent ? "text-[hsl(var(--primary-foreground)/.65)]" : "text-[hsl(var(--muted-foreground))]"}`}>{detail}</span></div><p className="mt-5 font-display text-3xl font-bold tracking-[-.04em]" data-testid={`stat-${label.toLowerCase().replaceAll(" ", "-")}`}>{value}</p><p className={`mt-1 text-xs font-bold ${accent ? "text-[hsl(var(--primary-foreground)/.65)]" : "text-[hsl(var(--muted-foreground))]"}`}>{label}</p></div>;
}

function Skeleton({ className = "" }: { className?: string }) { return <div className={`skeleton rounded-xl ${className}`} />; }

function Dashboard() {
  const { data: user } = useGetCurrentUser();
  const summary = useGetDashboardSummary();
  const activity = useGetRecentActivity();
  const donations = useListDonations();
  const role = user?.role || JSON.parse(localStorage.getItem("foodrescue_user") || "{}").role || "restaurant";
  const upcoming = (donations.data || []).filter(d => ["AVAILABLE", "CLAIMED", "PICKUP_PENDING"].includes(d.status)).slice(0, 4);
  return <AppShell><div className="page-enter"><PageTitle eyebrow={role === "organization" ? "Recovery partner desk" : "Restaurant operations"} title={role === "organization" ? "Ready for the next pickup?" : "Good evening, Northline."} description={role === "organization" ? "See what is available nearby and keep your route full of useful food." : "Your end-of-service view. One place to post, track, and close each rescue."} action={role === "restaurant" ? <Button href="/donations/new" testId="button-post-donation"><Plus size={17} /> Post surplus</Button> : <Button href="/donations" variant="secondary" testId="button-browse-donations"><Search size={17} /> Browse nearby</Button>} /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 stagger">{summary.isLoading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-36" />) : <><StatCard label="Active donations" value={summary.data?.activeDonations ?? "—"} detail="right now" icon={Package} accent /><StatCard label="Food rescued" value={summary.data ? `${summary.data.foodRescuedKg} kg` : "—"} detail="all time" icon={Leaf} /><StatCard label="Meals served" value={summary.data?.mealsServed ?? "—"} detail="this network" icon={Utensils} /><StatCard label="Completion rate" value={summary.data ? `${summary.data.completionRate}%` : "—"} detail="last 30 days" icon={CheckCircle2} /></>}</div><div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_.7fr]"><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">In motion</p><h2 className="mt-1 font-display text-2xl font-bold">Rescue queue</h2></div><Link href="/donations" className="text-xs font-bold text-[hsl(var(--primary))]" data-testid="link-view-all-donations">View all <ArrowRight className="ml-1 inline" size={14} /></Link></div><div className="mt-5 space-y-2">{donations.isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-16" />) : upcoming.length ? upcoming.map(d => <DonationRow key={d.id} donation={d} />) : <EmptyState icon={Package} title="No active rescues yet" body="When a donation is posted, its path will appear here." action={<Button href="/donations/new" variant="secondary">Post the first one</Button>} />}</div></section><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Network pulse</p><h2 className="mt-1 font-display text-2xl font-bold">Recent activity</h2></div><ActivityIcon size={19} className="text-[hsl(var(--primary))]" /></div><div className="mt-5 space-y-5">{activity.isLoading ? [1,2,3].map(i => <Skeleton key={i} className="h-12" />) : activity.data?.length ? activity.data.slice(0, 5).map(a => <div key={a.id} className="flex gap-3" data-testid={`activity-${a.id}`}><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${a.tone === "amber" ? "bg-[hsl(var(--accent))]" : a.tone === "green" ? "bg-[hsl(var(--primary))]" : a.tone === "blue" ? "bg-[hsl(190_38%_48%)]" : "bg-[hsl(var(--muted-foreground))]"}`} /><div><p className="text-sm font-bold">{a.title}</p><p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{a.description}</p><p className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{a.time}</p></div></div>) : <EmptyState icon={ActivityIcon} title="Your activity will appear here" body="Updates arrive as food moves through the network." />}</div></section></div></div></AppShell>;
}

function DonationRow({ donation }: { donation: Donation }) {
  return <Link href={`/donations/${donation.id}`} className="group flex items-center gap-3 rounded-xl border border-transparent bg-[hsl(var(--background))] p-3 transition hover:border-[hsl(var(--accent))] hover:bg-[hsl(var(--secondary))]" data-testid={`row-donation-${donation.id}`}><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Utensils size={18} /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{donation.foodName}</p><p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">{donation.restaurantName} · {donation.servings} servings</p></div><div className="hidden text-right sm:block"><StatusBadge status={donation.status} urgent={donation.urgent} /><p className="mt-1 font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">by {formatDate(donation.pickupDeadline)}</p></div><ChevronRight size={16} className="text-[hsl(var(--muted-foreground))] transition group-hover:translate-x-1" /></Link>;
}

function EmptyState({ icon: Icon, title, body, action }: { icon: typeof Package; title: string; body: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] px-5 py-12 text-center"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={21} /></span><h3 className="mt-4 font-display text-xl font-bold">{title}</h3><p className="mt-2 max-w-xs text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{body}</p>{action && <div className="mt-5">{action}</div>}</div>;
}

function Donations() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [urgent, setUrgent] = useState(false);
  const params = useMemo(() => ({ search: search || undefined, foodType: type || undefined, urgent: urgent || undefined }), [search, type, urgent]);
  const query = useListDonations(params);
  const items = query.data || [];
  return <AppShell><div className="page-enter"><PageTitle eyebrow="The live board" title="Available donations" description="A clear view of food that needs a next table. Filter by what fits your route." action={<Button href="/donations/new" testId="button-new-donation"><Plus size={17} /> Post surplus</Button>} /><div className="mb-6 flex flex-col gap-3 lg:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search food, restaurant, or neighborhood" className="h-12 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] pl-10 pr-4 text-sm outline-none transition focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.25)]" data-testid="input-search-donations" /></label><select value={type} onChange={e => setType(e.target.value)} className="h-12 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 text-sm font-semibold outline-none focus:border-[hsl(var(--accent))]" data-testid="select-food-type"><option value="">All food types</option><option value="VEG">Vegetarian</option><option value="VEGAN">Vegan</option><option value="NON_VEG">Non-vegetarian</option></select><button onClick={() => setUrgent(!urgent)} className={`h-12 rounded-xl border px-4 text-sm font-bold transition ${urgent ? "border-[hsl(var(--destructive))] bg-[hsl(8_70%_94%)] text-[hsl(var(--destructive))]" : "border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]"}`} data-testid="button-filter-urgent"><CircleAlert size={16} className="mr-2 inline" /> Urgent only</button></div><div className="mb-5 flex items-center justify-between"><p className="text-sm text-[hsl(var(--muted-foreground))]"><span className="font-bold text-[hsl(var(--foreground))]">{items.length}</span> donations in view</p><span className="font-mono-ui text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Sorted by pickup window</span></div>{query.isLoading ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48" />)}</div> : query.isError ? <EmptyState icon={CircleAlert} title="The board is taking a breath" body="We couldn't load nearby donations. Refresh and try again." action={<Button onClick={() => query.refetch()}>Try again</Button>} /> : items.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 stagger">{items.map(d => <DonationCard key={d.id} donation={d} />)}</div> : <EmptyState icon={Package} title="Nothing matches those filters" body="Try a wider search or clear your filters to see the full board." action={<Button onClick={() => { setSearch(""); setType(""); setUrgent(false); }} variant="secondary">Clear filters</Button>} />}</div></AppShell>;
}

function DonationCard({ donation }: { donation: Donation }) {
  return <Link href={`/donations/${donation.id}`} className="group overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] transition duration-300 hover:-translate-y-1 hover:border-[hsl(var(--accent))] hover:shadow-[0_18px_35px_-25px_hsl(var(--primary))]" data-testid={`card-donation-${donation.id}`}><div className="relative h-28 overflow-hidden bg-[hsl(var(--secondary))]">{donation.imageUrl ? <img src={donation.imageUrl} alt={donation.foodName} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-[hsl(var(--primary)/.25)]"><Utensils size={38} /></div>}<div className="absolute left-3 top-3"><StatusBadge status={donation.status} urgent={donation.urgent} /></div></div><div className="p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="font-display text-xl font-bold leading-tight">{donation.foodName}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{donation.restaurantName}</p></div><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{donation.distanceKm} km</span></div><div className="mt-4 flex items-center gap-4 border-t border-[hsl(var(--border))] pt-3 text-xs text-[hsl(var(--muted-foreground))]"><span><b className="text-[hsl(var(--foreground))]">{donation.servings}</b> servings</span><span><b className="text-[hsl(var(--foreground))]">{donation.foodType}</b></span><span className="ml-auto flex items-center gap-1 text-[hsl(var(--destructive))]"><Clock3 size={13} /> {formatDate(donation.pickupDeadline)}</span></div></div></Link>;
}

function NewDonation() {
  const [, setLocation] = useLocation();
  const create = useCreateDonation();
  const [form, setForm] = useState({ foodName: "", category: "Prepared meal", quantity: "", servings: "12", foodType: "VEG" as "VEG" | "NON_VEG" | "VEGAN", preparationTime: "", expiryTime: "", pickupDeadline: "", description: "", address: "145 SE Morrison St, Portland" });
  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = (e: React.FormEvent) => { e.preventDefault(); create.mutate({ data: { ...form, servings: Number(form.servings), imageUrl: null } }, { onSuccess: d => { queryClient.invalidateQueries({ queryKey: getListDonationsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); setLocation(`/donations/${d.id}`); } }); };
  return <AppShell><div className="mx-auto max-w-4xl page-enter"><PageTitle eyebrow="Create a handover" title="Post surplus food" description="A few clear details help the right organization say yes quickly." action={<Link href="/donations" className="text-sm font-bold text-[hsl(var(--muted-foreground))]" data-testid="link-cancel-donation">Cancel</Link>} /><form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_300px]"><div className="space-y-6"><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))] font-mono-ui text-xs font-bold">01</span><div><h2 className="font-display text-xl font-bold">What is ready?</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">Describe it like you would to a neighbor.</p></div></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Food name" value={form.foodName} onChange={v => update("foodName", v)} placeholder="e.g. Herb roasted vegetables" required testId="input-food-name" /><Field label="Category" value={form.category} onChange={v => update("category", v)} placeholder="Prepared meal" required testId="input-category" /><Field label="Quantity" value={form.quantity} onChange={v => update("quantity", v)} placeholder="e.g. 3 hotel pans" required testId="input-quantity" /><Field label="Servings" type="number" value={form.servings} onChange={v => update("servings", v)} placeholder="12" required testId="input-servings" /><div className="sm:col-span-2"><label className="mb-2 block text-xs font-bold">Food type</label><div className="grid grid-cols-3 gap-2">{(["VEG", "VEGAN", "NON_VEG"] as const).map(t => <button type="button" key={t} onClick={() => update("foodType", t)} className={`rounded-xl border px-3 py-3 text-xs font-bold transition ${form.foodType === t ? "border-[hsl(var(--primary))] bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))]"}`} data-testid={`button-food-type-${t.toLowerCase()}`}>{t === "NON_VEG" ? "Non-vegetarian" : t === "VEG" ? "Vegetarian" : "Vegan"}</button>)}</div></div><div className="sm:col-span-2"><label className="mb-2 block text-xs font-bold">Short description</label><textarea required value={form.description} onChange={e => update("description", e.target.value)} placeholder="Anything the receiving team should know about portions, packing, or allergens." className="min-h-24 w-full resize-y rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 text-sm outline-none focus:border-[hsl(var(--accent))]" data-testid="input-description" /></div></div></section><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--accent))] text-[hsl(var(--sidebar))] font-mono-ui text-xs font-bold">02</span><div><h2 className="font-display text-xl font-bold">Set the window</h2><p className="text-xs text-[hsl(var(--muted-foreground))]">The sooner teams can see the deadline, the better.</p></div></div><div className="grid gap-5 sm:grid-cols-2"><Field label="Prepared at" type="datetime-local" value={form.preparationTime} onChange={v => update("preparationTime", v)} required testId="input-preparation-time" /><Field label="Best before" type="datetime-local" value={form.expiryTime} onChange={v => update("expiryTime", v)} required testId="input-expiry-time" /><Field label="Pickup by" type="datetime-local" value={form.pickupDeadline} onChange={v => update("pickupDeadline", v)} required testId="input-pickup-deadline" /><div className="sm:col-span-2"><Field label="Pickup address" value={form.address} onChange={v => update("address", v)} required testId="input-address" /></div></div></section><Button disabled={create.isPending} className="w-full sm:w-auto" testId="button-submit-donation">{create.isPending ? "Posting to the network…" : "Publish donation"} <ArrowRight size={16} /></Button>{create.isError && <p className="text-sm text-[hsl(var(--destructive))]" data-testid="status-create-error">We couldn't post this donation. Check the details and try again.</p>}</div><aside className="h-fit rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))] lg:sticky lg:top-24"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[hsl(var(--accent))]"><ShieldCheck size={15} /> Posting guide</p><div className="mt-6 space-y-5 text-sm"><p className="flex gap-3"><span className="font-mono-ui text-[hsl(var(--accent))]">01</span><span className="text-[hsl(var(--sidebar-foreground)/.72)]">Use the pickup deadline, not closing time. It tells partners what is realistic.</span></p><p className="flex gap-3"><span className="font-mono-ui text-[hsl(var(--accent))]">02</span><span className="text-[hsl(var(--sidebar-foreground)/.72)]">Pack portions consistently so a driver can load and go.</span></p><p className="flex gap-3"><span className="font-mono-ui text-[hsl(var(--accent))]">03</span><span className="text-[hsl(var(--sidebar-foreground)/.72)]">Once posted, stay near notifications. A quick confirmation keeps food moving.</span></p></div></aside></form></div></AppShell>;
}

function Field({ label, value, onChange, placeholder, type = "text", required = false, testId }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; required?: boolean; testId: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-bold">{label}</span><input type={type} required={required} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="h-11 w-full rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-sm outline-none transition focus:border-[hsl(var(--accent))] focus:ring-2 focus:ring-[hsl(var(--accent)/.2)]" data-testid={testId} /></label>;
}

function DonationDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const query = useGetDonation(id, { query: { queryKey: getGetDonationQueryKey(id), enabled: !!id } });
  const claim = useClaimDonation();
  const updateStatus = useUpdateDonationStatus();
  const updateDonation = useUpdateDonation();
  const donation = query.data;
  const doMutation = (action: () => void) => action();
  const nextStatus = donation?.status === "CLAIMED" ? DonationStatusInputStatus.PICKUP_PENDING : donation?.status === "PICKUP_PENDING" ? DonationStatusInputStatus.PICKED_UP : donation?.status === "PICKED_UP" ? DonationStatusInputStatus.DELIVERED : donation?.status === "DELIVERED" ? DonationStatusInputStatus.COMPLETED : null;
  const refresh = () => { queryClient.invalidateQueries({ queryKey: getGetDonationQueryKey(id) }); queryClient.invalidateQueries({ queryKey: getListDonationsQueryKey() }); queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() }); };
  if (query.isLoading) return <AppShell><div className="space-y-5"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96" /></div></AppShell>;
  if (query.isError || !donation) return <AppShell><EmptyState icon={CircleAlert} title="Donation not found" body="This rescue may have moved out of the live board." action={<Button href="/donations">Back to donations</Button>} /></AppShell>;
  return <AppShell><div className="page-enter"><Link href="/donations" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]" data-testid="link-back-donations">← All donations</Link><div className="grid gap-6 xl:grid-cols-[1fr_360px]"><div><div className="overflow-hidden rounded-[1.7rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))]"><div className="relative h-48 bg-[hsl(var(--secondary))] sm:h-64">{donation.imageUrl ? <img src={donation.imageUrl} alt={donation.foodName} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[hsl(var(--primary)/.2)]"><Utensils size={70} /></div>}<div className="absolute left-5 top-5"><StatusBadge status={donation.status} urgent={donation.urgent} /></div></div><div className="p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">{donation.category} · {donation.foodType}</p><h1 className="mt-2 font-display text-4xl font-bold tracking-[-.045em]">{donation.foodName}</h1><p className="mt-2 flex items-center gap-1.5 text-sm text-[hsl(var(--muted-foreground))]"><Store size={15} /> {donation.restaurantName}</p></div><div className="rounded-xl bg-[hsl(var(--secondary))] px-4 py-3 text-right"><p className="font-display text-2xl font-bold">{donation.servings}</p><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">servings</p></div></div><p className="mt-7 max-w-2xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{donation.description}</p><div className="mt-8 grid gap-4 border-y border-[hsl(var(--border))] py-5 sm:grid-cols-3"><DetailStat icon={Clock3} label="Pickup by" value={formatDate(donation.pickupDeadline)} urgent /><DetailStat icon={CircleAlert} label="Best before" value={formatDate(donation.expiryTime)} /><DetailStat icon={MapPin} label="From the kitchen" value={`${donation.distanceKm} km away`} /></div><div className="mt-7"><p className="mb-4 font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Handover progress</p><ProgressSteps status={donation.status} /></div></div></div></div><aside className="space-y-4"><div className="rounded-2xl bg-[hsl(var(--sidebar))] p-6 text-[hsl(var(--sidebar-foreground))]"><p className="text-xs font-bold uppercase tracking-[.15em] text-[hsl(var(--accent))]">Next best action</p>{donation.status === "AVAILABLE" ? <><h2 className="mt-3 font-display text-2xl font-bold">Can your team carry this?</h2><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">Claim it to reserve the food and start a clear pickup handover.</p><Button onClick={() => doMutation(() => claim.mutate({ id }, { onSuccess: refresh }))} disabled={claim.isPending} variant="secondary" className="mt-6 w-full" testId="button-claim-donation">{claim.isPending ? "Claiming…" : "Claim this donation"} <HandHeart size={16} /></Button></> : nextStatus ? <><h2 className="mt-3 font-display text-2xl font-bold">Move the handover forward</h2><p className="mt-2 text-sm leading-relaxed text-[hsl(var(--sidebar-foreground)/.65)]">Keep both sides aligned by confirming the next step when it happens.</p><Button onClick={() => updateStatus.mutate({ id, data: { status: nextStatus } }, { onSuccess: refresh })} disabled={updateStatus.isPending} variant="secondary" className="mt-6 w-full" testId="button-advance-status">{updateStatus.isPending ? "Updating…" : `Mark ${statusLabel[nextStatus].toLowerCase()}`} <Check size={16} /></Button></> : <div className="mt-3 flex items-center gap-2 text-[hsl(var(--accent))]"><CheckCircle2 size={20} /><span className="font-bold">This rescue is closed.</span></div>}{claim.isError && <p className="mt-3 text-xs text-[hsl(8_70%_72%)]" data-testid="status-claim-error">Someone else may have claimed this one. Refresh the board.</p>}</div><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6"><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Pickup details</p><div className="mt-4 flex gap-3"><MapPin size={17} className="mt-0.5 shrink-0 text-[hsl(var(--primary))]" /><div><p className="text-sm font-bold">{donation.location.address}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Ready since {formatDate(donation.preparationTime)}</p></div></div><p className="mt-5 flex items-center gap-2 text-xs font-bold text-[hsl(var(--primary))]"><ShieldCheck size={15} /> Restaurant verified</p></div>{["AVAILABLE", "CLAIMED"].includes(donation.status) && <Button onClick={() => updateDonation.mutate({ id, data: { status: DonationUpdateStatus.CANCELLED } }, { onSuccess: () => { refresh(); setLocation("/donations"); } })} variant="ghost" className="w-full text-[hsl(var(--destructive))]" disabled={updateDonation.isPending} testId="button-cancel-donation"><XCircle size={16} /> Cancel donation</Button>}</aside></div></div></AppShell>;
}

function DetailStat({ icon: Icon, label, value, urgent = false }: { icon: typeof Clock3; label: string; value: string; urgent?: boolean }) { return <div className="flex gap-2"><Icon size={16} className={`mt-0.5 ${urgent ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--primary))]"}`} /><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[hsl(var(--muted-foreground))]">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div></div>; }
function ProgressSteps({ status }: { status: string }) { const steps = ["CLAIMED", "PICKUP_PENDING", "PICKED_UP", "DELIVERED", "COMPLETED"]; const index = steps.indexOf(status); return <div className="flex items-start">{steps.map((step, i) => <div key={step} className="flex flex-1 items-start last:flex-none"><div><div className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-black ${i <= index ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>{i < index ? <Check size={13} /> : i + 1}</div><p className="mt-2 max-w-14 text-[9px] font-bold uppercase leading-tight text-[hsl(var(--muted-foreground))]">{statusLabel[step]}</p></div>{i < steps.length - 1 && <div className={`mt-3 h-0.5 flex-1 ${i < index ? "bg-[hsl(var(--primary))]" : "bg-[hsl(var(--muted))]"}`} />}</div>)}</div>; }

function Impact() {
  const { data: summary, isLoading } = useGetDashboardSummary();
  const months = summary?.monthlyImpact || [];
  const max = Math.max(...months.map(x => x.value), 1);
  return <AppShell><div className="page-enter"><PageTitle eyebrow="Proof of the work" title="Impact, in plain view" description="Every completed handover adds up. These numbers keep the network honest about what moved." action={<span className="flex items-center gap-2 rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]"><Leaf size={14} /> Network-wide estimate</span>} /><div className="grid gap-3 md:grid-cols-3"><StatCard label="Food rescued" value={isLoading ? "—" : `${summary?.foodRescuedKg ?? 0} kg`} detail="all time" icon={Leaf} accent /><StatCard label="Meals served" value={isLoading ? "—" : summary?.mealsServed ?? 0} detail="people reached" icon={Utensils} /><StatCard label="Organizations helped" value={isLoading ? "—" : summary?.organizationsHelped ?? 0} detail="verified partners" icon={HandHeart} /></div><div className="mt-6 grid gap-6 lg:grid-cols-[1.15fr_.85fr]"><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:p-8"><div className="flex items-start justify-between"><div><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Monthly movement</p><h2 className="mt-1 font-display text-2xl font-bold">Rescued food, month by month</h2></div><BarChart3 size={20} className="text-[hsl(var(--primary))]" /></div>{isLoading ? <Skeleton className="mt-10 h-56" /> : <div className="mt-10 flex h-56 items-end gap-2 sm:gap-4">{months.map((m, i) => <div key={m.month} className="group flex flex-1 flex-col items-center gap-2"><div className="relative flex h-44 w-full items-end"><div className="w-full rounded-t-lg bg-[hsl(var(--primary))] transition-all duration-300 group-hover:bg-[hsl(var(--accent))]" style={{ height: `${Math.max((m.value / max) * 100, 7)}%` }}><span className="absolute -top-6 left-1/2 -translate-x-1/2 font-mono-ui text-[10px] opacity-0 transition group-hover:opacity-100">{m.value}</span></div></div><span className="font-mono-ui text-[9px] text-[hsl(var(--muted-foreground))]">{m.month}</span></div>)}</div>}</section><section className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 sm:p-8"><p className="font-mono-ui text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">What it means</p><h2 className="mt-1 font-display text-2xl font-bold">A practical estimate</h2><div className="mt-8 space-y-6"><ImpactLine icon={Leaf} title="Lowered food waste" body="Redirected from disposal into meals" value={summary ? `${summary.foodRescuedKg} kg` : "—"} /><ImpactLine icon={Utensils} title="Protected meals" body="Portions received by local partners" value={summary ? `${summary.mealsServed}` : "—"} /><ImpactLine icon={Truck} title="Connected kitchens" body="Restaurants keeping the network full" value={summary ? `${summary.restaurantsParticipating}` : "—"} /></div><div className="mt-8 rounded-xl bg-[hsl(var(--secondary))] p-4 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]"><span className="font-bold text-[hsl(var(--foreground))]">How we estimate:</span> Food rescued is recorded from completed donation quantities. Meal equivalents use reported servings, not a generic conversion.</div></section></div></div></AppShell>;
}
function ImpactLine({ icon: Icon, title, body, value }: { icon: typeof Leaf; title: string; body: string; value: string }) { return <div className="flex gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><Icon size={18} /></span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-3"><p className="text-sm font-bold">{title}</p><p className="font-display text-xl font-bold text-[hsl(var(--primary))]">{value}</p></div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{body}</p></div></div>; }

function Notifications() {
  const query = useListNotifications();
  const mark = useMarkNotificationRead();
  const notifications = query.data || [];
  return <AppShell><div className="page-enter"><PageTitle eyebrow="Keep the chain moving" title="Notifications" description="A record of the moments that need a response — and the ones worth noticing." action={<span className="rounded-full bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--primary))]">{notifications.filter(n => !n.isRead).length} unread</span>} /><div className="mx-auto max-w-3xl space-y-2">{query.isLoading ? [1,2,3,4].map(i => <Skeleton key={i} className="h-20" />) : notifications.length ? notifications.map(n => <div key={n.id} className={`flex gap-4 rounded-2xl border p-4 transition ${n.isRead ? "border-[hsl(var(--border))] bg-[hsl(var(--card))]" : "border-[hsl(var(--accent)/.7)] bg-[hsl(var(--secondary))]"}`} data-testid={`notification-${n.id}`}><span className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${n.type === "urgent" ? "bg-[hsl(8_70%_93%)] text-[hsl(var(--destructive))]" : "bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))]"}`}>{n.type === "urgent" ? <CircleAlert size={17} /> : <Bell size={17} />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><p className="text-sm font-bold">{n.title}</p><span className="font-mono-ui text-[10px] text-[hsl(var(--muted-foreground))]">{relativeTime(n.createdAt)}</span></div><p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{n.message}</p>{!n.isRead && <button onClick={() => mark.mutate({ id: n.id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) })} className="mt-3 text-[11px] font-bold text-[hsl(var(--primary))] hover:underline" data-testid={`button-mark-read-${n.id}`}>Mark as read</button>}</div></div>) : <EmptyState icon={Bell} title="All quiet here" body="When a rescue needs your attention, it will land in this space." />}</div></div></AppShell>;
}

function Organizations() {
  const query = useListNearbyOrganizations();
  const orgs = query.data || [];
  return <AppShell><div className="page-enter"><PageTitle eyebrow="Trusted neighbors" title="Nearby organizations" description="Verified partners who can turn a pickup window into a meal." action={<span className="flex items-center gap-2 text-xs font-bold text-[hsl(var(--muted-foreground))]"><MapPin size={14} /> Portland metro</span>} />{query.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-40" />)}</div> : query.isError ? <EmptyState icon={CircleAlert} title="Partner list unavailable" body="We couldn't load nearby organizations." action={<Button onClick={() => query.refetch()}>Try again</Button>} /> : orgs.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 stagger">{orgs.map(org => <div key={org.id} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition hover:-translate-y-0.5 hover:border-[hsl(var(--accent))]" data-testid={`card-organization-${org.id}`}><div className="flex items-start justify-between"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--primary))]"><HandHeart size={20} /></span><span className="flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))]"><ShieldCheck size={14} /> Verified</span></div><h2 className="mt-5 font-display text-2xl font-bold">{org.name}</h2><p className="mt-1 text-xs font-semibold text-[hsl(var(--muted-foreground))]">{org.type}</p><p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]"><MapPin size={14} className="mt-0.5 shrink-0" /> {org.address}</p><div className="mt-5 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4 text-xs"><span><b className="text-[hsl(var(--foreground))]">{org.distanceKm} km</b> away</span><span><b className="text-[hsl(var(--foreground))]">{org.peopleServed}</b> people served</span><span className="text-[hsl(var(--accent-foreground))]">★ {org.rating}</span></div></div>)}</div> : <EmptyState icon={Users} title="No nearby partners yet" body="As organizations verify their workspace, they will appear here." />}</div></AppShell>;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: "top" as const,
  },
  variables: {
    colorPrimary: "hsl(163 37% 28%)",
    colorForeground: "hsl(166 28% 16%)",
    colorMutedForeground: "hsl(163 11% 45%)",
    colorDanger: "hsl(8 70% 51%)",
    colorBackground: "hsl(40 44% 98%)",
    colorInput: "hsl(39 24% 91%)",
    colorInputForeground: "hsl(166 28% 16%)",
    colorNeutral: "hsl(39 21% 84%)",
    fontFamily: "Manrope, sans-serif",
    borderRadius: "0.8rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[hsl(40_44%_98%)] rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "font-display text-3xl font-bold tracking-tight",
    headerSubtitle: "text-[hsl(163_11%_45%)]",
    socialButtonsBlockButtonText: "font-bold text-[hsl(166_28%_16%)]",
    formFieldLabel: "font-bold text-[hsl(166_28%_16%)]",
    footerActionLink: "font-bold text-[hsl(163_37%_28%)]",
    footerActionText: "text-[hsl(163_11%_45%)]",
    dividerText: "text-[hsl(163_11%_45%)]",
    identityPreviewEditButton: "text-[hsl(163_37%_28%)]",
    formFieldSuccessText: "text-[hsl(163_37%_28%)]",
    alertText: "text-[hsl(8_70%_40%)]",
    logoBox: "h-10",
    logoImage: "h-10 w-auto",
    socialButtonsBlockButton: "border-[hsl(39_21%_84%)] bg-white hover:bg-[hsl(39_28%_89%)]",
    formButtonPrimary: "bg-[hsl(163_37%_28%)] hover:bg-[hsl(163_37%_23%)] font-bold",
    formFieldInput: "border-[hsl(39_21%_84%)] bg-[hsl(39_24%_91%)] text-[hsl(166_28%_16%)]",
    footerAction: "border-t border-[hsl(39_21%_84%)]",
    dividerLine: "bg-[hsl(39_21%_84%)]",
    alert: "border-[hsl(8_70%_51%)] bg-[hsl(8_70%_94%)]",
    otpCodeFieldInput: "border-[hsl(39_21%_84%)] bg-[hsl(39_24%_91%)]",
    formFieldRow: "gap-2",
    main: "gap-5",
  },
};

function SignInPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-4 py-8"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/onboarding`} appearance={clerkAppearance} /></div>;
}

function SignUpPage() {
  return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--sidebar))] px-4 py-8"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/onboarding`} appearance={clerkAppearance} /></div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const previousUserId = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const nextUserId = user?.id ?? null;
    if (previousUserId.current !== undefined && previousUserId.current !== nextUserId) {
      queryClient.clear();
    }
    previousUserId.current = nextUserId;
  }), [addListener]);
  return null;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch><Route path="/" component={HomeRedirect} /><Route path="/sign-in/*?" component={SignInPage} /><Route path="/sign-up/*?" component={SignUpPage} /><Route path="/login" component={Login} /><Route path="/onboarding" component={() => <RequireAuth><Onboarding /></RequireAuth>} /><Route component={() => <RequireAuth><Switch><Route path="/dashboard" component={Dashboard} /><Route path="/donations/new" component={NewDonation} /><Route path="/donations" component={Donations} /><Route path="/donations/:id" component={DonationDetail} /><Route path="/impact" component={Impact} /><Route path="/notifications" component={Notifications} /><Route path="/organizations" component={Organizations} /><Route component={NotFound} /></Switch></RequireAuth>} /></Switch></ErrorBoundary>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: "Welcome back", subtitle: "Sign in to continue rescuing food." } }, signUp: { start: { title: "Join FoodRescue", subtitle: "Create an account for your local recovery network." } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={(to) => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkQueryClientCacheInvalidator /><Router /></QueryClientProvider></ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;