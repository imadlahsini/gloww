import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("./api.js", () => ({ callAdmin: vi.fn().mockResolvedValue({ ok: true }), IMGBB_KEY: "", uploadPhoto: vi.fn() }));

import MenuEditor from "./MenuEditor.jsx";

const data = {
  categories: [
    { id: "spa", name: "Head Spa", image: "", heroImage: "", visible: true, services: [
      { id: 1, name: "Royale", price: 600, duration: "1h", image: "", description: "", visible: true },
    ] },
    { id: "lift", name: "Lifting", image: "", heroImage: "", visible: true, services: [
      { id: 2, name: "Colombien", price: 150, duration: "1h", image: "", description: "", visible: true },
    ] },
  ],
};

describe("MenuEditor", () => {
  it("renders all services and filters by search", async () => {
    render(<MenuEditor initialData={data} password="p" />);
    expect(screen.getByText("Royale")).toBeInTheDocument();
    expect(screen.getByText("Colombien")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Rechercher un soin"), "colomb");
    expect(screen.queryByText("Royale")).not.toBeInTheDocument();
    expect(screen.getByText("Colombien")).toBeInTheDocument();
  });
});
