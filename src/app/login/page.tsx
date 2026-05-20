export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen flex items-center justify-center">
      <form action="/api/login" method="post" className="w-80 space-y-4">
        <h1 className="text-xl">ShipBoost Outreach</h1>
        <input
          name="password"
          type="password"
          required
          autoFocus
          placeholder="Password"
          className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded"
        />
        {error && <p className="text-red-400 text-sm">Wrong password.</p>}
        <button className="w-full py-2 bg-zinc-100 text-zinc-900 rounded">Sign in</button>
      </form>
    </main>
  );
}
