import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { format } from "date-fns";

import { formatCurrency } from "@/lib/utils";
import type { Bill } from "../types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, marginBottom: 4 },
  meta: { color: "#666", marginBottom: 16 },
  section: { marginBottom: 16 },
  label: { color: "#666" },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  table: { borderTopWidth: 1, borderTopColor: "#ddd" },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingVertical: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", paddingVertical: 4 },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: "right" },
  colPrice: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1, textAlign: "right" },
  totals: { marginTop: 16, alignSelf: "flex-end", width: 200 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 2 },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: "#333" },
});

/**
 * The `@react-pdf/renderer` document definition for a bill's downloadable
 * invoice — its own renderer (not regular DOM JSX), used by
 * `bill-receipt-view.tsx`'s "Download PDF" button.
 * @param bill - The bill to render.
 */
export const BillPdfDocument = ({ bill }: { bill: Bill }) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Kirana Store — Invoice #{bill.id}</Text>
        <Text style={styles.meta}>{format(new Date(bill.createdAt), "PPPp")}</Text>

        <View style={styles.section}>
          <Text>{bill.customerName || "Walk-in customer"}</Text>
          {bill.customerPhone && <Text style={styles.label}>{bill.customerPhone}</Text>}
          <Text style={styles.label}>{bill.isCredit ? "Udhaar (credit)" : "Cash"}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={styles.colName}>Item</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Price</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {bill.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colName}>{item.productName}</Text>
              <Text style={styles.colQty}>
                {item.quantity} {item.unit}
              </Text>
              <Text style={styles.colPrice}>{formatCurrency(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{formatCurrency(item.lineTotal)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.label}>Subtotal</Text>
            <Text>{formatCurrency(bill.subtotal)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.label}>Discount</Text>
            <Text>-{formatCurrency(bill.discount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.label}>Tax</Text>
            <Text>{formatCurrency(bill.taxAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text>Total</Text>
            <Text>{formatCurrency(bill.totalAmount)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
