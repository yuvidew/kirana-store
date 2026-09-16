"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A button that opens a calendar popover to pick a single date.
 * @param date - The currently selected date, or undefined.
 * @param onDateChange - Called with the newly picked date (or undefined if cleared).
 * @param placeholder - Button text shown when no date is selected.
 */
export const DatePicker = ({
  date,
  onDateChange,
  placeholder = "Pick a date",
}: {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  placeholder?: string;
}) => {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !date && "text-muted-foreground")}
          />
        }
      >
        <CalendarIcon />
        {date ? format(date, "PPP") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={date} onSelect={onDateChange} />
      </PopoverContent>
    </Popover>
  );
};
