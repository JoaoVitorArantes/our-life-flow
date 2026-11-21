import { z } from "zod";

/**
 * Casamento é um módulo isolado: suas tabelas (wedding_*) são a única fonte de verdade.
 * Nada aqui lê ou grava Financeiro, Metas, Tarefas, Agenda, Notas, Compras ou Contextos.
 */

export const WEDDING_AREAS = [
  { key: "house", slug: "casa", label: "Nossa Casa / Enxoval", emoji: "🏡", ready: true },
  { key: "ceremony", slug: "cerimonia", label: "Cerimônia", emoji: "💍", ready: false },
  { key: "party", slug: "festa", label: "Festa", emoji: "🥂", ready: false },
  { key: "honeymoon", slug: "lua-de-mel", label: "Lua de Mel", emoji: "✈️", ready: false },
  {
    key: "planning",
    slug: "planejamento",
    label: "Planejamento do Casal",
    emoji: "🗓️",
    ready: false,
  },
] as const;

export const PRIORITIES = {
  P1: "P1 · Essencial",
  P2: "P2 · Importante",
  P3: "P3 · Complementar",
} as const;
export type Priority = keyof typeof PRIORITIES;

export const ITEM_STATUS = {
  to_research: "A pesquisar",
  researched: "Pesquisado",
  planned: "Planejado",
  bought: "Comprado",
} as const;
export type ItemStatus = keyof typeof ITEM_STATUS;

export const TASK_STATUS = { todo: "A fazer", doing: "Em andamento", done: "Concluído" } as const;
export const TASK_KIND = { task: "Tarefa", decision: "Decisão", note: "Nota" } as const;

const money = z.number().finite().min(0).max(10_000_000).nullable();

export const itemInputSchema = z
  .object({
    room_id: z.string().uuid(),
    name: z.string().trim().min(1).max(160),
    quantity: z.number().int().min(1).max(999),
    priority: z.enum(["P1", "P2", "P3"]),
    price_low: money,
    price_target: money,
    price_high: money,
    price_actual: money,
    status: z.enum(["to_research", "researched", "planned", "bought"]),
    responsible_user_id: z.string().uuid().nullable(),
    links: z.array(z.string().trim().url().max(500)).max(10),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict();
export type ItemInput = z.infer<typeof itemInputSchema>;

export const planInputSchema = z
  .object({
    wedding_date: z.string().date().nullable(),
    move_in_date: z.string().date().nullable(),
    total_budget: money,
    housing: z.enum(["rent", "own", "other"]),
    bedrooms: z.number().int().min(0).max(20).nullable(),
    standard: z.enum(["economy", "intermediate", "premium"]),
    savings_start: z.string().date().nullable(),
    notes: z.string().trim().max(2000).nullable(),
  })
  .strict();
export type PlanInput = z.infer<typeof planInputSchema>;

/** Premissas declaradas pelo casal; datas de casamento/mudança e orçamento ficam vazios. */
export const DEFAULT_PLAN: PlanInput = {
  wedding_date: null,
  move_in_date: null,
  total_budget: null,
  housing: "rent",
  bedrooms: 2,
  standard: "intermediate",
  savings_start: "2027-01-01",
  notes: null,
};

type SummaryItem = {
  room_id: string;
  quantity: number;
  priority: string;
  price_target: number | null;
  status: string;
};

export type WeddingSummary = {
  estimated: number;
  itemsWithoutPrice: number;
  totalItems: number;
  boughtItems: number;
  saved: number;
  spent: number;
  remainingToSave: number | null;
  savingsTarget: number;
  byPriority: Record<Priority, { total: number; bought: number }>;
  byRoom: Record<string, { total: number; bought: number; estimated: number }>;
};

/** Cálculos do painel. Itens sem preço-meta não entram na estimativa e são contados à parte. */
export function computeSummary(
  items: readonly SummaryItem[],
  contributions: readonly { amount: number }[],
  expenses: readonly { amount: number }[],
  goals: readonly { target_amount: number }[],
): WeddingSummary {
  const byPriority: WeddingSummary["byPriority"] = {
    P1: { total: 0, bought: 0 },
    P2: { total: 0, bought: 0 },
    P3: { total: 0, bought: 0 },
  };
  const byRoom: WeddingSummary["byRoom"] = {};
  let estimated = 0;
  let itemsWithoutPrice = 0;
  let boughtItems = 0;
  for (const item of items) {
    const bought = item.status === "bought";
    if (bought) boughtItems += 1;
    const value = item.price_target == null ? null : Number(item.price_target) * item.quantity;
    if (value == null) itemsWithoutPrice += 1;
    else estimated += value;
    const p = byPriority[item.priority as Priority];
    if (p) {
      p.total += 1;
      if (bought) p.bought += 1;
    }
    const r = (byRoom[item.room_id] ??= { total: 0, bought: 0, estimated: 0 });
    r.total += 1;
    if (bought) r.bought += 1;
    if (value != null) r.estimated += value;
  }
  const saved = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const spent = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const savingsTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const remainingToSave = estimated === 0 ? null : Math.max(0, estimated - saved);
  return {
    estimated,
    itemsWithoutPrice,
    totalItems: items.length,
    boughtItems,
    saved,
    spent,
    remainingToSave,
    savingsTarget,
    byPriority,
    byRoom,
  };
}

/** Meses consecutivos a partir de uma data (YYYY-MM-01). */
export function monthsFrom(start: string, count: number): string[] {
  const [y, m] = start.split("-").map(Number) as [number, number];
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
  });
}

/**
 * Inventário sugerido (aluguel, 2 quartos, casa completa, padrão intermediário).
 * Apenas nomes, quantidades e prioridades sugeridas — TODOS os preços ficam vazios.
 */
export const SUGGESTED_INVENTORY: { room: string; items: [string, number, Priority][] }[] = [
  {
    room: "Quarto principal",
    items: [
      ["Cama de casal", 1, "P1"],
      ["Colchão de casal", 1, "P1"],
      ["Guarda-roupa", 1, "P1"],
      ["Criados-mudos", 2, "P2"],
      ["Cortina ou blackout", 1, "P2"],
      ["Luminárias de cabeceira", 2, "P3"],
      ["Espelho", 1, "P3"],
    ],
  },
  {
    room: "Segundo quarto (multifuncional)",
    items: [
      ["Escrivaninha", 1, "P2"],
      ["Cadeira de escritório", 1, "P2"],
      ["Sofá-cama ou cama de solteiro", 1, "P3"],
      ["Estante", 1, "P3"],
      ["Cortina", 1, "P3"],
    ],
  },
  {
    room: "Sala",
    items: [
      ["Sofá", 1, "P1"],
      ["Rack ou painel", 1, "P2"],
      ["Mesa de centro", 1, "P3"],
      ["Tapete", 1, "P3"],
      ["Cortina", 1, "P2"],
      ["Luminária", 1, "P3"],
    ],
  },
  {
    room: "Jantar",
    items: [
      ["Mesa de jantar", 1, "P2"],
      ["Cadeiras", 4, "P2"],
      ["Aparador", 1, "P3"],
    ],
  },
  {
    room: "Cozinha — eletrodomésticos",
    items: [
      ["Geladeira", 1, "P1"],
      ["Fogão ou cooktop", 1, "P1"],
      ["Micro-ondas", 1, "P2"],
      ["Liquidificador", 1, "P2"],
      ["Air fryer", 1, "P3"],
      ["Cafeteira", 1, "P3"],
      ["Sanduicheira", 1, "P3"],
      ["Purificador de água", 1, "P2"],
    ],
  },
  {
    room: "Cozinha — utensílios e louças",
    items: [
      ["Jogo de panelas", 1, "P1"],
      ["Frigideiras", 2, "P1"],
      ["Jogo de pratos", 1, "P1"],
      ["Copos", 12, "P1"],
      ["Faqueiro", 1, "P1"],
      ["Facas de cozinha", 1, "P1"],
      ["Tábua de corte", 2, "P2"],
      ["Potes herméticos", 1, "P2"],
      ["Xícaras", 6, "P2"],
      ["Assadeiras", 3, "P2"],
      ["Escorredor de louça", 1, "P1"],
      ["Lixeira de cozinha", 1, "P1"],
    ],
  },
  {
    room: "Banheiro",
    items: [
      ["Kit de acessórios", 1, "P2"],
      ["Tapete de banheiro", 2, "P2"],
      ["Cesto de roupa", 1, "P2"],
      ["Lixeira de banheiro", 1, "P1"],
      ["Armário ou organizador", 1, "P3"],
    ],
  },
  {
    room: "Lavanderia",
    items: [
      ["Máquina de lavar", 1, "P1"],
      ["Varal", 1, "P1"],
      ["Ferro de passar", 1, "P2"],
      ["Tábua de passar", 1, "P3"],
      ["Cestos", 2, "P2"],
    ],
  },
  {
    room: "Limpeza e manutenção",
    items: [
      ["Aspirador de pó", 1, "P2"],
      ["Vassoura, rodo e pá", 1, "P1"],
      ["Balde e panos", 1, "P1"],
      ["Escada", 1, "P2"],
      ["Kit de ferramentas", 1, "P2"],
    ],
  },
  {
    room: "Cama, mesa e banho",
    items: [
      ["Jogos de lençol de casal", 3, "P1"],
      ["Travesseiros", 4, "P1"],
      ["Edredom ou cobertor", 2, "P1"],
      ["Toalhas de banho", 6, "P1"],
      ["Toalhas de rosto", 6, "P2"],
      ["Panos de prato", 6, "P2"],
      ["Toalhas de mesa", 2, "P3"],
    ],
  },
  {
    room: "Tecnologia",
    items: [
      ["Smart TV", 1, "P2"],
      ["Roteador Wi-Fi", 1, "P1"],
      ["Filtros de linha", 3, "P2"],
      ["Lâmpadas inteligentes", 1, "P3"],
    ],
  },
  {
    room: "Segurança",
    items: [
      ["Fechadura ou trava extra", 1, "P2"],
      ["Extintor", 1, "P2"],
      ["Kit de primeiros socorros", 1, "P2"],
    ],
  },
  {
    room: "Organização",
    items: [
      ["Caixas organizadoras", 6, "P3"],
      ["Cabides", 40, "P1"],
      ["Sapateira", 1, "P3"],
    ],
  },
  {
    room: "Áreas externas",
    items: [
      ["Vasos e plantas", 1, "P3"],
      ["Cadeiras de varanda", 2, "P3"],
    ],
  },
  {
    room: "Instalação e mudança",
    items: [
      ["Frete da mudança", 1, "P1"],
      ["Instalação de chuveiro e luminárias", 1, "P1"],
      ["Instalação de cortinas e suportes", 1, "P2"],
      ["Montagem de móveis", 1, "P2"],
      ["Caução ou taxas do aluguel", 1, "P1"],
    ],
  },
];
