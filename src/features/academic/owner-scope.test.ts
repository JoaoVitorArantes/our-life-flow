import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * Contrato da migration 0017: a Faculdade é privada por pessoa mesmo dentro do
 * mesmo workspace. O teste lê o SQL aplicado e falha se as garantias regredirem.
 */
const sql = readFileSync("drizzle/migrations/0017_academic_owner_privacy.sql", "utf8");

const TABLES = [
  "academic_terms",
  "academic_courses",
  "academic_evaluations",
  "academic_sessions",
] as const;

test.each(TABLES)("%s tem owner_id obrigatório preenchido a partir de created_by", (table) => {
  expect(sql).toContain(`ALTER TABLE public.${table} ADD COLUMN owner_id uuid;`);
  expect(sql).toContain(`UPDATE public.${table} SET owner_id = created_by;`);
  expect(sql).toContain(`ALTER TABLE public.${table} ALTER COLUMN owner_id SET NOT NULL;`);
});

test.each(TABLES)("%s: SELECT/UPDATE/DELETE exigem dono e membro do workspace", (table) => {
  const using =
    "USING (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())";
  for (const op of ["select", "update", "delete"] as const) {
    const statement = sql.match(
      new RegExp(`CREATE POLICY ${table}_${op} ON public\\.${table}[^;]+;`),
    )?.[0];
    expect(statement, `política ${op} de ${table}`).toBeDefined();
    expect(statement).toContain(using);
  }
});

test.each(TABLES)("%s: INSERT exige owner_id e created_by do próprio usuário", (table) => {
  expect(sql).toContain(`CREATE POLICY ${table}_insert ON public.${table} FOR INSERT`);
  expect(sql).toContain(
    "WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid() AND created_by = auth.uid())",
  );
});

test("UPDATE WITH CHECK impede transferência de dono", () => {
  const withCheck =
    "WITH CHECK (public.user_is_workspace_member(workspace_id) AND owner_id = auth.uid())";
  // Uma ocorrência por tabela ( política de update ).
  expect(sql.split(withCheck).length - 1).toBe(4);
});

test("avaliações e aulas só referenciam disciplina do mesmo dono e workspace", () => {
  expect(sql).toContain(
    "ADD CONSTRAINT academic_courses_id_workspace_owner_key UNIQUE (id, workspace_id, owner_id)",
  );
  for (const table of ["academic_evaluations", "academic_sessions"]) {
    expect(sql).toContain(
      `FOREIGN KEY (course_id, workspace_id, owner_id)\n  REFERENCES public.academic_courses (id, workspace_id, owner_id) ON DELETE CASCADE`,
    );
    expect(sql).toContain(`${table}_course_owner_fkey`);
  }
});

test("disciplina só referencia período do mesmo dono e workspace (trigger)", () => {
  expect(sql).toContain("CREATE OR REPLACE FUNCTION public.validate_academic_term_owner()");
  expect(sql).toContain("t.owner_id = NEW.owner_id");
  expect(sql).toContain("CREATE TRIGGER academic_courses_term_owner");
});

test("as políticas antigas somente por workspace foram substituídas", () => {
  for (const table of TABLES) {
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(sql).toContain(`DROP POLICY ${table}_${op} ON public.${table};`);
    }
  }
});
