import axios from "axios";

import type { DashboardSummaryResponse } from "../types";

export const getDashboardSummary = async () => {
  const { data } = await axios.get<DashboardSummaryResponse>("/api/dashboard/summary");
  return data;
};
