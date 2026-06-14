export function nextServiceId(data) {
  const ids = data.categories.flatMap((c) => (c.services || []).map((s) => s.id));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

export function updateService(data, catId, serviceId, updates) {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === catId
        ? { ...c, services: (c.services || []).map((s) => (s.id === serviceId ? { ...s, ...updates } : s)) }
        : c,
    ),
  };
}

export function addService(data, catId, service) {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === catId ? { ...c, services: [...(c.services || []), service] } : c,
    ),
  };
}

export function removeService(data, catId, serviceId) {
  return {
    ...data,
    categories: data.categories.map((c) =>
      c.id === catId ? { ...c, services: (c.services || []).filter((s) => s.id !== serviceId) } : c,
    ),
  };
}

// Derived story gallery; legacy fallback to [image]. Shared with the public viewer.
export function galleryImages(service) {
  const imgs = (Array.isArray(service?.images) ? service.images : []).filter(Boolean);
  return imgs.length ? imgs : service?.image ? [service.image] : [];
}

// The ONLY writer for a service's gallery. Enforces both invariants in one place:
// image === images[0], and images is omitted (not []) when there are 0 or 1 photos.
export function setServiceImages(data, catId, serviceId, images) {
  const clean = (images || []).filter(Boolean);
  const updates =
    clean.length >= 2
      ? { image: clean[0], images: clean }
      : { image: clean[0] || "", images: undefined };
  return updateService(data, catId, serviceId, updates);
}

export function updateCategory(data, catId, updates) {
  return {
    ...data,
    categories: data.categories.map((c) => (c.id === catId ? { ...c, ...updates } : c)),
  };
}

export function addCategory(data, category) {
  return { ...data, categories: [...data.categories, category] };
}

export function removeCategory(data, catId) {
  return { ...data, categories: data.categories.filter((c) => c.id !== catId) };
}

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code < 0x300 || code > 0x36f;
    })
    .join("");
}

export function matchesQuery(service, query) {
  const q = normalize(query).trim();
  if (!q) return true;
  return normalize(service.name).includes(q);
}

export function filterData(data, query) {
  if (!normalize(query).trim()) return data;
  return {
    ...data,
    categories: data.categories
      .map((c) => ({ ...c, services: (c.services || []).filter((s) => matchesQuery(s, query)) }))
      .filter((c) => c.services.length > 0),
  };
}
