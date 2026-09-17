"use client";

import dynamic from "next/dynamic";
import { format } from "date-fns";
import { DownloadIcon } from "lucide-react";

import { ErrorCard, LoadingCard } from "@/components/query-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
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
 * Receipt view for a generated bill: line items, totals, and Download PDF /
 * Share on WhatsApp actions. Rendered right after a bill is created, and
 * whenever `/bills/[id]` is visited directly.
 * @param id - The bill's id.
 */
export const BillReceiptView = ({ id }: { id: number }) => {
  const { data: bill, isLoading, isError, refetch } = useBill(id);

  if (isLoading) {
    return <LoadingCard title="Loading bill…" className="p-6" />;
  }

  if (isError || !bill) {
    return (
      <ErrorCard
        title="Couldn't load bill"
        description="Something went wrong loading this bill."
        onRetry={() => refetch()}
        className="p-6"
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <h1 className="font-heading text-xl font-semibold tracking-tight">Bill #{bill.id}</h1>
            <p className="text-sm text-muted-foreground">{format(new Date(bill.createdAt), "PPPp")}</p>
          </div>
          <Badge variant={bill.isCredit ? "destructive" : "success"}>{bill.isCredit ? "Udhaar" : "Cash"}</Badge>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
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
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.unitPrice)}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums">{formatCurrency(item.lineTotal)}</TableCell>
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
        </CardContent>
        <CardFooter className="flex gap-2">
          <BillPdfActions bill={bill} />
        </CardFooter>
      </Card>
    </div>
  );
};
