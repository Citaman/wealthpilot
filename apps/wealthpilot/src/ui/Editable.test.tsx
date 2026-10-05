import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { EditableMoney } from "./Editable";

function Harness({
  onCommit,
}: {
  onCommit: (value: number | null) => Promise<void> | void;
}) {
  const [value, setValue] = useState<number | null>(20_000);
  return (
    <EditableMoney
      value={value}
      label="Alloué Courses"
      allowEmpty
      onCommit={async (next) => {
        await onCommit(next);
        setValue(next);
      }}
    />
  );
}

const open = () => {
  fireEvent.click(
    screen.getByRole("button", { name: "Alloué Courses : modifier" }),
  );
  return screen.getByRole("textbox", {
    name: "Alloué Courses",
  }) as HTMLInputElement;
};

describe("EditableMoney", () => {
  it("commits on Enter with the parsed cents", async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = open();
    expect(input.value).toBe("200");
    fireEvent.change(input, { target: { value: "245,50" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByRole("button").textContent).toContain("245,50"),
    );
    expect(onCommit).toHaveBeenCalledWith(24_550);
  });

  it("cancels on Escape without committing, even when blurred afterwards", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = open();
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button").textContent).toContain("200");
  });

  it("commits on blur (Tab or click outside)", async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = open();
    fireEvent.change(input, { target: { value: "180" } });
    fireEvent.blur(input);
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(18_000));
  });

  it("keeps the field and the previous value on invalid input", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = open();
    fireEvent.change(input, { target: { value: "12,345" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert").textContent).toBe("Montant invalide");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the write error and stays in edit mode when the commit rejects", async () => {
    render(
      <Harness
        onCommit={() => Promise.reject(new Error("Écriture refusée"))}
      />,
    );
    const input = open();
    fireEvent.change(input, { target: { value: "300" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("Écriture refusée"),
    );
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("commits null for an empty field when allowed", async () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = open();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(onCommit).toHaveBeenCalledWith(null));
  });
});
