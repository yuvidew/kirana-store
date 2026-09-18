import { format } from "date-fns";
import { ReceiptTextIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { BillListItem } from "../types";

/**
 * Bills list/history table. Each row's action button opens the bill's
 * receipt in a `BillDetailDialog` (owned by the caller) instead of
 * navigating to a separate page — no bill mutation happens from this table.
 * @param bills - The rows to render (already filtered/paginated by the caller).
 * @param onView - Called with a bill's id when its row action is clicked.
 */
export const BillsTable = ({ bills, onView }: { bills: BillListItem[]; onView: (id: number) => void }) => {
  return (
    <Table className="border bg-card p-3">
      <TableHeader className="bg-secondary">
        <TableRow className="divide-x divide-border bg-secondary">
          <TableHead>Bill ID</TableHead>
          <TableHead>Date &amp; time</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead className="text-right">Items</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-center">Payment</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {bills.map((bill) => (
          <TableRow key={bill.id} className="divide-x divide-border">
            <TableCell className="font-mono tabular-nums">#{bill.id}</TableCell>
            <TableCell className="font-mono tabular-nums">{format(new Date(bill.createdAt), "PPp")}</TableCell>
            <TableCell>
              <div className="flex flex-col">
                <span className="font-medium">{bill.customerName || "Walk-in customer"}</span>
                {bill.customerPhone && <span className="text-xs text-muted-foreground">{bill.customerPhone}</span>}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{bill.itemCount}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatCurrency(bill.totalAmount)}</TableCell>
            <TableCell className="text-center">
              <Badge variant={bill.isCredit ? "destructive" : "success"}>{bill.isCredit ? "Udhaar" : "Cash"}</Badge>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`View bill #${bill.id}`}
                onClick={() => onView(bill.id)}
              >
                <ReceiptTextIcon />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
