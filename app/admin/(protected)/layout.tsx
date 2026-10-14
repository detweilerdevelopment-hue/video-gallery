import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logoutAction } from "../login/actions";

export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  return (
    <div className="admin-body">
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <Link className="brand" href="/admin">FRAME<span>VAULT</span></Link>
          <nav aria-label="Admin navigation">
            <Link href="/admin">Dashboard</Link>
            <Link href="/admin/videos">Videos</Link>
            <Link href="/admin/content">Site content</Link>
            <Link href="/admin/categories">Categories</Link>
            <Link href="/admin/storage">Storage test</Link>
            <Link href="/" target="_blank">View site ↗</Link>
          </nav>
          <div className="admin-user"><strong>{session.name}</strong><form action={logoutAction}><button className="ghost" type="submit">Sign out</button></form></div>
        </aside>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
