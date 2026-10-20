import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

/**
 * Contrato das migrations 0017 + 0018: a Faculdade é compartilhada entre membros
 * do workspace, com separação por aluno (owner_id). O teste lê o SQL aplicado e
 * falha se as garantias regredirem.
 */
const sql0017 = readFileSync("drizzle/migrations/0017_academic_owner_privacy.sql", "utf8");
const sql0018 = readFileSync("drizzle/migrations/0018_academic_shared_members.sql", "utf8");

const TABLES = [
  "academic_terms",
  "academic_courses",
  "academic_evaluations",
  "academic_sessions",
] as const;

test.each(TABLES)(
  "%s tem owner_id obrigatório preenchido a partir de created_by (0017)",
  (table) => {
    expect(sql0017).toContain(`ALTER TABLE public.${table} ADD COLUMN owner_id uuid;`);
    expect(sql0017).toContain(`UPDATE public.${table} SET owner_id = created_by;`);
    expect(sql0017).toContain(`ALTER TABLE public.${table} ALTER COLUMN owner_id SET NOT NULL;`);
  },
);

test.each(TABLES)(
  "%s: SELECT/UPDATE/DELETE por membro do workspace, sem filtro de dono",
  (table) => {
    for (const op of ["select", "update", "delete"] as const) {
      const statement = sql0018.match(
        new RegExp(`CREATE POLICY ${table}_${op} ON public\\.${table}[^;]+;`),
      )?.[0];
      expect(statement, `política ${op} de ${table}`).toBeDefined();
      expect(statement).toContain("USING (public.user_is_workspace_member(workspace_id))");
      expect(statement).not.toContain("owner_id = auth.uid()");
    }
  },
);

test.each(TABLES)(
  "%s: INSERT exige membro do workspace e created_by da sessão (dono via FK)",
  (table) => {
    const statement = sql0018.match(
      new RegExp(`CREATE POLICY ${table}_insert ON public\\.${table}[^;]+;`),
    )?.[0];
    expect(statement).toBeDefined();
    expect(statement).toContain(
      "WITH CHECK (public.user_is_workspace_member(workspace_id) AND created_by = auth.uid())",
    );
  },
);

test.each(TABLES)(
  "%s: owner_id precisa ser membro real do mesmo workspace (FK composta)",
  (table) => {
    expect(sql0018).toContain(
      `ADD CONSTRAINT ${table}_owner_member_fkey\n  FOREIGN KEY (workspace_id, owner_id)\n  REFERENCES public.workspace_members (workspace_id, user_id)`,
    );
  },
);

test("as políticas por dono da 0017 foram substituídas na 0018", () => {
  for (const table of TABLES) {
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(sql0018).toContain(`DROP POLICY ${table}_${op} ON public.${table};`);
    }
  }
});

test("avaliações e aulas só referenciam disciplina do mesmo dono e workspace (preservado)", () => {
  expect(sql0017).toContain(
    "ADD CONSTRAINT academic_courses_id_workspace_owner_key UNIQUE (id, workspace_id, owner_id)",
  );
  for (const table of ["academic_evaluations", "academic_sessions"]) {
    expect(sql0017).toContain(
      `FOREIGN KEY (course_id, workspace_id, owner_id)\n  REFERENCES public.academic_courses (id, workspace_id, owner_id) ON DELETE CASCADE`,
    );
    expect(sql0017).toContain(`${table}_course_owner_fkey`);
  }
  expect(sql0018).not.toContain("academic_evaluations_course_owner_fkey");
  expect(sql0018).not.toContain("academic_sessions_course_owner_fkey");
});

test("disciplina só referencia período do mesmo dono e workspace (trigger preservado)", () => {
  expect(sql0017).toContain("CREATE OR REPLACE FUNCTION public.validate_academic_term_owner()");
  expect(sql0017).toContain("t.owner_id = NEW.owner_id");
  expect(sql0017).toContain("CREATE TRIGGER academic_courses_term_owner");
  expect(sql0018).not.toContain("DROP TRIGGER");
  expect(sql0018).not.toContain("DROP FUNCTION");
});
