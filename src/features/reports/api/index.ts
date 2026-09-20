import axios from "axios";

import type { ReportsQuery, ReportsSummaryResponse } from "../types";

/** Fetches the reports summary (period totals, daily series, stock movement, top products) for a date range. */
export const getReportsSummary = async (query: ReportsQuery) => {
  const { data } = await axios.get<ReportsSummaryResponse>("/api/reports/summary", {
    params: { dateFrom: query.dateFrom, dateTo: query.dateTo },
  });
  return data;
};
