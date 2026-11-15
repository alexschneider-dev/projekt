import {
  act,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  expect,
  it,
} from "vitest";
import { Toaster } from "@/components/ui/toaster";
import {
  useErrorNotification,
  useSuccessNotification,
} from "@/hooks/common/use-error-notification";
import { ERROR_API } from "@/lib/http/errors/common";


it("zeigt deutsche Erfolgs- und Fehlermeldungen und lässt sie schließen", async () => {
  const user = userEvent.setup();
  render(<Toaster />);
  const { result } = renderHook(() => ({
    success: useSuccessNotification(),
    error: useErrorNotification(),
  }));

  act(() => result.current.success());
  expect(screen.getByText("Erfolgreich.")).toBeVisible();
  await user.click(screen.getByLabelText("Meldung schließen"));
  await waitFor(() => expect(screen.queryByText("Erfolgreich.")).not.toBeInTheDocument());

  act(() => result.current.error());
  expect(screen.getByText(ERROR_API.INTERNAL_SERVER_ERROR.message, { selector: "p" })).toBeVisible();
  await user.click(screen.getByLabelText("Meldung schließen"));
  await waitFor(() => expect(screen.queryByText(ERROR_API.INTERNAL_SERVER_ERROR.message, { selector: "p" })).not.toBeInTheDocument());
});
