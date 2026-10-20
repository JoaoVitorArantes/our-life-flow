import { expect, test } from "vitest";
import { academicNavItems, isAcademicMember } from "./navigation";

const members = [{ user_id: "u-joao" }, { user_id: "u-renifer" }];
const profiles = [
  { id: "u-joao", name: "João Vitor dos Santos" },
  { id: "u-renifer", name: "Renifer Silva" },
];

test("gera um subitem de Faculdade por membro real, rotulado com o primeiro nome", () => {
  const items = academicNavItems(members, profiles, "u-joao");
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({ to: "/faculdade/u-joao", label: "João" });
  expect(items[1]).toMatchObject({ to: "/faculdade/u-renifer", label: "Renifer" });
});

test("o usuário autenticado vem primeiro mesmo com nomes fora de ordem", () => {
  const items = academicNavItems(members, profiles, "u-renifer");
  expect(items[0]!.to).toBe("/faculdade/u-renifer");
  expect(items[1]!.to).toBe("/faculdade/u-joao");
});

test("membro sem perfil recebe rótulo genérico, sem inventar nome", () => {
  const items = academicNavItems([{ user_id: "u-sem-perfil" }], [], "u-sem-perfil");
  expect(items[0]!.label).toBe("Membro");
});

test("qualquer membro do workspace abre os dois perfis acadêmicos", () => {
  expect(isAcademicMember("u-joao", members)).toBe(true);
  expect(isAcademicMember("u-renifer", members)).toBe(true);
});

test("ownerId fora do workspace cai no estado sem acesso", () => {
  expect(isAcademicMember("u-estranho", members)).toBe(false);
  expect(isAcademicMember(undefined, members)).toBe(false);
  expect(isAcademicMember("u-joao", [])).toBe(false);
});
