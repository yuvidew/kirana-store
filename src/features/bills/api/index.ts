import axios from "axios";

import type { BillResponse } from "../types";

export const getBill = async (id: number) => {
  const { data } = await axios.get<BillResponse>(`/api/bills/${id}`);
  return data.bill;
};
