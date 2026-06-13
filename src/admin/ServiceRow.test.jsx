import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ServiceRow from "./ServiceRow.jsx";

const svc = { id: 1, name: "Soin hydratant", price: 450, duration: "45m", image: "", description: "", visible: true };

describe("ServiceRow", () => {
  it("shows name and price and fires onToggle / onOpen", async () => {
    const onToggle = vi.fn();
    const onOpen = vi.fn();
    render(<ServiceRow service={svc} onToggle={onToggle} onOpen={onOpen} />);

    expect(screen.getByText("Soin hydratant")).toBeInTheDocument();
    expect(screen.getByText(/450/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByText(/450/));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("marks hidden services with aria-checked false", () => {
    render(<ServiceRow service={{ ...svc, visible: false }} onToggle={() => {}} onOpen={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
