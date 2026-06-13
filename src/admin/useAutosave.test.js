import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const saveMock = vi.fn();
vi.mock("./api.js", () => ({ callAdmin: (...a) => saveMock(...a) }));

import { useAutosave } from "./useAutosave.js";

const base = { categories: [{ id: "c", name: "C", image: "", heroImage: "", visible: true, services: [] }] };

beforeEach(() => {
  vi.useFakeTimers();
  saveMock.mockReset();
  saveMock.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useAutosave", () => {
  it("batches rapid mutations into one save after the debounce", async () => {
    const { result } = renderHook(() => useAutosave({ initialData: base, password: "p", delay: 2000 }));

    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "A" }] })); });
    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "B" }] })); });

    expect(result.current.data.categories[0].name).toBe("B");
    expect(saveMock).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(saveMock).toHaveBeenCalledWith({ action: "save", password: "p", data: result.current.data });
    expect(result.current.status).toBe("saved");
  });

  it("sets status to error when the save fails", async () => {
    saveMock.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useAutosave({ initialData: base, password: "p", delay: 1000 }));
    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "Z" }] })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(result.current.status).toBe("error");
  });

  it("undo restores the previous data and re-saves", async () => {
    const { result } = renderHook(() => useAutosave({ initialData: base, password: "p", delay: 500 }));
    act(() => { result.current.mutate((d) => ({ ...d, categories: [{ ...d.categories[0], name: "New" }] })); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(result.current.canUndo).toBe(true);

    act(() => { result.current.undo(); });
    expect(result.current.data.categories[0].name).toBe("C");
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(saveMock).toHaveBeenCalledTimes(2);
  });
});
