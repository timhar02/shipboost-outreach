export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="ops-grid-bg flex min-h-screen items-center justify-center p-4">
      <form action="/api/login" method="post" className="ops-panel w-full max-w-sm rounded-lg p-5">
        <div className="ops-kicker">Private console</div>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-zinc-50">ShipBoost Outreach</h1>
        <p className="mt-1 text-sm text-zinc-500">Sign in to manage outreach operations.</p>
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="mt-5 w-full rounded-md border border-zinc-800 bg-[#101410] px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-lime-300/70"
        />
        {error && <p className="text-red-400 text-sm">Wrong password.</p>}
        <button className="mt-3 w-full rounded-md bg-lime-300 py-2 text-sm font-black text-zinc-950 transition hover:bg-lime-200">Sign in</button>
      </form>
    </main>
  );
}
