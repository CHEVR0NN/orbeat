import { describe, it, expect } from "vitest";
import { topGenre } from "./profileStats";

describe("topGenre", () => {
  it("returns null for empty input", () => {
    expect(topGenre({})).toBeNull();
  });

  it("returns the only tag for a single artist", () => {
    expect(topGenre({ Radiohead: [{ name: "alternative", count: 100 }] })).toBe("alternative");
  });

  it("aggregates tag counts across multiple artists", () => {
    const tagsByArtist = {
      Radiohead: [
        { name: "alternative", count: 50 },
        { name: "electronic", count: 10 },
      ],
      "Aphex Twin": [
        { name: "electronic", count: 60 },
        { name: "idm", count: 20 },
      ],
    };
    // electronic: 10 + 60 = 70, alternative: 50, idm: 20 -> electronic wins
    expect(topGenre(tagsByArtist)).toBe("electronic");
  });

  it("keeps the first-seen tag when totals tie", () => {
    const tagsByArtist = {
      Radiohead: [{ name: "alternative", count: 50 }],
      "Aphex Twin": [{ name: "electronic", count: 50 }],
    };
    expect(topGenre(tagsByArtist)).toBe("alternative");
  });
});
