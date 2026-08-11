import Link from "next/link";
import {
  BookOpen,
  ChartNoAxesColumnIncreasing,
  CircleUserRound,
  Map,
  Repeat2,
} from "lucide-react";

export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active: "today" | "path" | "practice" | "progress";
}) {
  const items = [
    { id: "today", label: "Today", href: "/", Icon: Map },
    { id: "path", label: "Path", href: "/path", Icon: BookOpen },
    { id: "practice", label: "Practice", href: "/practice", Icon: Repeat2 },
    {
      id: "progress",
      label: "Progress",
      href: "/progress",
      Icon: ChartNoAxesColumnIncreasing,
    },
  ] as const;
  return (
    <div className="mx-auto min-h-dvh max-w-[430px] px-4 pt-5 pb-28">
      <header className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="tap-target flex items-center gap-3"
          aria-label="Rumbo home"
        >
          <span className="route-mark scale-75" aria-hidden="true" />
          <span className="text-xl font-black tracking-tight">Rumbo</span>
        </Link>
        <Link
          href="/settings"
          className="tap-target grid place-items-center rounded-full bg-white"
          aria-label="Profile and settings"
        >
          <CircleUserRound size={26} />
        </Link>
      </header>
      <main>{children}</main>
      <nav
        className="safe-bottom border-ink/10 bg-canvas/95 fixed right-0 bottom-0 left-0 z-40 border-t pt-2 backdrop-blur"
        aria-label="Primary navigation"
      >
        <div className="mx-auto grid max-w-[430px] grid-cols-4 px-2">
          {items.map(({ id, label, href, Icon }) => (
            <Link
              key={id}
              href={href}
              aria-current={active === id ? "page" : undefined}
              className={`tap-target flex flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${active === id ? "text-agave" : "text-ink/65"}`}
            >
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
