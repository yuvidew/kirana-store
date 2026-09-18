import axios from "axios";

import type { BillResponse, BillsQuery, BillsResponse } from "../types";

export const allBills = async (query: BillsQuery) => {
  const { data } = await axios.get<BillsResponse>("/api/bills", {
    params: {
      search: query.search || undefined,
      payment: query.payment,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      page: query.page,
      pageSize: query.pageSize,
    },
  });
  return data;
};

export const getBill = async (id: number) => {
  const { data } = await axios.get<BillResponse>(`/api/bills/${id}`);
  return data.bill;
};
