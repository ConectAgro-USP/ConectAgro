import { screen } from "@testing-library/react";

// lê o que o Address do RouterProbe mostra
export function address(): string | null {
  return screen.getByTestId("address").textContent;
}
