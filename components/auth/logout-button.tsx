"use client";

import { ROUTES } from "@/lib/constants/routes";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";


export function LogoutButton() {
  return (
    <Button
      variant="outline"
      onClick={() => void signOut({ callbackUrl: ROUTES.login })}
    >
      Abmelden
    </Button>
  );
}
