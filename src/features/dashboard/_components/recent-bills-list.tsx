import { format } from "date-fns";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

import type { RecentBillItem } from "../types";

/**
 * The most recent bills, each linking to its receipt page.
 * @param bills - The recent bills to list, newest first.
 */
export const RecentBillsList = ({ bills }: { bills: RecentBillItem[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent bills</CardTitle>
      </CardHeader>
      <CardContent>
        {bills.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">No bills yet — create your first bill.</p>
            <Button size="sm" render={<Link href="/billing" />}>
              Go to Billing
            </Button>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {bills.map((bill) => (
              <li key={bill.id}>
                <Link href={`/bills/${bill.id}`} className="flex items-center justify-between gap-2 text-sm hover:underline">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{bill.customerName ?? "Walk-in"}</span>
                    {bill.isCredit && <Badge variant="secondary">Udhaar</Badge>}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="font-mono tabular-nums">{formatCurrency(bill.totalAmount)}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(bill.createdAt), "PPp")}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};
