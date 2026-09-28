import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, Thead, Th, Tr, Td, EmptyRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type OutletSummary = {
  id: string;
  name: string;
  submitted: boolean;
  received: number;
  used: number;
  rejected: number;
  unreconciledCount: number;
};

export function RegionalStockSummary({ outlets }: { outlets: OutletSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Summary Bahan Baku — Hari Ini</CardTitle>
      </CardHeader>
      <Table>
        <Thead>
          <tr>
            <Th>Outlet</Th>
            <Th>Status Stock Check</Th>
            <Th>Barang Masuk</Th>
            <Th>Barang Terpakai</Th>
            <Th>Barang Reject</Th>
            <Th>Variance</Th>
          </tr>
        </Thead>
        <tbody>
          {outlets.map((o) => (
            <Tr key={o.id}>
              <Td className="font-medium text-slate-900">{o.name}</Td>
              <Td>
                <Badge tone={o.submitted ? "success" : "neutral"}>{o.submitted ? "Sudah lapor" : "Belum lapor"}</Badge>
              </Td>
              <Td>{o.received.toLocaleString("id-ID")}</Td>
              <Td>{o.used.toLocaleString("id-ID")}</Td>
              <Td>{o.rejected.toLocaleString("id-ID")}</Td>
              <Td>
                {o.unreconciledCount > 0 ? (
                  <Badge tone="danger">{o.unreconciledCount} selisih</Badge>
                ) : (
                  <Badge tone="success">Reconciled</Badge>
                )}
              </Td>
            </Tr>
          ))}
          {outlets.length === 0 && <EmptyRow colSpan={6}>Belum ada outlet.</EmptyRow>}
        </tbody>
      </Table>
    </Card>
  );
}
