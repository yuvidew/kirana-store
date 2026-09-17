import axios from "axios";

import type { CreateBillInput, CreateBillResponse } from "../types";

export const createBill = async (input: CreateBillInput) => {
  const { data } = await axios.post<CreateBillResponse>("/api/bills", input);
  return data.bill;
};
