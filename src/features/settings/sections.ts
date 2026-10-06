import {
  Activity,
  Database,
  Home,
  Paintbrush,
  Settings2,
  Tags,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type SettingsSection = {
  to:
    | "/configuracoes/perfil"
    | "/configuracoes/espaco"
    | "/configuracoes/pessoas"
    | "/configuracoes/personalizacao"
    | "/configuracoes/categorias"
    | "/configuracoes/financeiro"
    | "/configuracoes/dados"
    | "/configuracoes/atividade"
    | "/configuracoes/sistema";
  label: string;
  hint: string;
  icon: LucideIcon;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    to: "/configuracoes/perfil",
    label: "Meu perfil",
    hint: "Nome, foto, tema e formatos",
    icon: User,
  },
  {
    to: "/configuracoes/espaco",
    label: "Meu espaço",
    hint: "Nome, descrição, foto, capa e cor",
    icon: Home,
  },
  {
    to: "/configuracoes/pessoas",
    label: "Pessoas",
    hint: "Membros, papéis e convite",
    icon: Users,
  },
  {
    to: "/configuracoes/personalizacao",
    label: "Personalização",
    hint: "Menu, favoritos e tela inicial",
    icon: Paintbrush,
  },
  {
    to: "/configuracoes/categorias",
    label: "Categorias",
    hint: "Criar, editar e arquivar",
    icon: Tags,
  },
  {
    to: "/configuracoes/financeiro",
    label: "Financeiro",
    hint: "Contas, cartões e categorias",
    icon: Wallet,
  },
  { to: "/configuracoes/dados", label: "Dados", hint: "Exportar e lixeira", icon: Database },
  {
    to: "/configuracoes/atividade",
    label: "Atividade",
    hint: "Quem fez o quê e quando",
    icon: Activity,
  },
  { to: "/configuracoes/sistema", label: "Sistema", hint: "Demonstração e sair", icon: Settings2 },
];
