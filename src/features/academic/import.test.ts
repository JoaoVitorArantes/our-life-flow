import { expect, test } from "vitest";
import { parseCsv, parseImport, parseJson } from "./import";
import { courseInputSchema, evaluationInputSchema, sessionInputSchema, termInputSchema } from "./contracts";

test("CSV válido gera prévia com itens validados", () => {
  const csv = [
    "name,code,semester,credits,status,grade,prerequisites,notes",
    "Cálculo I,MAT001,1,4,COMPLETED,72,,\"Revisar limites\"",
    "Algoritmos e Programação,CSI101,1,6,PENDING,,,",
  ].join("\n");
  const preview = parseCsv(csv);
  expect(preview.valid).toBe(2);
  expect(preview.invalid).toBe(0);
  expect(preview.items[0]?.input?.name).toBe("Cálculo I");
  expect(preview.items[0]?.input?.grade).toBe(72);
  expect(preview.items[1]?.input?.status).toBe("PENDING");
});

test("CSV sem coluna name ou com linha inválida é rejeitado na prévia", () => {
  expect(parseCsv("code,semester\nX,1").invalid).toBe(1);
  const bad = parseCsv("name,grade\n,10\nOk,999");
  expect(bad.valid).toBe(0);
  expect(bad.invalid).toBe(2);
});

test("JSON exige lista e valida cada item", () => {
  expect(parseJson("not json").invalid).toBe(1);
  expect(parseJson('{"name":"x"}').invalid).toBe(1);
  const preview = parseJson(
    JSON.stringify([
      { name: "Fundamentos de Marketing", status: "PENDING" },
      { name: "", semester: 1 },
      { name: "Extra", unknown_field: true },
    ]),
  );
  expect(preview.valid).toBe(1);
  expect(preview.invalid).toBe(2);
});

test("status desconhecido na importação vira PENDING, nunca inventa situação", () => {
  const preview = parseImport('name,status\nCálculo I,APROVADO', "csv");
  expect(preview.items[0]?.input?.status).toBe("PENDING");
});

test("contratos rejeitam dados fora dos limites", () => {
  expect(courseInputSchema.safeParse({ name: "", status: "PENDING", prerequisites: [] }).success).toBe(false);
  expect(
    courseInputSchema.safeParse({ name: "X", status: "PENDING", prerequisites: [], grade: 101 }).success,
  ).toBe(false);
  expect(
    termInputSchema.safeParse({
      name: "2025/1",
      starts_on: "2025-08-01",
      ends_on: "2025-01-01",
      enrollment_until: null,
      status: "PLANNED",
    }).success,
  ).toBe(false);
  expect(
    evaluationInputSchema.safeParse({
      course_id: "not-uuid",
      title: "Prova 1",
      kind: "EXAM",
      due_date: null,
      weight: null,
      grade: null,
      status: "PENDING",
    }).success,
  ).toBe(false);
  expect(
    sessionInputSchema.safeParse({
      course_id: crypto.randomUUID(),
      date: "2025-13-01",
      time: null,
      duration_minutes: null,
      topic: null,
      attended: null,
    }).success,
  ).toBe(false);
});
