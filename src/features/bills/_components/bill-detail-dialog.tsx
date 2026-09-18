"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import { DownloadIcon } from "lucide-react";

import { ErrorCard, LoadingCard } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { useBill } from "../hook/use-bills";

// `@react-pdf/renderer`'s render pipeline isn't SSR-safe — loaded client-only
// via next/dynamic, which is allowed here since this file is already
// 'use client' (ssr: false is disallowed only in Server Components).
const BillPdfActions = dynamic(() => import("./bill-pdf-actions").then((mod) => mod.BillPdfActions), {
  ssr: false,
  loading: () => (
    <Button variant="outline" disabled>
      <DownloadIcon />
      Preparing PDF…
    </Button>
  ),
});

/**
 * Dialog showing a bill's receipt: line items, totals, and Download PDF /
 * Share on WhatsApp actions. Opened from the bills list/history table and
 * right after a bill is created — there's no standalone `/bills/[id]` page.
 * @param billId - The bill to show, or `null` when the dialog should be closed.
 * @param onOpenChange - Called when the dialog is opened/dismissed.
 */
export const BillDetailDialog = ({
  billId,
  onOpenChange,
}: {
  billId: number | null;
  onOpenChange: (open: boolean) => void;
}) => {
  const { data: bill, isLoading, isError, refetch } = useBill(billId ?? 0, { enabled: billId !== null });

  return (
    <Dialog open={billId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-y-auto sm:max-w-2xl">
        {isLoading ? (
          <LoadingCard title="Loading bill…" />
        ) : isError || !bill ? (
          <ErrorCard
            title="Couldn't load bill"
            description="Something went wrong loading this bill."
            onRetry={() => refetch()}
          />
        ) : (
          <>
            <DialogHeader className="flex-row items-start justify-between gap-4">
              <div>
                <DialogTitle>Bill #{bill.id}</DialogTitle>
                <p className="text-sm text-muted-foreground">{format(new Date(bill.createdAt), "PPPp")}</p>
              </div>
              <Badge variant={bill.isCredit ? "destructive" : "success"}>{bill.isCredit ? "Udhaar" : "Cash"}</Badge>
            </DialogHeader>

            <div>
              <p className="font-medium">{bill.customerName || "Walk-in customer"}</p>
              {bill.customerPhone && <p className="text-sm text-muted-foreground">{bill.customerPhone}</p>}
            </div>

            <Table className="border">
              <TableHeader className="bg-secondary">
                <TableRow className="divide-x divide-border bg-secondary">
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bill.items.map((item) => (
                  <TableRow key={item.id} className="divide-x divide-border">
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {formatCurrency(item.lineTotal)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="ml-auto flex w-full max-w-56 flex-col gap-1 font-mono text-sm tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>{formatCurrency(bill.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Discount</span>
                <span>-{formatCurrency(bill.discount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Tax</span>
                <span>{formatCurrency(bill.taxAmount)}</span>
              </div>
              <div className="mt-1 flex justify-between border-t pt-1 text-base font-semibold text-foreground">
                <span>Total</span>
                <span>{formatCurrency(bill.totalAmount)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <BillPdfActions bill={bill} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
