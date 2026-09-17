import { BillReceiptView } from "@/features/bills/_components/bill-receipt-view";

/** /bills/[id] — a single bill's receipt: line items, totals, PDF download, WhatsApp share. */
const BillPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return <BillReceiptView id={Number(id)} />;
};

export default BillPage;
