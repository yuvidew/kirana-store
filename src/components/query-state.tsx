import { AlertTriangleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

/**
 * Centered card shown while a query is loading. Shared across features so
 * every list/detail page gets the same loading treatment.
 * @param title - Main message (defaults to "Loading…").
 * @param description - Optional supporting text.
 * @param className - Extra classes for the centering wrapper.
 */
export const LoadingCard = ({
  title = "Loading…",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) => {
  return (
    <div className={cn("flex min-h-64 items-center justify-center", className)}>
      <Card className="w-full max-w-sm border shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <Spinner className="size-6" />
          <div>
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Centered card shown when a query fails. Shared across features so every
 * list/detail page gets the same error treatment.
 * @param title - Main message (defaults to "Something went wrong").
 * @param description - Optional supporting text, e.g. the error message.
 * @param onRetry - If given, renders a "Try again" button that calls it.
 * @param className - Extra classes for the centering wrapper.
 */
export const ErrorCard = ({
  title = "Something went wrong",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) => {
  return (
    <div className={cn("flex min-h-64 items-center justify-center", className)}>
      <Card className="w-full max-w-sm border-destructive/30 shadow-none">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertTriangleIcon className="size-6 text-destructive" />
          <div>
            <p className="font-medium">{title}</p>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {onRetry && (
            <Button variant="outline" onClick={onRetry}>
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
