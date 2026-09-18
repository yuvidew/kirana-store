"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A button that opens a calendar popover to pick a date range (from/to).
 * @param value - The currently selected range, or undefined.
 * @param onChange - Called with the newly picked range (or undefined if cleared).
 * @param placeholder - Button text shown when no range is selected.
 */
export const DateRangePicker = ({
  value,
  onChange,
  placeholder = "Filter by date",
}: {
  value: DateRange | undefined;
  onChange: (range: DateRange | undefined) => void;
  placeholder?: string;
}) => {
  const label = value?.from
    ? value.to
      ? `${format(value.from, "PP")} – ${format(value.to, "PP")}`
      : format(value.from, "PP")
    : placeholder;

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-auto justify-start font-normal", !value?.from && "text-muted-foreground")}
          />
        }
      >
        <CalendarIcon />
        {label}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="range" selected={value} onSelect={onChange} numberOfMonths={2} />
      </PopoverContent>
    </Popover>
  );
};
