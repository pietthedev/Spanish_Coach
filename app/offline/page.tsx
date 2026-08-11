import Link from "next/link";
import { WifiOff } from "lucide-react";
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-5 text-center">
      <div>
        <WifiOff className="text-sky mx-auto" size={48} />
        <h1 className="mt-5 text-4xl font-black">You’re offline</h1>
        <p className="text-ink/65 mt-3">
          Downloaded lessons and local progress still work. Speech can be
          recorded and replayed, but Rumbo will not score it offline.
        </p>
        <Link
          href="/"
          className="tap-target bg-ink mt-6 flex items-center justify-center rounded-2xl px-6 font-black text-white"
        >
          Open Today
        </Link>
      </div>
    </main>
  );
}
