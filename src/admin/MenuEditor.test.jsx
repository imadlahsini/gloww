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

  it("discards a newly added service when closed without edits", async () => {
    render(<MenuEditor initialData={data} password="p" />);
    await userEvent.click(screen.getAllByText("+ Ajouter un soin")[0]);
    expect(screen.getByDisplayValue("Nouveau soin")).toBeInTheDocument();
    await userEvent.click(screen.getByText("Terminé"));
    expect(screen.queryByText("Nouveau soin")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("Nouveau soin")).not.toBeInTheDocument();
  });

  it("keeps a newly added service when a field is edited", async () => {
    render(<MenuEditor initialData={data} password="p" />);
    await userEvent.click(screen.getAllByText("+ Ajouter un soin")[0]);
    const nameInput = screen.getByDisplayValue("Nouveau soin");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Massage");
    await userEvent.click(screen.getByText("Terminé"));
    expect(screen.getByText("Massage")).toBeInTheDocument();
  });
});
