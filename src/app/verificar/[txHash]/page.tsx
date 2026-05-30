import { APP_ID } from '@/lib/constants';
import { getAdminDb } from '@/lib/firebase-admin';
import { polygonScanUrl } from '@/lib/polygon-notarize';
import { LegajoClient } from './legajo-client';


interface Props { params: Promise<{ txHash: string }> }

export default async function VerificarPage({ params }: Props) {
  const { txHash } = await params;

  const db = getAdminDb();

  // Lookup notarization record
  const lookupSnap = await db
    .collection('artifacts').doc(APP_ID)
    .collection('notarizations').doc(txHash)
    .get()
    .catch(() => null);

  if (!lookupSnap?.exists) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="text-center space-y-2 p-8">
          <p className="text-2xl font-black">Registro no encontrado</p>
          <p className="text-muted-foreground text-sm">
            Este hash no corresponde a ningún contrato notarizado en AlquilaGestion Pro.
          </p>
          <a
            href={`https://polygonscan.com/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-4 text-sm text-primary underline"
          >
            Verificar en PolygonScan igualmente
          </a>
        </div>
      </div>
    );
  }

  const { adminId, contractId, documentHash, notarizedAt } = lookupSnap.data()!;

  // Contract
  const contractSnap = await db
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(adminId)
    .collection('contratos').doc(contractId)
    .get();

  const contract = contractSnap.exists ? { id: contractId, ...contractSnap.data() } as Record<string, any> : null;
  if (!contract) {
    return <div className="p-8 text-center text-muted-foreground">Contrato no disponible.</div>;
  }

  // Invoices
  const invSnap = await db
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(adminId)
    .collection('facturas')
    .where('contractId', '==', contractId)
    .orderBy('dueDate', 'asc')
    .get()
    .catch(() => null);

  const invoices = invSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  // Maintenance tickets
  const ticketsSnap = contract.tenantEmail
    ? await db
        .collection('artifacts').doc(APP_ID)
        .collection('maintenanceTickets')
        .where('tenantEmail', '==', contract.tenantEmail)
        .orderBy('createdAt', 'asc')
        .get()
        .catch(() => null)
    : null;

  const tickets = ticketsSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  // Notifications / mora records
  const notifSnap = await db
    .collection('artifacts').doc(APP_ID)
    .collection('users').doc(adminId)
    .collection('notificaciones')
    .where('contractId', '==', contractId)
    .orderBy('sentAt', 'asc')
    .get()
    .catch(() => null);

  const notifications = notifSnap?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  const scanUrl = polygonScanUrl(txHash);

  return (
    <LegajoClient
      txHash={txHash}
      scanUrl={scanUrl}
      documentHash={documentHash}
      notarizedAt={notarizedAt}
      contract={contract as any}
      invoices={invoices as any[]}
      tickets={tickets as any[]}
      notifications={notifications as any[]}
    />
  );
}
