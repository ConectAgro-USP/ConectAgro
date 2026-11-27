import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ana, anaAsBuyer, anaAsManager } from "../test/helpers";
import { renderSessionApp } from "../test/visitor";

async function expectOpenHome() {
  expect(await screen.findByText("1 produto")).toBeVisible();
  expect(screen.getByTestId("address")).toHaveTextContent(/^\/$/);
  expect(within(screen.getByRole("banner")).getByRole("link", { name: "Entrar" })).toBeVisible();
}

describe("logout", () => {
  it("leaves the user on the open home from the header", async () => {
    renderSessionApp("/perfil", anaAsBuyer("APROVADO"));

    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));

    await expectOpenHome();
    expect(screen.queryByRole("heading", { name: "Entrar" })).not.toBeInTheDocument();
  });

  it("leaves the user on the open home from Mais", async () => {
    renderSessionApp("/necessidades", anaAsManager);

    const more = await screen.findByRole("button", { name: "Mais" });
    await userEvent.click(more);
    const panel = document.getElementById(more.getAttribute("aria-controls")!)!;
    await userEvent.click(within(panel).getByRole("button", { name: "Sair" }));

    await expectOpenHome();
  });

  it("leaves the user on the open home from the profile setup", async () => {
    renderSessionApp("/interesses", ana);

    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));

    await expectOpenHome();
  });

  it("leaves a pending resident on the open home", async () => {
    renderSessionApp("/produtos/prod-123", anaAsBuyer("PENDENTE"));

    await userEvent.click(await screen.findByRole("button", { name: "Sair" }));

    await expectOpenHome();
  });
});
