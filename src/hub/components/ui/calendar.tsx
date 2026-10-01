import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
export type CalendarProps = React.ComponentProps<typeof DayPicker>;
export function Calendar({ className, showOutsideDays = true, ...props }: CalendarProps) {
  return <DayPicker locale={ptBR} showOutsideDays={showOutsideDays} className={cn("p-3", className)} {...props} />;
}
