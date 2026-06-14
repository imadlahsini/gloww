import { describe, it, expect } from "vitest";
import {
  nextServiceId,
  updateService,
  addService,
  removeService,
  galleryImages,
  setServiceImages,
  updateCategory,
  addCategory,
  removeCategory,
  matchesQuery,
  filterData,
} from "./data.js";

const sample = () => ({
  categories: [
    {
      id: "head-spa",
      name: "Head Spa",
      image: "i",
      heroImage: "h",
      visible: true,
      services: [
        { id: 1, name: "Royale", price: 600, duration: "1h", image: "x", description: "", visible: true },
        { id: 2, name: "Detox", price: 300, duration: "30m", image: "y", description: "", visible: false },
      ],
    },
    {
      id: "lifting",
      name: "Lifting",
      image: "i2",
      heroImage: "h2",
      visible: true,
      services: [{ id: 5, name: "Colombien", price: 150, duration: "1h", image: "z", description: "", visible: true }],
    },
  ],
});

describe("nextServiceId", () => {
  it("is max existing id + 1 across all categories", () => {
    expect(nextServiceId(sample())).toBe(6);
  });
  it("is 1 when there are no services", () => {
    expect(nextServiceId({ categories: [] })).toBe(1);
  });
});

describe("updateService", () => {
  it("changes only the targeted service and does not mutate input", () => {
    const data = sample();
    const next = updateService(data, "head-spa", 1, { price: 650 });
    expect(next.categories[0].services[0].price).toBe(650);
    expect(data.categories[0].services[0].price).toBe(600);
  });
});

describe("addService", () => {
  it("appends a service to the category", () => {
    const next = addService(sample(), "lifting", { id: 6, name: "X", price: 0, duration: "1h", image: "", description: "", visible: true });
    expect(next.categories[1].services).toHaveLength(2);
    expect(next.categories[1].services[1].id).toBe(6);
  });
});

describe("removeService", () => {
  it("removes the targeted service", () => {
    const next = removeService(sample(), "head-spa", 2);
    expect(next.categories[0].services.map((s) => s.id)).toEqual([1]);
  });
});

describe("updateCategory", () => {
  it("changes only the targeted category", () => {
    const next = updateCategory(sample(), "lifting", { name: "Lift" });
    expect(next.categories[1].name).toBe("Lift");
    expect(next.categories[0].name).toBe("Head Spa");
  });
});

describe("addCategory / removeCategory", () => {
  it("adds then removes by id", () => {
    const cat = { id: "cat-x", name: "New", image: "", heroImage: "", visible: true, services: [] };
    const added = addCategory(sample(), cat);
    expect(added.categories).toHaveLength(3);
    const removed = removeCategory(added, "cat-x");
    expect(removed.categories).toHaveLength(2);
  });
});

describe("matchesQuery", () => {
  it("is case- and accent-insensitive on the name", () => {
    expect(matchesQuery({ name: "Détox" }, "detox")).toBe(true);
    expect(matchesQuery({ name: "Royale" }, "xyz")).toBe(false);
  });
  it("matches everything on empty query", () => {
    expect(matchesQuery({ name: "anything" }, "")).toBe(true);
  });
});

describe("filterData", () => {
  it("returns all categories unchanged on empty query", () => {
    expect(filterData(sample(), "")).toEqual(sample());
  });
  it("keeps only matching services and drops empty categories when querying", () => {
    const out = filterData(sample(), "colombien");
    expect(out.categories).toHaveLength(1);
    expect(out.categories[0].id).toBe("lifting");
    expect(out.categories[0].services).toHaveLength(1);
  });
});

describe("galleryImages", () => {
  it("falls back to [image] for a legacy service with no images", () => {
    expect(galleryImages({ image: "x" })).toEqual(["x"]);
  });
  it("returns the images array when present", () => {
    expect(galleryImages({ image: "a", images: ["a", "b"] })).toEqual(["a", "b"]);
  });
  it("returns [] when neither image nor images exists", () => {
    expect(galleryImages({})).toEqual([]);
  });
});

describe("setServiceImages", () => {
  // assert on the serialized form, which is what actually persists (drops images:undefined)
  const persistedService = (data) => JSON.parse(JSON.stringify(data)).categories[0].services[0];

  it("with 2+ photos sets image=images[0] and keeps the array", () => {
    const s = persistedService(setServiceImages(sample(), "head-spa", 1, ["a", "b", "c"]));
    expect(s.image).toBe("a");
    expect(s.images).toEqual(["a", "b", "c"]);
  });
  it("with exactly 1 photo sets image and omits the images key", () => {
    const s = persistedService(setServiceImages(sample(), "head-spa", 1, ["only"]));
    expect(s.image).toBe("only");
    expect("images" in s).toBe(false);
  });
  it("with 0 photos clears image and omits the images key", () => {
    const s = persistedService(setServiceImages(sample(), "head-spa", 1, []));
    expect(s.image).toBe("");
    expect("images" in s).toBe(false);
  });
  it("drops empty URLs so a leading empty string never becomes the cover", () => {
    const s = persistedService(setServiceImages(sample(), "head-spa", 1, ["", "real"]));
    expect(s.image).toBe("real");
    expect("images" in s).toBe(false);
  });
  it("does not mutate the input data", () => {
    const data = sample();
    setServiceImages(data, "head-spa", 1, ["a", "b"]);
    expect(data.categories[0].services[0].image).toBe("x");
    expect("images" in data.categories[0].services[0]).toBe(false);
  });
});
