"use client";

import { usePDF } from "@react-pdf/renderer";
import { DownloadIcon, MessageCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

import type { Bill } from "../types";
import { BillPdfDocument } from "./bill-pdf-document";

const buildWhatsAppMessage = (billId: number, totalAmount: string) =>
  `Hi! Here's your bill #${billId} from Kirana Store. Total: ${formatCurrency(totalAmount)}. Thank you for shopping with us!`;

/**
 * Download/share actions for a bill's PDF — rendered client-only (via
 * next/dynamic with `ssr: false` in bill-receipt-view.tsx), since
 * `@react-pdf/renderer`'s render pipeline isn't SSR-safe.
 * @param bill - The bill to render and share.
 */
export const BillPdfActions = ({ bill }: { bill: Bill }) => {
  const [instance] = usePDF({ document: <BillPdfDocument bill={bill} /> });

  const handleShare = async () => {
    const message = buildWhatsAppMessage(bill.id, bill.totalAmount);
    const phoneDigits = bill.customerPhone?.replace(/\D/g, "") ?? "";

    // Best-effort clipboard copy — a recovery path in case WhatsApp doesn't
    // land on the right chat with the text prefilled (platform-dependent).
    try {
      await navigator.clipboard.writeText(message);
      toast.add({
        title: "Message copied",
        description: "Also copied to your clipboard — paste it (Ctrl+V) if WhatsApp doesn't fill it in automatically.",
        type: "info",
      });
    } catch {
      // Clipboard access can silently fail (permissions, non-HTTPS) — not
      // worth surfacing an error for a background convenience feature.
    }

    window.open(`https://wa.me/${phoneDigits}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <Button
        variant="outline"
        disabled={instance.loading || !instance.url}
        nativeButton={false}
        render={<a href={instance.url ?? undefined} download={`bill-${bill.id}.pdf`} />}
      >
        <DownloadIcon />
        {instance.loading ? "Preparing PDF…" : "Download PDF"}
      </Button>
      <Button onClick={handleShare}>
        <MessageCircleIcon />
        Share on WhatsApp
      </Button>
    </>
  );
};
