import { LocalDateTime } from "@/components/admin/local-date-time";
import { getStorageProbeStatus } from "@/lib/storage-probe";
import { getStorageMigrationSummary } from "@/lib/storage-migration";
import { createStorageProbeAction, migrateStorageAction, removeStorageProbeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StorageProbePage({ searchParams }: { searchParams: Promise<{ count?: string; error?: string; success?: string }> }) {
  const [{ count, error, success }, status, migration] = await Promise.all([searchParams, getStorageProbeStatus(), getStorageMigrationSummary()]);
  return (
    <>
      <div className="admin-heading"><div><div className="eyebrow">Hostinger migration</div><h1>Storage test</h1></div></div>
      {success === "created" && <div className="flash-success">The persistence marker is present. Redeploy the site, then return here and confirm that the same creation time remains.</div>}
      {success === "removed" && <div className="flash-success">The persistence marker was removed.</div>}
      {success === "migrated" && <div className="flash-success">Backblaze migration finished. {count || "0"} file(s) were copied to Hostinger; files already present were left unchanged.</div>}
      {error === "probe" && <div className="flash-error">The marker could not be created. Review the status below and verify the Hostinger path and permissions.</div>}
      {error === "remove" && <div className="flash-error">The marker could not be removed.</div>}
      {error === "migration" && <div className="flash-error">One or more files could not be copied from Backblaze. Existing Hostinger copies are safe; keep Backblaze configured and retry.</div>}

      <section className="admin-panel">
        <h2>Filesystem status</h2>
        <p className="subtle">This test writes only one small hidden marker. It does not read, move, or delete any video.</p>
        <table className="admin-table"><tbody>
          <tr><th>Environment configured</th><td>{status.configured ? "Yes" : "No"}</td></tr>
          <tr><th>Storage directory</th><td>{status.root || "Set STORAGE_ROOT in Hostinger"}</td></tr>
          <tr><th>Directory available</th><td>{status.directoryExists ? "Yes" : "No"}</td></tr>
          <tr><th>Node.js read/write access</th><td>{status.writable ? "Yes" : "No"}</td></tr>
          <tr><th>Persistence marker</th><td>{status.marker ? "Present" : "Not created"}</td></tr>
          {status.marker && <tr><th>Marker created</th><td><LocalDateTime value={status.marker.createdAt} /></td></tr>}
          {status.error && <tr><th>Diagnostic</th><td>{status.error}</td></tr>}
        </tbody></table>
        <div className="form-actions">
          <form action={createStorageProbeAction}><button className="btn" type="submit" disabled={!status.configured}>Create or check marker</button></form>
          {status.marker && <form action={removeStorageProbeAction}><button className="danger-btn" type="submit">Remove marker</button></form>}
        </div>
      </section>

      <section className="admin-panel">
        <h2>Media migration</h2>
        <p className="subtle">New uploads use Hostinger automatically. Existing database references keep the same keys and can be copied from Backblaze without editing any video records.</p>
        <table className="admin-table"><tbody>
          <tr><th>Referenced media files</th><td>{migration.available ? migration.referenced : "Unavailable"}</td></tr>
          <tr><th>Files verified on Hostinger</th><td>{migration.available ? `${migration.local} / ${migration.referenced}` : "Unavailable"}</td></tr>
          <tr><th>Backblaze fallback configured</th><td>{migration.fallbackConfigured ? "Yes" : "No"}</td></tr>
          {migration.error && <tr><th>Diagnostic</th><td>{migration.error}</td></tr>}
        </tbody></table>
        {migration.available && migration.referenced === migration.local
          ? <div className="flash-success">Every referenced media file is stored on Hostinger.</div>
          : <div className="form-actions">
              <form action={migrateStorageAction}>
                <button className="btn" type="submit" disabled={!status.writable || !migration.fallbackConfigured || !migration.available}>Copy existing media to Hostinger</button>
              </form>
            </div>}
        <p className="subtle">Keep the Backblaze environment variables until every file is verified here and you have tested public playback after deployment.</p>
      </section>

      <section className="admin-panel">
        <h2>Persistence check</h2>
        <ol className="subtle">
          <li>Create the marker and note its creation time.</li>
          <li>Trigger a normal GitHub redeployment in Hostinger.</li>
          <li>Open this page again. The same creation time proves the file survived the deployment.</li>
          <li>Check the next Hostinger file backup for the <code>media-storage</code> directory before removing Backblaze.</li>
        </ol>
      </section>
    </>
  );
}
