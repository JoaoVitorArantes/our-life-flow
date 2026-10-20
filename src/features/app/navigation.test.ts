import { expect, test } from "vitest";
import { academicNavItems, canViewAcademic } from "./navigation";

const members = [{ user_id: "u-joao" }, { user_id: "u-renifer" }];
const profiles = [
  { id: "u-joao", name: "João Vitor dos Santos" },
  { id: "u-renifer", name: "Renifer Silva" },
];

test("gera um atalho de Faculdade por membro real, com o primeiro nome", () => {
  const items = academicNavItems(members, profiles, "u-joao");
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ to: "/faculdade/u-joao", label: "Faculdade — João" });
  expect(items[1]).toMatchObject({ to: "/faculdade/u-renifer", label: "Faculdade — Renifer" });
});

test("o usuário autenticado vem primeiro mesmo com nomes fora de ordem", () => {
  const items = academicNavItems(members, profiles, "u-renifer");
  expect(items[0]!.to).toBe("/faculdade/u-renifer");
  expect(items[1]!.to).toBe("/faculdade/u-joao");
});

test("membro sem perfil recebe rótulo genérico, sem inventar nome", () => {
  const items = academicNavItems([{ user_id: "u-sem-perfil" }], [], "u-sem-perfil");
  expect(items[0]!.label).toBe("Faculdade — Membro");
});

test("a visão acadêmica só é acessível ao próprio dono", () => {
  expect(canViewAcademic("u-joao", "u-joao")).toBe(true);
  expect(canViewAcademic("u-renifer", "u-joao")).toBe(false);
  expect(canViewAcademic("u-joao", undefined)).toBe(false);
  expect(canViewAcademic(undefined, "u-joao")).toBe(false);
});
