import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  Lock,
  Upload,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel, PanelTitle } from "@/components/common/page";
import { EmptyState } from "@/components/common/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/features/app/app-context";
import { firstName, isAcademicMember } from "@/features/app/navigation";
import {
  COURSE_STATUSES,
  EVALUATION_KINDS,
  KNOWN_PENDING_COURSES,
  PROGRAM_INFO,
  courseStatusLabel,
  evaluationKindLabel,
  type CourseStatus,
  type EvaluationKind,
} from "@/features/academic/contracts";
import {
  createCourse,
  createEvaluation,
  createSession,
  createTerm,
  markAttendance,
  seedKnownPendingCourses,
  updateCourse,
} from "@/features/academic/mutations";
import {
  attendanceFromSessions,
  useAcademicCourses,
  useAcademicEvaluations,
  useAcademicSessions,
  useAcademicTerms,
  type AcademicCourse,
} from "@/features/academic/queries";
import { parseImport, type ImportPreview } from "@/features/academic/import";
import { formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/faculdade_/$ownerId")({
  head: () => ({
    meta: [
      { title: "Faculdade — Life OS" },
      {
        name: "description",
        content: "Disciplinas, avaliações, frequência e progresso acadêmico.",
      },
      { property: "og:title", content: "Faculdade — Life OS" },
      { property: "og:description", content: "Sua rotina acadêmica no Life OS." },
    ],
  }),
  component: Faculdade,
});

const NONE = "__none__";

function Faculdade() {
  const { ownerId } = Route.useParams();
  const { workspaceId, userId, members, memberProfiles } = useApp();
  // Faculdade compartilhada: qualquer membro abre os dois perfis; o estado
  // "Sem acesso" só aparece para um ownerId que não é membro do workspace.
  const allowed = isAcademicMember(ownerId, members);
  const scopedOwnerId = allowed ? ownerId : undefined;
  const ownerName = firstName(memberProfiles.find((p) => p.id === ownerId)?.name, "Membro");
  const queryClient = useQueryClient();
  const { data: terms = [] } = useAcademicTerms(workspaceId, scopedOwnerId);
  const { data: courses = [] } = useAcademicCourses(workspaceId, scopedOwnerId);
  const { data: evaluations = [] } = useAcademicEvaluations(workspaceId, scopedOwnerId);
  const { data: sessions = [] } = useAcademicSessions(workspaceId, scopedOwnerId);

  const [courseDialog, setCourseDialog] = useState<AcademicCourse | "new" | null>(null);
  const [termDialog, setTermDialog] = useState(false);
  const [evaluationDialog, setEvaluationDialog] = useState(false);
  const [sessionDialog, setSessionDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);

  const invalidate = () =>
    Promise.all(
      ["academic_terms", "academic_courses", "academic_evaluations", "academic_sessions"].map((k) =>
        queryClient.invalidateQueries({ queryKey: [k] }),
      ),
    );

  const seedPendings = useMutation({
    mutationFn: async () => {
      if (!workspaceId || !userId || !scopedOwnerId) throw new Error("Selecione um espaço.");
      return seedKnownPendingCourses(
        workspaceId,
        scopedOwnerId,
        userId,
        KNOWN_PENDING_COURSES,
        courses.map((c) => c.name),
      );
    },
    onSuccess: async (created) => {
      await invalidate();
      toast.success(
        created
          ? `${created} pendência(s) registrada(s) como informação sua.`
          : "As pendências conhecidas já estão registradas.",
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível registrar."),
  });

  const bySemester = useMemo(() => {
    const groups = new Map<string, AcademicCourse[]>();
    for (const course of courses) {
      const key = course.semester ? `${course.semester}º semestre` : "Sem semestre definido";
      groups.set(key, [...(groups.get(key) ?? []), course]);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const na = Number.parseInt(a, 10);
      const nb = Number.parseInt(b, 10);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return na - nb;
    });
  }, [courses]);

  const progress = useMemo(() => {
    const done = courses.filter((c) => c.status === "COMPLETED" || c.status === "WAIVED");
    const withCredits = courses.filter((c) => c.credits != null);
    const creditsDone = done.reduce((n, c) => n + (c.credits ?? 0), 0);
    const creditsKnown = withCredits.reduce((n, c) => n + (c.credits ?? 0), 0);
    return {
      done: done.length,
      total: courses.length,
      creditsDone,
      creditsKnown,
      missingCredits: courses.length - withCredits.length,
    };
  }, [courses]);

  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return evaluations.filter(
      (e) => e.status === "PENDING" && (!e.due_date || e.due_date >= today),
    );
  }, [evaluations]);

  if (!allowed) {
    return (
      <div className="space-y-8">
        <PageHeader title="Faculdade" subtitle={PROGRAM_INFO.disclaimer} />
        <EmptyState
          icon={Lock}
          title="Perfil acadêmico não encontrado"
          description="Este perfil de Faculdade não pertence a nenhum membro deste espaço. Escolha um perfil no submenu Faculdade do menu."
          action={
            <Button asChild variant="outline">
              <Link to="/faculdade">Ir para a minha Faculdade</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Faculdade — ${ownerName}`}
        subtitle={`${PROGRAM_INFO.course} · ${PROGRAM_INFO.institution} · ${PROGRAM_INFO.curriculum} · ${PROGRAM_INFO.admission}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setImportDialog(true)}>
              <Upload className="size-4" /> Importar
            </Button>
            <Button size="sm" onClick={() => setCourseDialog("new")}>
              Nova disciplina
            </Button>
          </div>
        }
      />

      <p className="text-xs text-muted-foreground">{PROGRAM_INFO.disclaimer}</p>

      {/* Progresso estimado */}
      <Panel>
        <PanelTitle>Progresso estimado</PanelTitle>
        {courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Registre disciplinas para estimar o progresso até a formatura.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                {progress.done} de {progress.total} disciplinas concluídas
              </span>
              <span className="numeric text-muted-foreground">
                {progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%
              </span>
            </div>
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground">
              {progress.missingCredits > 0
                ? `${progress.missingCredits} disciplina(s) sem créditos informados — o total do curso é desconhecido e esta estimativa não é oficial.`
                : `${progress.creditsDone} de ${progress.creditsKnown} créditos conhecidos concluídos. Confirme o total oficial com a instituição.`}
            </p>
          </div>
        )}
      </Panel>

      {/* Períodos letivos */}
      <Panel>
        <PanelTitle
          action={
            <Button size="sm" variant="outline" onClick={() => setTermDialog(true)}>
              <CalendarRange className="size-4" /> Novo período
            </Button>
          }
        >
          Períodos letivos
        </PanelTitle>
        {terms.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum período registrado. Informe início, fim e matrícula quando souber as datas.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {terms.map((term) => (
              <li key={term.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="text-sm font-medium">{term.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {term.starts_on ? formatDateShort(term.starts_on) : "início desconhecido"} —{" "}
                    {term.ends_on ? formatDateShort(term.ends_on) : "fim desconhecido"}
                    {term.enrollment_until
                      ? ` · matrícula até ${formatDateShort(term.enrollment_until)}`
                      : ""}
                  </p>
                </div>
                <Badge variant="secondary">
                  {term.status === "ACTIVE"
                    ? "Em andamento"
                    : term.status === "FINISHED"
                      ? "Encerrado"
                      : "Planejado"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* Disciplinas por semestre */}
      <Panel>
        <PanelTitle
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => seedPendings.mutate()}
              disabled={seedPendings.isPending}
            >
              Registrar pendências conhecidas
            </Button>
          }
        >
          Disciplinas
        </PanelTitle>
        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Nenhuma disciplina registrada"
            description="Cadastre manualmente, importe CSV/JSON ou registre as quatro pendências conhecidas informadas por você."
          />
        ) : (
          <div className="space-y-6">
            {bySemester.map(([label, group]) => (
              <section key={label} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </h3>
                <ul className="divide-y divide-border">
                  {group.map((course) => {
                    const attendance = attendanceFromSessions(sessions, course.id);
                    const missing: string[] = [];
                    if (course.semester == null) missing.push("semestre");
                    if (course.credits == null) missing.push("créditos");
                    if (course.status === "COMPLETED" && course.grade == null) missing.push("nota");
                    return (
                      <li key={course.id} className="py-3">
                        <button
                          type="button"
                          className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                          onClick={() => setCourseDialog(course)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {course.name}
                              {course.code ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {course.code}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {course.grade != null ? `Nota ${course.grade}` : "Nota não informada"}
                              {" · "}
                              {attendance.percent != null
                                ? `Frequência registrada ${attendance.percent}% (${attendance.attended}/${attendance.total} aulas)`
                                : course.attendance_percent != null
                                  ? `Frequência informada ${course.attendance_percent}%`
                                  : "Frequência desconhecida"}
                            </p>
                            {course.prerequisites.length > 0 ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Pré-requisitos: {course.prerequisites.join(", ")}
                              </p>
                            ) : null}
                            {missing.length > 0 ? (
                              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                Dados faltantes: {missing.join(", ")}
                              </p>
                            ) : null}
                          </div>
                          <Badge
                            variant={
                              course.status === "COMPLETED"
                                ? "default"
                                : course.status === "FAILED"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {courseStatusLabel(course.status)}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>

      {/* Avaliações */}
      <Panel>
        <PanelTitle
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEvaluationDialog(true)}
              disabled={courses.length === 0}
            >
              <ClipboardList className="size-4" /> Nova avaliação
            </Button>
          }
        >
          Provas e trabalhos
        </PanelTitle>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma avaliação pendente.</p>
        ) : (
          <ul className="divide-y divide-border">
            {upcoming.map((ev) => {
              const course = courses.find((c) => c.id === ev.course_id);
              return (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {course?.name ?? "Disciplina removida"} · {evaluationKindLabel(ev.kind)}
                      {ev.weight != null ? ` · peso ${ev.weight}` : ""}
                    </p>
                  </div>
                  <span className="numeric shrink-0 text-xs text-muted-foreground">
                    {ev.due_date ? formatDateShort(ev.due_date) : "sem data"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {/* Aulas e frequência */}
      <Panel>
        <PanelTitle
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSessionDialog(true)}
              disabled={courses.length === 0}
            >
              <UserCheck className="size-4" /> Registrar aula
            </Button>
          }
        >
          Aulas e frequência
        </PanelTitle>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Registre aulas e marque presença para acompanhar a frequência real.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.slice(0, 20).map((session) => {
              const course = courses.find((c) => c.id === session.course_id);
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      {course?.name ?? "Disciplina removida"}
                      {session.topic ? ` — ${session.topic}` : ""}
                    </p>
                    <p className="numeric text-xs text-muted-foreground">
                      {formatDateShort(session.starts_at)}
                      {session.duration_minutes ? ` · ${session.duration_minutes} min` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={session.attended === true ? "default" : "outline"}
                      onClick={() =>
                        markAttendance(session.id, true)
                          .then(invalidate)
                          .catch(() => toast.error("Não foi possível registrar a presença."))
                      }
                    >
                      Presente
                    </Button>
                    <Button
                      size="sm"
                      variant={session.attended === false ? "destructive" : "outline"}
                      onClick={() =>
                        markAttendance(session.id, false)
                          .then(invalidate)
                          .catch(() => toast.error("Não foi possível registrar a falta."))
                      }
                    >
                      Falta
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {courseDialog ? (
        <CourseDialog
          workspaceId={workspaceId}
          userId={userId}
          terms={terms}
          course={courseDialog === "new" ? null : courseDialog}
          onClose={() => setCourseDialog(null)}
          onSaved={async () => {
            await invalidate();
            setCourseDialog(null);
          }}
        />
      ) : null}
      {termDialog ? (
        <TermDialog
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setTermDialog(false)}
          onSaved={async () => {
            await invalidate();
            setTermDialog(false);
          }}
        />
      ) : null}
      {evaluationDialog ? (
        <EvaluationDialog
          workspaceId={workspaceId}
          userId={userId}
          courses={courses}
          onClose={() => setEvaluationDialog(false)}
          onSaved={async () => {
            await invalidate();
            setEvaluationDialog(false);
          }}
        />
      ) : null}
      {sessionDialog ? (
        <SessionDialog
          workspaceId={workspaceId}
          userId={userId}
          courses={courses}
          onClose={() => setSessionDialog(false)}
          onSaved={async () => {
            await invalidate();
            setSessionDialog(false);
          }}
        />
      ) : null}
      {importDialog ? (
        <ImportDialog
          workspaceId={workspaceId}
          userId={userId}
          onClose={() => setImportDialog(false)}
          onSaved={async () => {
            await invalidate();
            setImportDialog(false);
          }}
        />
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function CourseDialog({
  workspaceId,
  userId,
  terms,
  course,
  onClose,
  onSaved,
}: {
  workspaceId: string | undefined;
  userId: string | undefined;
  terms: { id: string; name: string }[];
  course: AcademicCourse | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(course?.name ?? "");
  const [code, setCode] = useState(course?.code ?? "");
  const [semester, setSemester] = useState(course?.semester?.toString() ?? "");
  const [credits, setCredits] = useState(course?.credits?.toString() ?? "");
  const [status, setStatus] = useState<CourseStatus>(
    (course?.status as CourseStatus | undefined) ?? "PENDING",
  );
  const [grade, setGrade] = useState(course?.grade?.toString() ?? "");
  const [termId, setTermId] = useState(course?.term_id ?? NONE);
  const [prerequisites, setPrerequisites] = useState(course?.prerequisites.join(", ") ?? "");
  const [notes, setNotes] = useState(course?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !userId) return;
    setSaving(true);
    try {
      const input = {
        name,
        code: code || null,
        term_id: termId === NONE ? null : termId,
        semester: semester ? Number(semester) : null,
        credits: credits ? Number(credits) : null,
        status,
        grade: grade ? Number(grade.replace(",", ".")) : null,
        attendance_percent: course?.attendance_percent ?? null,
        prerequisites: prerequisites
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean),
        notes: notes || null,
      };
      if (course) await updateCourse(course.id, input);
      else await createCourse(workspaceId, userId, input);
      toast.success(course ? "Disciplina atualizada." : "Disciplina registrada.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{course ? "Editar disciplina" : "Nova disciplina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nome">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código (opcional)">
              <Input value={code} onChange={(e) => setCode(e.target.value)} />
            </Field>
            <Field label="Semestre (opcional)">
              <Input
                type="number"
                min={1}
                max={20}
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
              />
            </Field>
            <Field label="Créditos (opcional)">
              <Input
                type="number"
                min={0}
                max={60}
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
              />
            </Field>
            <Field label="Nota (opcional)">
              <Input value={grade} onChange={(e) => setGrade(e.target.value)} />
            </Field>
          </div>
          <Field label="Situação">
            <Select value={status} onValueChange={(v) => setStatus(v as CourseStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURSE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Período letivo (opcional)">
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger>
                <SelectValue placeholder="Sem período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sem período</SelectItem>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pré-requisitos (separados por vírgula)">
            <Input value={prerequisites} onChange={(e) => setPrerequisites(e.target.value)} />
          </Field>
          <Field label="Observações">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TermDialog({
  workspaceId,
  userId,
  onClose,
  onSaved,
}: {
  workspaceId: string | undefined;
  userId: string | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [enrollmentUntil, setEnrollmentUntil] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !userId) return;
    setSaving(true);
    try {
      await createTerm(workspaceId, userId, {
        name,
        starts_on: startsOn || null,
        ends_on: endsOn || null,
        enrollment_until: enrollmentUntil || null,
        status: "PLANNED",
      });
      toast.success("Período registrado.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo período letivo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Nome (ex.: 2025/1)">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Início">
              <Input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
            </Field>
            <Field label="Fim">
              <Input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
            </Field>
            <Field label="Matrícula até">
              <Input
                type="date"
                value={enrollmentUntil}
                onChange={(e) => setEnrollmentUntil(e.target.value)}
              />
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !name.trim()}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EvaluationDialog({
  workspaceId,
  userId,
  courses,
  onClose,
  onSaved,
}: {
  workspaceId: string | undefined;
  userId: string | undefined;
  courses: AcademicCourse[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<EvaluationKind>("EXAM");
  const [dueDate, setDueDate] = useState("");
  const [weight, setWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !userId) return;
    setSaving(true);
    try {
      await createEvaluation(workspaceId, userId, {
        course_id: courseId,
        title,
        kind,
        due_date: dueDate || null,
        weight: weight ? Number(weight.replace(",", ".")) : null,
        grade: null,
        status: "PENDING",
      });
      toast.success("Avaliação registrada.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova avaliação</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Disciplina">
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Título">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select value={kind} onValueChange={(v) => setKind(v as EvaluationKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVALUATION_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Data (opcional)">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Peso (opcional)">
            <Input value={weight} onChange={(e) => setWeight(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !title.trim() || !courseId}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SessionDialog({
  workspaceId,
  userId,
  courses,
  onClose,
  onSaved,
}: {
  workspaceId: string | undefined;
  userId: string | undefined;
  courses: AcademicCourse[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("");
  const [topic, setTopic] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!workspaceId || !userId) return;
    setSaving(true);
    try {
      await createSession(workspaceId, userId, {
        course_id: courseId,
        date,
        time: time || null,
        duration_minutes: duration ? Number(duration) : null,
        topic: topic || null,
        attended: null,
      });
      toast.success("Aula registrada. Marque a presença na lista.");
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar aula</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Disciplina">
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {courses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Horário (opcional)">
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Duração em minutos (opcional)">
            <Input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
          <Field label="Assunto (opcional)">
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || !courseId || !date}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  workspaceId,
  userId,
  onClose,
  onSaved,
}: {
  workspaceId: string | undefined;
  userId: string | undefined;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [saving, setSaving] = useState(false);

  const buildPreview = () => setPreview(parseImport(text, format));

  const confirm = async () => {
    if (!workspaceId || !userId || !preview) return;
    const valid = preview.items.flatMap((i) => (i.input ? [i.input] : []));
    if (!valid.length) return;
    setSaving(true);
    try {
      for (const input of valid) await createCourse(workspaceId, userId, input, "IMPORT");
      toast.success(`${valid.length} disciplina(s) importada(s).`);
      await onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível importar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar disciplinas</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Formato">
            <Select value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV (coluna name obrigatória)</SelectItem>
                <SelectItem value="json">JSON (lista de disciplinas)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Conteúdo">
            <Textarea
              rows={6}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                format === "csv"
                  ? "name,code,semester,credits,status,grade,prerequisites,notes"
                  : '[{ "name": "Cálculo I", "semester": 1 }]'
              }
            />
          </Field>
          <Button variant="outline" onClick={buildPreview} disabled={!text.trim()}>
            Gerar prévia
          </Button>
          {preview ? (
            <div className="space-y-2">
              <p className="text-sm">
                {preview.valid} válida(s), {preview.invalid} com erro.
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {preview.items.map((item) => (
                  <li key={item.line} className="flex justify-between gap-2">
                    <span className="truncate">
                      Linha {item.line}: {item.input?.name ?? "—"}
                    </span>
                    {item.error ? (
                      <span className="text-destructive">{item.error}</span>
                    ) : (
                      <span className="text-muted-foreground">ok</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={saving || !preview || preview.valid === 0}>
            Importar {preview?.valid ?? 0} válida(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
