import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnsSettings } from "./settings";

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockToastSuccess, mockToastError, mockFrom } = vi.hoisted(() => ({
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockFrom: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mockFrom },
}));

// TanStack Router — solo necesario para que createFileRoute no falle al importar el módulo
vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => () => ({}),
    useNavigate: () => vi.fn(),
  };
});

// ── Fixtures ───────────────────────────────────────────────────────────────

const MOCK_COLS = [
  { id: "col-1", name: "Nuevo",       position: 0, color: "#6366F1", is_completed: false },
  { id: "col-2", name: "En Análisis", position: 2, color: "#F59E0B", is_completed: false },
  { id: "col-3", name: "En Curso",    position: 3, color: "#10B981", is_completed: false },
  // Nótese: positions [0, 2, 3] — hay un gap en 1 (simula una columna eliminada)
  // Se evita nombrar una columna "Completado" porque ese texto también aparece
  // en el label del switch de cada fila, generando ambigüedad en las queries.
];

type ChainOpts = {
  loadData?: typeof MOCK_COLS;
  insertError?: { message: string } | null;
};

/**
 * Configura los mocks de Supabase para la cadena de llamadas del componente.
 * Retorna referencias a los mocks para hacer assertions.
 */
function buildChain({ loadData = MOCK_COLS, insertError = null }: ChainOpts = {}) {
  const order    = vi.fn().mockResolvedValue({ data: loadData, error: null });
  const select   = vi.fn().mockReturnValue({ order });
  const insert   = vi.fn().mockResolvedValue({ error: insertError });
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update   = vi.fn().mockReturnValue({ eq: updateEq });
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const deleteFn = vi.fn().mockReturnValue({ eq: deleteEq });

  mockFrom.mockReturnValue({ select, insert, update, delete: deleteFn });

  return { order, insert, update, updateEq, deleteFn, deleteEq };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ColumnsSettings — creación de columnas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.confirm = vi.fn(() => true);
  });

  it("muestra las columnas existentes después de cargar", async () => {
    buildChain();
    render(<ColumnsSettings />);

    expect(await screen.findByText("Nuevo")).toBeInTheDocument();
    expect(screen.getByText("En Análisis")).toBeInTheDocument();
    expect(screen.getByText("En Curso")).toBeInTheDocument();
  });

  it("muestra estado vacío cuando no hay columnas", async () => {
    buildChain({ loadData: [] });
    render(<ColumnsSettings />);

    expect(await screen.findByText(/sin columnas/i)).toBeInTheDocument();
  });

  it("muestra error y no llama a insert si el nombre está vacío", async () => {
    const { insert } = buildChain();
    render(<ColumnsSettings />);
    await screen.findByText("Nuevo");

    await userEvent.click(screen.getByRole("button", { name: /añadir/i }));

    expect(mockToastError).toHaveBeenCalledWith("El nombre es requerido");
    expect(insert).not.toHaveBeenCalled();
  });

  it("inserta la columna con el nombre correcto al hacer click en Añadir", async () => {
    const { insert } = buildChain();
    render(<ColumnsSettings />);
    await screen.findByText("Nuevo");

    await userEvent.type(screen.getByPlaceholderText(/nombre de la columna/i), "En Revisión");
    await userEvent.click(screen.getByRole("button", { name: /añadir/i }));

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ name: "En Revisión" }));
    expect(mockToastSuccess).toHaveBeenCalledWith("Columna añadida");
  });

  it("calcula la posición como max(positions)+1, no cols.length", async () => {
    // MOCK_COLS tiene positions [0, 2, 3] — hay un gap en 1 por una eliminación previa.
    // cols.length = 3, pero la posición correcta es max(0,2,3)+1 = 4.
    const { insert } = buildChain();
    render(<ColumnsSettings />);
    await screen.findByText("Nuevo");

    await userEvent.type(screen.getByPlaceholderText(/nombre de la columna/i), "Nueva");
    await userEvent.click(screen.getByRole("button", { name: /añadir/i }));

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ position: 4 }));
  });

  it("propaga el mensaje de error de Supabase cuando el insert falla", async () => {
    buildChain({ insertError: { message: "violates row-level security policy" } });
    render(<ColumnsSettings />);
    await screen.findByText("Nuevo");

    await userEvent.type(screen.getByPlaceholderText(/nombre de la columna/i), "Test");
    await userEvent.click(screen.getByRole("button", { name: /añadir/i }));

    expect(mockToastError).toHaveBeenCalledWith("violates row-level security policy");
  });

  it("limpia el campo nombre tras añadir con éxito", async () => {
    buildChain();
    render(<ColumnsSettings />);
    await screen.findByText("Nuevo");

    const input = screen.getByPlaceholderText(/nombre de la columna/i);
    await userEvent.type(input, "Nueva columna");
    await userEvent.click(screen.getByRole("button", { name: /añadir/i }));

    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("añade la columna al presionar Enter en el input nombre", async () => {
    const { insert } = buildChain();
    render(<ColumnsSettings />);
    await screen.findByText("Nuevo");

    await userEvent.type(
      screen.getByPlaceholderText(/nombre de la columna/i),
      "Vía Enter{Enter}",
    );

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ name: "Vía Enter" }));
  });
});
