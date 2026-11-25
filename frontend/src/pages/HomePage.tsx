import { ArrowDown, ArrowRight, Building2, ClipboardList, FileText, KeyRound, MessageCircle, Receipt, Wrench } from 'lucide-react'
import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button'

const features = [
  { title: 'Leasing', icon: KeyRound, description: 'Organize properties, units, renters, and lease records across your portfolio.' },
  { title: 'Billing', icon: Receipt, description: 'Issue invoices and follow their status from the same workspace as your leases.' },
  { title: 'Maintenance', icon: Wrench, description: 'Log maintenance requests by property or unit and track their progress.' },
]

export function HomePage() {
  return (
    <div className="min-h-dvh bg-[#f7f8f4] text-[#172822] [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4">
      <header className="border-b border-[#dce3d9]">
        <nav aria-label="Public navigation" className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Link to="/" className="inline-flex items-center gap-2 font-semibold">
            <Building2 aria-hidden="true" className="size-8 rounded-lg bg-[#174537] p-1.5 text-white" />
            Property SaaS Portal
          </Link>
          <div className="flex items-center gap-5 text-sm font-medium">
            <a href="#features" className="hover:underline">Features</a>
            <Link to="/access" className="hover:underline">Support</Link>
            <Link to="/login" className="hover:underline">Sign in</Link>
          </div>
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_1fr]">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-6xl">Manage your properties in one workspace.</h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-[#475950]">
              A multi-tenant platform for property leasing, billing, and maintenance. Give each organization its own workspace for its portfolio and team.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link to="/register" className={buttonVariants({ className: 'h-11 bg-[#174537] px-4 text-white hover:bg-[#205846]' })}>
                Create an organization <ArrowRight aria-hidden="true" />
              </Link>
              <a href="#features" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium hover:underline">
                Explore features <ArrowDown aria-hidden="true" className="size-4" />
              </a>
            </div>
          </div>

          <div className="rounded-3xl bg-[#153a32] p-5 text-white sm:p-8">
            <div className="flex items-center gap-3 border-b border-white/20 pb-5">
              <Building2 aria-hidden="true" className="size-10 rounded-xl bg-white/10 p-2" />
              <div>
                <p className="text-sm text-[#c4ded2]">Example workspace</p>
                <p className="font-semibold">Cedar Court Properties</p>
              </div>
            </div>
            <ul className="mt-5 grid gap-2">
              {[
                { icon: FileText, label: 'Lease', detail: 'Building A · Unit 204', status: 'Active' },
                { icon: Receipt, label: 'Rent invoice', detail: 'Building A · Unit 204', status: 'Issued' },
                { icon: ClipboardList, label: 'Heating request', detail: 'Building B · Unit 106', status: 'In progress' },
              ].map(({ icon: Icon, label, detail, status }) => (
                <li key={label} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-white/10 p-3">
                  <Icon aria-hidden="true" className="size-5 text-[#c4ded2]" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-[#c4ded2]">{detail}</p>
                  </div>
                  <span className="rounded-full bg-[#dbeed9] px-2.5 py-1 text-xs font-medium text-[#174537]">{status}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-7xl scroll-mt-4 px-5 pb-14 sm:px-8 sm:pb-20">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Tools for your property team</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {features.map(({ title, icon: Icon, description }) => (
              <article key={title} className="rounded-2xl border border-[#dce3d9] bg-white p-6">
                <Icon aria-hidden="true" className="size-10 rounded-lg bg-[#eaf1e8] p-2 text-[#174537]" />
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#475950]">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[#dce3d9] bg-[#eaf1e8]">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-5 py-8 sm:px-8">
            <div>
              <h2 className="text-xl font-semibold">After you register</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#475950]">
                Our team reviews new organizations before workspace access opens. Sign in to check your status or message the platform team while you wait.
              </p>
            </div>
            <Link to="/access" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">
              <MessageCircle aria-hidden="true" className="size-4" /> Review status and support
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-7xl px-5 py-6 text-sm text-[#475950] sm:px-8">Property SaaS Portal</footer>
    </div>
  )
}
