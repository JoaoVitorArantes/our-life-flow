import { expect, test } from "vitest";
import { academicProfileInputSchema } from "./contracts";

test("perfil acadêmico aceita tudo não informado (nada é presumido)", () => {
  const parsed = academicProfileInputSchema.parse({
    institution: null,
    course_name: null,
    curriculum: null,
    admission_year: null,
  });
  expect(parsed).toEqual({
    institution: null,
    course_name: null,
    curriculum: null,
    admission_year: null,
  });
});

test("perfil acadêmico aceita dados parciais e rejeita ano inválido", () => {
  expect(
    academicProfileInputSchema.parse({
      institution: "UFU",
      course_name: null,
      curriculum: null,
      admission_year: 2025,
    }).institution,
  ).toBe("UFU");
  expect(() =>
    academicProfileInputSchema.parse({
      institution: null,
      course_name: null,
      curriculum: null,
      admission_year: 1800,
    }),
  ).toThrow();
});

test("perfil acadêmico rejeita campos fora do contrato", () => {
  expect(() =>
    academicProfileInputSchema.parse({
      institution: null,
      course_name: null,
      curriculum: null,
      admission_year: null,
      university: "x",
    }),
  ).toThrow();
});
