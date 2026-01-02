import { describe, it, expect } from "vitest";
import {
  generateId,
  randomFloat,
  randomInt,
  randomChoices,
  shuffleArray,
  clamp,
  mutateValue,
  pickFromParents,
  generateStrategyName,
  nowTimestamp,
} from "../utils.js";

describe("Utils", () => {
  describe("generateId", () => {
    it("generates unique UUIDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });
  });

  describe("randomFloat", () => {
    it("generates floats within range", () => {
      for (let i = 0; i < 100; i++) {
        const value = randomFloat(10, 20);
        expect(value).toBeGreaterThanOrEqual(10);
        expect(value).toBeLessThanOrEqual(20);
      }
    });
  });

  describe("randomInt", () => {
    it("generates integers within range", () => {
      for (let i = 0; i < 100; i++) {
        const value = randomInt(5, 10);
        expect(value).toBeGreaterThanOrEqual(5);
        expect(value).toBeLessThanOrEqual(10);
        expect(Number.isInteger(value)).toBe(true);
      }
    });
  });

  describe("randomChoices", () => {
    it("selects correct number of items", () => {
      const array = ["a", "b", "c", "d", "e"];
      const choices = randomChoices(array, 3);
      expect(choices).toHaveLength(3);
      choices.forEach((c) => expect(array).toContain(c));
    });

    it("does not repeat items", () => {
      const array = ["a", "b", "c", "d", "e"];
      const choices = randomChoices(array, 5);
      const unique = new Set(choices);
      expect(unique.size).toBe(5);
    });
  });

  describe("shuffleArray", () => {
    it("returns array with same elements", () => {
      const array = [1, 2, 3, 4, 5];
      const shuffled = shuffleArray(array);
      expect(shuffled.sort()).toEqual(array.sort());
    });

    it("does not modify original array", () => {
      const array = [1, 2, 3, 4, 5];
      const original = [...array];
      shuffleArray(array);
      expect(array).toEqual(original);
    });
  });

  describe("clamp", () => {
    it("clamps value to min", () => {
      expect(clamp(5, 10, 20)).toBe(10);
    });

    it("clamps value to max", () => {
      expect(clamp(25, 10, 20)).toBe(20);
    });

    it("returns value when within range", () => {
      expect(clamp(15, 10, 20)).toBe(15);
    });
  });

  describe("mutateValue", () => {
    it("mutates value within reasonable range", () => {
      const original = 100;
      let hasDifferent = false;
      
      for (let i = 0; i < 100; i++) {
        const mutated = mutateValue(original);
        if (mutated !== original) {
          hasDifferent = true;
        }
        // Should be within ~50% of original typically
        expect(mutated).toBeGreaterThan(0);
      }
      
      expect(hasDifferent).toBe(true);
    });
  });

  describe("pickFromParents", () => {
    it("returns one of the parent values", () => {
      const parent1 = "alpha";
      const parent2 = "beta";
      
      const choices = new Set<string>();
      for (let i = 0; i < 100; i++) {
        choices.add(pickFromParents(parent1, parent2));
      }
      
      expect(choices.has("alpha") || choices.has("beta")).toBe(true);
      choices.forEach((c) => expect([parent1, parent2]).toContain(c));
    });
  });

  describe("generateStrategyName", () => {
    it("generates valid strategy names", () => {
      const name = generateStrategyName();
      expect(typeof name).toBe("string");
      expect(name.length).toBeGreaterThan(0);
    });

    it("generates unique names", () => {
      const names = new Set<string>();
      for (let i = 0; i < 50; i++) {
        names.add(generateStrategyName());
      }
      // Should have high variety
      expect(names.size).toBeGreaterThan(30);
    });
  });

  describe("nowTimestamp", () => {
    it("returns current timestamp in milliseconds", () => {
      const before = Date.now();
      const timestamp = nowTimestamp();
      const after = Date.now();
      
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });
  });
});
