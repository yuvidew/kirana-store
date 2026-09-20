"use client";

import type { DateRange } from "react-day-picker";

import { DateRangePicker } from "@/components/date-range-picker";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

export type PeriodPreset = "week" | "month" | "custom";

/**
 * Period picker for the Reports page: "This week"/"This month" preset
 * buttons plus a custom DateRangePicker.
 * @param preset - Which preset is currently active ("custom" once the user
 * picks their own range via the DateRangePicker).
 * @param onPresetSelect - Called with "week" or "month" when a preset button is clicked.
 * @param dateRange - The range currently shown in the DateRangePicker.
 * @param onDateRangeChange - Called with the user's custom picked range.
 */
export const PeriodSelector = ({
  preset,
  onPresetSelect,
  dateRange,
  onDateRangeChange,
}: {
  preset: PeriodPreset;
  onPresetSelect: (preset: "week" | "month") => void;
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ButtonGroup>
        <Button variant={preset === "week" ? "default" : "outline"} onClick={() => onPresetSelect("week")}>
          This week
        </Button>
        <Button variant={preset === "month" ? "default" : "outline"} onClick={() => onPresetSelect("month")}>
          This month
        </Button>
      </ButtonGroup>
      <DateRangePicker value={dateRange} onChange={onDateRangeChange} placeholder="Custom range" />
    </div>
  );
};
