"use client";

import { useState } from "react";
import type { SubmitEvent } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";

import { getErrorMessage, useLogin } from "../hook/use-auth";

/** The admin login card — email, password, and remember-me, submitted via `useLogin()`. */
export const LoginForm = () => {
  const {mutate, isPending, isError, error} = useLogin();
  const errorMessage = isError
    ? getErrorMessage(error, "Invalid email or password")
    : null;
  // Toggled by the eye icon button to show/hide the password field's input.
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  // Read the form as plain FormData rather than controlled state — the
  // mutation only needs the values at submit time, not on every keystroke.
  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    mutate({
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      rememberMe: formData.get("rememberMe") === "on",
    });
  };

  return (
    <Card className="w-full max-w-sm border shadow-none">
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Sign in with your admin credentials.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={!!errorMessage}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                required
                aria-invalid={!!errorMessage}
              />
            </Field>
            <Field data-invalid={!!errorMessage}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  name="password"
                  type={isPasswordVisible ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  aria-invalid={!!errorMessage}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    size="icon-xs"
                    aria-label={isPasswordVisible ? "Hide password" : "Show password"}
                    onClick={() => setIsPasswordVisible((visible) => !visible)}
                  >
                    {isPasswordVisible ? <EyeOffIcon /> : <EyeIcon />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </Field>
            {errorMessage && <FieldError>{errorMessage}</FieldError>}
            <Field orientation="horizontal">
              <Label htmlFor="rememberMe" className="font-normal">
                <Checkbox id="rememberMe" name="rememberMe" />
                Remember me
              </Label>
            </Field>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "Signing in…" : "Sign in"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
};
