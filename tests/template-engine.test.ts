import { describe, it, expect } from "vitest";
import { render } from "../src/template-engine.js";

describe("template engine", () => {
  describe("variable replacement", () => {
    it("replaces simple variables", () => {
      expect(render("Hello {%name%}!", { name: "world" })).toBe(
        "Hello world!"
      );
    });

    it("replaces multiple variables", () => {
      const result = render("{%a%} and {%b%}", { a: "foo", b: "bar" });
      expect(result).toBe("foo and bar");
    });

    it("replaces the same variable multiple times", () => {
      const result = render("{%x%} then {%x%}", { x: "val" });
      expect(result).toBe("val then val");
    });

    it("converts booleans to strings", () => {
      expect(render("{%flag%}", { flag: true })).toBe("true");
    });

    it("throws on missing variable", () => {
      expect(() => render("{%missing%}", {})).toThrow(
        "Template variable not found: missing"
      );
    });
  });

  describe("conditional blocks", () => {
    it("keeps content when condition is true", () => {
      const result = render("{%#if show%}visible{%/if%}", { show: true });
      expect(result).toBe("visible");
    });

    it("strips content when condition is false", () => {
      const result = render("{%#if show%}visible{%/if%}", { show: false });
      expect(result).toBe("");
    });

    it("strips content when condition is empty string", () => {
      const result = render("{%#if show%}visible{%/if%}", { show: "" });
      expect(result).toBe("");
    });

    it("handles multiline conditional content", () => {
      const template = `before
{%#if active%}
line 1
line 2
{%/if%}
after`;
      const result = render(template, { active: true });
      expect(result).toContain("line 1");
      expect(result).toContain("line 2");
    });

    it("handles multiple independent conditionals", () => {
      const template = "{%#if a%}A{%/if%} {%#if b%}B{%/if%}";
      expect(render(template, { a: true, b: false })).toBe("A ");
      expect(render(template, { a: false, b: true })).toBe(" B");
      expect(render(template, { a: true, b: true })).toBe("A B");
    });
  });

  describe("unless blocks", () => {
    it("keeps content when condition is false", () => {
      const result = render("{%#unless hide%}visible{%/unless%}", {
        hide: false,
      });
      expect(result).toBe("visible");
    });

    it("strips content when condition is true", () => {
      const result = render("{%#unless hide%}visible{%/unless%}", {
        hide: true,
      });
      expect(result).toBe("");
    });
  });

  describe("blank line cleanup", () => {
    it("collapses triple blank lines to double", () => {
      const result = render("a\n\n\n\nb", {});
      expect(result).toBe("a\n\nb");
    });

    it("preserves double blank lines", () => {
      const result = render("a\n\nb", {});
      expect(result).toBe("a\n\nb");
    });
  });

  describe("nested block detection", () => {
    it("throws on nested {%#if%} blocks", () => {
      const template = "{%#if a%}{%#if b%}inner{%/if%}{%/if%}";
      expect(() => render(template, { a: true, b: true })).toThrow(
        "Nested {%#if%} blocks are not supported"
      );
    });

    it("allows {%#unless%} inside {%#if%} (different block types)", () => {
      const template =
        "{%#if a%}{%#unless b%}visible{%/unless%}{%/if%}";
      expect(render(template, { a: true, b: false })).toBe("visible");
      expect(render(template, { a: true, b: true })).toBe("");
      expect(render(template, { a: false, b: false })).toBe("");
    });
  });

  describe("combined features", () => {
    it("resolves conditionals then variables", () => {
      const template = "{%#if show%}Hello {%name%}{%/if%}";
      const result = render(template, { show: true, name: "world" });
      expect(result).toBe("Hello world");
    });

    it("does not evaluate variables inside stripped blocks", () => {
      const template = "{%#if show%}Hello {%name%}{%/if%}";
      // name is not defined, but block is stripped so no error
      const result = render(template, { show: false });
      expect(result).toBe("");
    });
  });
});
