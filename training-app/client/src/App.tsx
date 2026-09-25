export const App = () => {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <section className="mx-auto flex min-h-screen max-w-5xl items-center px-6 py-16">
        <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">PT BMC</p>
          <h1 className="mt-3 text-3xl font-bold text-[#0A2942]">Training dan Refreshment</h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            Workspace aplikasi sedang disiapkan. Modul operasional akan ditambahkan setelah fondasi dan akses data tervalidasi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm font-medium text-[#0A2942]">
            <span className="rounded-md border border-slate-200 px-3 py-2">Fondasi aplikasi</span>
            <span className="rounded-md border border-slate-200 px-3 py-2">Discovery database</span>
            <span className="rounded-md border border-slate-200 px-3 py-2">JWT dan role access</span>
          </div>
        </div>
      </section>
    </main>
  );
};
