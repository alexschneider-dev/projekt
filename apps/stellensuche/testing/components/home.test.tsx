import {
  expect,
  it,
} from "vitest";
import {
  render,
  screen,
} from "@testing-library/react";
import { Home } from "@/components/home/home";


it("zeigt Gästen Anmeldung und Registrierung ohne internen Link", () => {
  render(<Home authenticated={false} />);
  expect(screen.getByRole("link", { name: "Anmelden" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Registrieren" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Interner Bereich" })).not.toBeInTheDocument();
});

it("zeigt angemeldeten Benutzern nur den internen Link", () => {
  render(<Home authenticated />);
  expect(screen.getByRole("link", { name: "Interner Bereich" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Anmelden" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Registrieren" })).not.toBeInTheDocument();
});
