import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { expect, it, vi } from "vitest";
import { useSortable } from "./sortable";

const names: Record<string, string> = {
  a: "Solde",
  b: "Disponible",
  c: "Enveloppes",
  d: "À venir",
};

function List({ onCommit }: { onCommit: (ids: string[]) => void }) {
  const [ids, setIds] = useState(["a", "b", "c", "d"]);
  const sortable = useSortable({
    ids,
    axis: "grid",
    label: (id) => names[id],
    onCommit: (next) => {
      onCommit(next);
      setIds(next);
    },
  });
  return (
    <>
      <ul data-testid="list">
        {sortable.order.map((id) => (
          <li key={id} {...sortable.getItemProps(id)}>
            <button type="button" {...sortable.getHandleProps(id)} />
            {names[id]}
          </li>
        ))}
      </ul>
      {sortable.status}
    </>
  );
}

const order = () =>
  [...screen.getByTestId("list").children].map((li) => li.textContent);
const handle = (name: string) =>
  screen.getByRole("button", { name: `Déplacer ${name}` });
const live = () => document.querySelector("[aria-live]")!.textContent;
const key = (name: string, key: string) =>
  act(() => {
    fireEvent.keyDown(handle(name), { key });
  });

it("useSortable au clavier : soulever, déplacer, déposer avec annonces, Échap restaure, butées", () => {
  // lifts, moves and drops with announcements
  {
    const onCommit = vi.fn();
    cleanup();
    render(<List onCommit={onCommit} />);
    handle("Disponible").focus();
    key("Disponible", " ");
    expect(live()).toBe("Disponible soulevée, position 2 sur 4");
    expect(handle("Disponible").getAttribute("aria-pressed")).toBe("true");
    key("Disponible", "ArrowRight");
    key("Disponible", "ArrowDown");
    expect(live()).toBe("Disponible, position 4 sur 4");
    expect(order()).toEqual(["Solde", "Enveloppes", "À venir", "Disponible"]);
    expect(onCommit).not.toHaveBeenCalled();
    key("Disponible", "ArrowLeft");
    key("Disponible", "Enter");
    expect(onCommit).toHaveBeenCalledWith(["a", "c", "b", "d"]);
    expect(live()).toBe("Disponible déposée en position 3 sur 4");
    expect(order()).toEqual(["Solde", "Enveloppes", "Disponible", "À venir"]);
  }
  // restores the original order on Escape
  {
    const onCommit = vi.fn();
    cleanup();
    render(<List onCommit={onCommit} />);
    key("Solde", "Enter");
    key("Solde", "ArrowRight");
    key("Solde", "ArrowRight");
    expect(order()[2]).toBe("Solde");
    key("Solde", "Escape");
    expect(order()).toEqual(["Solde", "Disponible", "Enveloppes", "À venir"]);
    expect(live()).toBe("Déplacement annulé");
    expect(onCommit).not.toHaveBeenCalled();
  }
  // does not move past either end
  {
    const onCommit = vi.fn();
    cleanup();
    render(<List onCommit={onCommit} />);
    key("Solde", " ");
    key("Solde", "ArrowLeft");
    expect(live()).toBe("Solde soulevée, position 1 sur 4");
    key("Solde", " ");
    expect(onCommit).not.toHaveBeenCalled();
  }
});
